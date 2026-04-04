const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');
const { getBooking, updateBookingFields } = require('../../../shared/cosmosDb');
const { sendEmail } = require('../../../shared/email');
const { generateEmailHtml } = require('../../../shared/emailTemplate');
const vipps = require('../../../shared/vipps');

const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[m]);

/**
 * Send an itemised final invoice (sluttfaktura) to the booking requester.
 * POST /api/booking/send-final-invoice
 * Body: { id, extraItems?: [{ description: string, amountNOK: number }] }
 *
 * - Calculates remaining = (totalAmount - depositAmount) + sum(extraItems)
 * - If paymentMethod === 'vipps': creates Vipps payment link, embeds in email
 * - If 'bank': includes bank account in email
 * - Returns 409 if invoice was already sent (prevents accidental duplicate)
 */
app.http('sendFinalInvoice', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/send-final-invoice',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        let body = {};
        try { body = await request.json(); } catch { /* also accept query param */ }

        const id = body.id || request.query.get('id');
        if (!id || typeof id !== 'string' || !id.trim()) {
            return createJsonResponse(400, { error: 'Missing booking id.' }, request);
        }

        const extraItems = Array.isArray(body.extraItems) ? body.extraItems : [];
        // Validate extra items
        for (const item of extraItems) {
            if (!item.description || typeof item.description !== 'string' || item.description.length > 200) {
                return createJsonResponse(400, { error: 'Extra item description is required and must be ≤200 chars.' }, request);
            }
            if (typeof item.amountNOK !== 'number' || item.amountNOK < 0) {
                return createJsonResponse(400, { error: 'Extra item amountNOK must be a non-negative number.' }, request);
            }
        }

        const booking = await getBooking(id.trim());
        if (!booking) {
            return createJsonResponse(404, { error: 'Booking not found.' }, request);
        }

        // Block duplicate sends unless explicitly forced
        if (booking.finalInvoiceSentAt && !body.force) {
            return createJsonResponse(409, {
                error: 'Sluttfaktura er allerede sendt. Bruk force: true for å sende på nytt.',
                sentAt: booking.finalInvoiceSentAt
            }, request);
        }

        const from = process.env.DEFAULT_FROM_ADDRESS;
        if (!from) {
            context.error('sendFinalInvoice: DEFAULT_FROM_ADDRESS is not set');
            return createJsonResponse(500, { error: 'Manglende e-postkonfigurasjon.' }, request);
        }

        if (!booking.requesterEmail) {
            return createJsonResponse(400, { error: 'Booking mangler e-postadresse.' }, request);
        }

        const depositNOK = booking.depositAmount || 0;
        const totalNOK = booking.totalAmount || depositNOK * 2;
        const extrasTotal = extraItems.reduce((sum, item) => sum + item.amountNOK, 0);
        const grandTotalNOK = totalNOK + extrasTotal;
        const remainingNOK = grandTotalNOK - depositNOK;
        const paymentMethod = booking.paymentMethod || 'bank';
        const bankAccount = process.env.BANK_ACCOUNT || '1822.40.12345';
        const websiteUrl = process.env.WEBSITE_URL || 'https://bjørkvang.no';
        const spaces = Array.isArray(booking.spaces) ? booking.spaces.join(', ') : (booking.spaces || '');
        const services = Array.isArray(booking.services) ? booking.services.join(', ') : (booking.services || '');

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        const dueDateStr = dueDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

        const now = new Date().toISOString();

        // Build itemised rows for the email table
        const itemRows = [];

        // Original package cost
        if (spaces) {
            itemRows.push({ label: `Lokale – ${spaces}`, amount: totalNOK, style: '' });
        }

        // Original services (included in base price – just informational)
        if (services) {
            itemRows.push({ label: `Inkluderte tillegg – ${services}`, amount: null, style: 'color:#6b7280;' });
        }

        // Extra charges added by admin
        for (const item of extraItems) {
            itemRows.push({ label: item.description, amount: item.amountNOK, style: 'color:#b45309;' });
        }

        // Deposit already paid
        itemRows.push({
            label: '− Depositum allerede betalt',
            amount: -depositNOK,
            style: 'color:#059669;'
        });

        const itemRowsHtml = itemRows.map(row => `
            <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;${row.style}">${escapeHtml(row.label)}</td>
                <td style="padding:8px 0;text-align:right;${row.style}">
                    ${row.amount !== null ? `kr ${row.amount.toLocaleString('nb-NO')}` : '(inkludert)'}
                </td>
            </tr>`).join('');

        const itemRowsText = itemRows.map(row =>
            `${row.label}: ${row.amount !== null ? 'kr ' + row.amount.toLocaleString('nb-NO') : '(inkludert)'}`
        ).join('\n');

        let finalInvoiceVippsOrderId = null;
        let vippsUrl = null;
        let emailHtml, emailText, emailSubject;

        const tableHtml = `
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">
                <tr style="border-bottom:2px solid #e5e7eb;font-weight:600;">
                    <td style="padding:8px 0;">Beskrivelse</td>
                    <td style="padding:8px 0;text-align:right;">Beløp</td>
                </tr>
                ${itemRowsHtml}
                <tr style="border-top:2px solid #e5e7eb;">
                    <td style="padding:10px 0;font-weight:600;">Totalt for leieforholdet</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;">kr ${grandTotalNOK.toLocaleString('nb-NO')}</td>
                </tr>
                <tr>
                    <td style="padding:14px 0 0;font-weight:bold;font-size:18px;">Gjenstående å betale</td>
                    <td style="padding:14px 0 0;text-align:right;font-weight:bold;font-size:18px;">kr ${remainingNOK.toLocaleString('nb-NO')}</td>
                </tr>
            </table>`;

        const infoNote = `<p style="font-size:0.88rem;color:#6b7280;margin-top:8px;">
            Depositum (kr ${depositNOK.toLocaleString('nb-NO')}) er allerede betalt og er trukket fra totalbeløpet.
            Depositumet refunderes ikke. Har du spørsmål? Ta kontakt på
            <a href="mailto:styret@bjørkvang.no">styret@bjørkvang.no</a>.
            </p>`;

        if (paymentMethod === 'vipps' && remainingNOK > 0) {
            const safeId = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
            const orderId = `inv-${safeId}-${Date.now().toString(36)}`.slice(0, 50);
            const returnUrl = `${websiteUrl}/booking?invoiceReturn=1&orderId=${encodeURIComponent(orderId)}`;

            try {
                const vippsResponse = await vipps.initiatePayment({
                    amount: remainingNOK * 100, // øre
                    orderId,
                    returnUrl,
                    text: `Sluttfaktura – Bjørkvang (${booking.eventType || 'leie'})`,
                    phoneNumber: booking.phone || undefined
                });
                vippsUrl = vippsResponse.redirectUrl;
                finalInvoiceVippsOrderId = orderId;
            } catch (err) {
                context.error('sendFinalInvoice: Failed to create Vipps payment', err);
                return createJsonResponse(502, { error: 'Kunne ikke opprette Vipps-betaling.' }, request);
            }
        }

        emailSubject = `Sluttfaktura – Bjørkvang (${booking.date || ''})`;

        emailText = [
            `Hei ${booking.requesterName},`,
            '',
            'Takk for at du leide Bjørkvang! Vi håper arrangementet gikk bra.',
            '',
            `Arrangement: ${booking.eventType || ''}  |  Dato: ${booking.date || ''}`,
            '',
            itemRowsText,
            `Totalt for leieforholdet: kr ${grandTotalNOK.toLocaleString('nb-NO')}`,
            `Gjenstående å betale: kr ${remainingNOK.toLocaleString('nb-NO')}`,
            '',
            `Betalingsfrist: ${dueDateStr}`,
            vippsUrl ? `Betal med Vipps: ${vippsUrl}` : `Kontonummer: ${bankAccount}  |  Merk: ${id}`,
            '',
            'Depositum er allerede betalt og trukket fra beløpet.',
            '',
            'Med vennlig hilsen,',
            'Styret ved Bjørkvang'
        ].join('\n');

        const paymentInfoHtml = vippsUrl
            ? `<p>Bruk knappen under for å betale sikkert med Vipps:</p>`
            : `
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:16px 0;">
                    <p style="margin:0 0 8px;font-weight:bold;">Betalingsinformasjon</p>
                    <p style="margin:4px 0;">🏦 <strong>Kontonummer:</strong> ${escapeHtml(bankAccount)}</p>
                    <p style="margin:4px 0;">📋 <strong>Merk betalingen med:</strong> ${escapeHtml(id)}</p>
                    <p style="margin:4px 0;">📅 <strong>Betalingsfrist:</strong> ${escapeHtml(dueDateStr)}</p>
                </div>`;

        emailHtml = generateEmailHtml({
            title: 'Sluttfaktura – Bjørkvang',
            previewText: `Restbeløp kr ${remainingNOK.toLocaleString('nb-NO')} – betalingsfrist ${dueDateStr}`,
            content: `
                <p>Hei ${escapeHtml(booking.requesterName)},</p>
                <p>Takk for at du leide Bjørkvang forsamlingslokale! Vi håper arrangementet gikk bra.</p>
                <p>Her er sluttfakturaen med full oversikt over kostnader:</p>
                ${tableHtml}
                ${paymentInfoHtml}
                ${infoNote}
                <p>Med vennlig hilsen,<br>Styret ved Bjørkvang</p>`,
            ...(vippsUrl ? { action: { text: 'Betal kr ' + remainingNOK.toLocaleString('nb-NO') + ' med Vipps', url: vippsUrl, color: '#ff5b24', rounded: true } } : {})
        });

        try {
            await sendEmail({
                from,
                to: booking.requesterEmail,
                subject: emailSubject,
                html: emailHtml,
                text: emailText
            });
            context.info(`sendFinalInvoice: Invoice sent to ${booking.requesterEmail} for booking ${id}`);
        } catch (err) {
            context.error(`sendFinalInvoice: Failed to send email for booking ${id}`, err);
            return createJsonResponse(500, { error: 'Kunne ikke sende faktura-e-post.' }, request);
        }

        const updateFields = {
            finalInvoiceSentAt: now,
            finalInvoiceAmountNOK: remainingNOK,
            invoiceItems: [
                ...extraItems,
                { description: 'Depositum trukket fra', amountNOK: -depositNOK }
            ]
        };
        if (finalInvoiceVippsOrderId) {
            updateFields.finalInvoiceVippsOrderId = finalInvoiceVippsOrderId;
        }

        // Also set legacy invoiceSentAt for backward compat with existing dashboard checks
        if (!booking.invoiceSentAt) {
            updateFields.invoiceSentAt = now;
        }

        const updated = await updateBookingFields(id.trim(), null, updateFields);

        return createJsonResponse(200, {
            message: 'Sluttfaktura sendt.',
            sentTo: booking.requesterEmail,
            remainingAmount: remainingNOK,
            dueDate: dueDateStr,
            paymentMethod,
            ...(vippsUrl ? { vippsUrl } : {}),
            booking: updated || booking
        }, request);
    }
});
