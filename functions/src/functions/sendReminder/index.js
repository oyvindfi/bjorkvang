const { app } = require('@azure/functions');
const { sendEmail } = require('../../../shared/email');
const { sendSms, formatDate } = require('../../../shared/sms');
const { createJsonResponse, parseBody } = require('../../../shared/http');
const { getBooking } = require('../../../shared/cosmosDb');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

app.http('sendReminder', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'booking/remind',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const { id, comment } = body;

            if (!id) {
                return createJsonResponse(400, { error: 'Missing booking id.' });
            }

            const booking = await getBooking(id);
            if (!booking) {
                return createJsonResponse(404, { error: 'Booking not found.' });
            }

            const contract = booking.contract || {};
            const isRequesterSigned = !!contract.signedAt;
            const depositRequested = !!booking.depositRequested;
            const depositPaid = !!booking.depositPaid;
            const finalInvoiceSent = !!(booking.finalInvoiceSentAt || booking.invoiceSentAt);
            const finalInvoicePaid = !!booking.finalInvoicePaid;
            const bookingDatePast = booking.date && new Date(booking.date + 'T23:59:59') < new Date();

            // Determine what we are reminding about
            let reminderType;
            if (!isRequesterSigned && !bookingDatePast) {
                reminderType = 'signing';
            } else if (depositRequested && !depositPaid) {
                reminderType = 'deposit';
            } else if (finalInvoiceSent && !finalInvoicePaid) {
                reminderType = 'finalInvoice';
            } else {
                return createJsonResponse(400, { error: 'Ingen aktiv påminnelse å sende for denne bookingen.' });
            }

            const websiteUrl = process.env.WEBSITE_URL || 'https://bjorkvang.org';
            const contractLink = `${websiteUrl}/leieavtale.html?id=${booking.id}`;
            const bankAccount = process.env.BANK_ACCOUNT || '1822.40.12345';

            const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[m]);

            const safeName = escapeHtml(booking.requesterName || 'Kunde');
            const firstName = booking.requesterName ? booking.requesterName.split(' ')[0] : 'deg';
            const safeComment = comment ? escapeHtml(comment) : null;

            const dateObj = new Date(`${booking.date}T00:00:00`);
            const formattedDate = !isNaN(dateObj)
                ? dateObj.toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : (booking.date || '');
            const safeDate = escapeHtml(formattedDate);

            const depositNOK = booking.depositAmount || Math.round((booking.totalAmount || 0) * 0.5);
            const remainingNOK = booking.finalInvoiceAmountNOK || ((booking.totalAmount || 0) - depositNOK);

            const commentBlock = safeComment
                ? `<div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin:16px 0;">
                       <strong>Melding fra styret:</strong><br>${safeComment}
                   </div>`
                : '';

            let subject, htmlContent, actionButton, smsBody, previewText;

            if (reminderType === 'signing') {
                subject = `Påminnelse: Signer leieavtalen – ${formattedDate}`;
                previewText = `Du har en usignert leieavtale for ${formattedDate}.`;
                actionButton = { text: '📄 Signer leieavtalen', url: contractLink };
                htmlContent = `
                    <p>Hei ${safeName},</p>
                    <p>Vi vil minne deg på at leieavtalen for din booking på Bjørkvang forsamlingslokale (<strong>${safeDate}</strong>) ennå ikke er signert.</p>
                    ${commentBlock}
                    <p>Vennligst signer avtalen for å bekrefte reservasjonen din. Forhåndsbetalingsforespørsel sendes automatisk når begge parter har signert.</p>
                    <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:12px 0 16px;">
                        <a href="${contractLink}" style="display:inline-block;background:#1a56db;color:#fff;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:1rem;">📄 Signer leieavtalen</a>
                    </div>
                    <p style="font-size:0.9em;color:#6b7280;">Spørsmål? Ta kontakt på <a href="mailto:styret@bjørkvang.no" style="color:#1a823b;">styret@bjørkvang.no</a>.</p>
                `;
                smsBody = `Hei ${firstName}! Påminnelse: Leieavtalen for ${formatDate(booking.date)} er ikke signert ennå. Signer her: ${contractLink} – Bjørkvang forsamlingslokale og Helgøens Vel`;

            } else if (reminderType === 'deposit') {
                subject = `Påminnelse: Forhåndsbetaling forfaller – ${formattedDate}`;
                previewText = `Vi venter fortsatt på forhåndsbetalingen for ${formattedDate}.`;
                actionButton = { text: '📄 Se leieavtalen', url: contractLink };
                const depositStr = depositNOK ? `kr\u00a0${depositNOK.toLocaleString('nb-NO')}` : '(oppgitt beløp)';
                const paymentInfoHtml = booking.paymentMethod === 'vipps'
                    ? `<p>Sjekk e-posten du tidligere mottok med betalingslenke for Vipps, eller ta kontakt med styret.</p>`
                    : `<p>Betal til kontonummer <strong>${escapeHtml(bankAccount)}</strong> og merk betalingen med <strong>${escapeHtml(id.slice(0, 8))}</strong>.</p>`;
                htmlContent = `
                    <p>Hei ${safeName},</p>
                    <p>Vi venter fortsatt på forhåndsbetalingen (<strong>${depositStr}</strong>) for din booking på Bjørkvang forsamlingslokale den <strong>${safeDate}</strong>.</p>
                    ${commentBlock}
                    ${paymentInfoHtml}
                    <p style="font-size:0.9em;color:#6b7280;">Spørsmål? Ta kontakt på <a href="mailto:styret@bjørkvang.no" style="color:#1a823b;">styret@bjørkvang.no</a>.</p>
                `;
                smsBody = booking.paymentMethod === 'vipps'
                    ? `Hei ${firstName}! Påminnelse: Forhåndsbetaling${depositNOK ? ' kr ' + depositNOK.toLocaleString('nb-NO') + ',-' : ''} for ${formatDate(booking.date)} er ikke betalt. Sjekk e-posten for betalingslenke. – Bjørkvang forsamlingslokale og Helgøens Vel`
                    : `Hei ${firstName}! Påminnelse: Betal forhåndsbetaling${depositNOK ? ' kr ' + depositNOK.toLocaleString('nb-NO') + ',-' : ''} for ${formatDate(booking.date)} til kontonr. ${bankAccount}. Merk: ${id.slice(0, 8)}. – Bjørkvang forsamlingslokale og Helgøens Vel`;

            } else { // finalInvoice
                subject = `Påminnelse: Sluttfaktura for ${formattedDate}`;
                previewText = `Vi venter fortsatt på betaling av sluttfakturaen for ${formattedDate}.`;
                actionButton = { text: '📄 Se leieavtalen', url: contractLink };
                const remainingStr = remainingNOK ? `kr\u00a0${remainingNOK.toLocaleString('nb-NO')}` : '(oppgitt beløp)';
                const paymentInfoHtml = booking.paymentMethod === 'vipps'
                    ? `<p>Sjekk e-posten du tidligere mottok med betalingslenke for Vipps, eller ta kontakt med styret.</p>`
                    : `<p>Betal til kontonummer <strong>${escapeHtml(bankAccount)}</strong> og merk betalingen med <strong>${escapeHtml(id.slice(0, 8))}</strong>.</p>`;
                htmlContent = `
                    <p>Hei ${safeName},</p>
                    <p>Vi venter fortsatt på betaling av sluttfakturaen (<strong>${remainingStr}</strong>) for din booking på Bjørkvang forsamlingslokale den <strong>${safeDate}</strong>.</p>
                    ${commentBlock}
                    ${paymentInfoHtml}
                    <p style="font-size:0.9em;color:#6b7280;">Spørsmål? Ta kontakt på <a href="mailto:styret@bjørkvang.no" style="color:#1a823b;">styret@bjørkvang.no</a>.</p>
                `;
                smsBody = booking.paymentMethod === 'vipps'
                    ? `Hei ${firstName}! Påminnelse: Sluttfaktura${remainingNOK ? ' kr ' + remainingNOK.toLocaleString('nb-NO') + ',-' : ''} for ${formatDate(booking.date)} er ikke betalt. Sjekk e-posten for betalingslenke. – Bjørkvang forsamlingslokale og Helgøens Vel`
                    : `Hei ${firstName}! Påminnelse: Betal sluttfaktura${remainingNOK ? ' kr ' + remainingNOK.toLocaleString('nb-NO') + ',-' : ''} for ${formatDate(booking.date)} til kontonr. ${bankAccount}. Merk: ${id.slice(0, 8)}. – Bjørkvang forsamlingslokale og Helgøens Vel`;
            }

            const html = generateEmailHtml({
                title: subject,
                content: htmlContent,
                action: actionButton,
                previewText
            });

            await sendEmail({
                to: booking.requesterEmail,
                from: process.env.DEFAULT_FROM_ADDRESS,
                subject,
                html,
                text: smsBody,
            });

            if (booking.phone) {
                await sendSms({ to: booking.phone, body: smsBody }, context);
            }

            context.info(`sendReminder: type=${reminderType}, booking=${id}`);
            return createJsonResponse(200, { message: 'Reminder sent', type: reminderType });

        } catch (error) {
            context.error('Error sending reminder:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
