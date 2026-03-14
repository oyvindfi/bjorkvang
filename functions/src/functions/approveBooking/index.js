const { app } = require('@azure/functions');
const { sendEmail } = require('../../../shared/email');
const { createHtmlResponse, createJsonResponse } = require('../../../shared/http');
const { getBooking, updateBookingStatus } = require('../../../shared/cosmosDb');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

/**
 * Approve a booking via a direct link.
 */
app.http('approveBooking', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/approve',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        const id = request.query.get('id');
        const isApiRequest = request.method === 'POST' || request.headers.get('accept')?.includes('application/json');
        
        // Validate booking ID
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            context.warn('approveBooking called with invalid or missing ID');
            return createJsonResponse(400, { error: 'Missing booking id.' }, request);
        }

        const existingBooking = await getBooking(id.trim());
        if (!existingBooking) {
            context.warn(`approveBooking: Booking not found for ID: ${id}`);
            return createJsonResponse(404, { error: 'Booking not found.' }, request);
        }

        if (existingBooking.status === 'approved') {
            context.info(`approveBooking: Booking ${id} was already approved`);
            if (isApiRequest) {
                return createJsonResponse(200, { message: 'Booking was already approved.' }, request);
            }
            return createHtmlResponse(200, '<p>Booking var allerede godkjent. Bekreftelse er tidligere sendt.</p>', request);
        }

        const updatedBooking = await updateBookingStatus(id.trim(), null, 'approved');
        if (!updatedBooking) {
            context.error(`approveBooking: Failed to update booking status for ID: ${id}`);
            return createJsonResponse(500, { error: 'Failed to approve booking.' }, request);
        }
        
        context.info(`approveBooking: Successfully approved booking ${id} for ${existingBooking.requesterEmail}`);

        try {
            const from = process.env.DEFAULT_FROM_ADDRESS;
            if (!from) {
                context.warn('approveBooking: DEFAULT_FROM_ADDRESS is not set. Skipping confirmation email.');
            } else if (!existingBooking.requesterEmail || typeof existingBooking.requesterEmail !== 'string') {
                context.error('approveBooking: Invalid requester email in booking');
            } else {
                // Escape HTML to prevent XSS
                const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                })[m]);
                
                const safeName = escapeHtml(existingBooking.requesterName || 'Bruker');
                const safeDate = escapeHtml(existingBooking.date || '');
                const safeTime = escapeHtml(existingBooking.time || '');
                const safeEventType = escapeHtml(existingBooking.eventType || 'Reservasjon');
                const safeSpaces = escapeHtml(
                    Array.isArray(existingBooking.spaces)
                        ? existingBooking.spaces.join(', ')
                        : (existingBooking.spaces || 'Ikke oppgitt')
                );
                const safeDuration = Number(existingBooking.duration) || 0;
                const paymentMethod = existingBooking.paymentMethod || 'bank';
                const bankAccount = process.env.BANK_ACCOUNT || '(kontonummer sendes separat)';

                // Format date nicely in Norwegian
                const dateObj = new Date(`${existingBooking.date}T00:00:00`);
                const formattedDate = !isNaN(dateObj)
                    ? dateObj.toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : safeDate;

                // Deposit amount: prefer stored depositAmount (NOK), fall back to 50% of totalAmount
                const totalNOK = existingBooking.totalAmount || (existingBooking.paymentAmount ? existingBooking.paymentAmount / 100 : 0);
                const depositNOK = existingBooking.depositAmount || (totalNOK ? Math.round(totalNOK * 0.5) : null);
                const depositStr = depositNOK
                    ? `kr\u00a0${depositNOK.toLocaleString('nb-NO')}`
                    : '(beregnes av styret)';
                const totalStr = totalNOK
                    ? `kr\u00a0${totalNOK.toLocaleString('nb-NO')}`
                    : '(beregnes av styret)';

                // Payment instructions block
                const paymentBlock = paymentMethod === 'vipps'
                    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:20px 0;">
                        <p style="margin:0 0 8px;font-weight:700;color:#166534;">💸 Depositum via Vipps</p>
                        <p style="margin:0 0 6px;color:#166534;">Du vil snart motta en Vipps-betalingsforespørsel på <strong>${depositStr}</strong> fra styret.</p>
                        <p style="margin:0;font-size:0.88em;color:#4b5563;">Beløpet dekker 50\u00a0% av leiesummen og forfaller innen 5\u00a0dager. Restbeløp faktureres etter arrangementet.</p>
                      </div>`
                    : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:20px 0;">
                        <p style="margin:0 0 8px;font-weight:700;color:#166534;">🏦 Depositum via bankinnbetaling</p>
                        <p style="margin:0 0 6px;color:#166534;">Betal <strong>${depositStr}</strong> til kontonummer <strong>${bankAccount}</strong>.</p>
                        <p style="margin:0 0 6px;color:#166534;">Merk betalingen med booking-ID: <code style="background:#e6f4ea;padding:2px 6px;border-radius:4px;">${existingBooking.id}</code></p>
                        <p style="margin:0;font-size:0.88em;color:#4b5563;">Beløpet dekker 50\u00a0% av leiesummen og forfaller innen 5\u00a0dager. Restbeløp faktureres etter arrangementet.</p>
                      </div>`;

                // Generate contract link
                const websiteUrl = process.env.WEBSITE_URL || 'https://bjørkvang.no';
                const contractLink = `${websiteUrl}/leieavtale.html?id=${existingBooking.id}`;

                const htmlContent = `
                    <p>Hei ${safeName},</p>
                    <p>Gode nyheter! Din bookingforespørsel er godkjent 🎉</p>

                    <ul class="info-list">
                        <li><span class="info-label">Dato</span> <span class="info-value">${formattedDate}</span></li>
                        <li><span class="info-label">Tid</span> <span class="info-value">kl.&nbsp;${safeTime}${safeDuration ? ` (${safeDuration}&nbsp;timer)` : ''}</span></li>
                        <li><span class="info-label">Formål</span> <span class="info-value">${safeEventType}</span></li>
                        <li><span class="info-label">Lokale</span> <span class="info-value">${safeSpaces}</span></li>
                        <li><span class="info-label">Estimert leiesum</span> <span class="info-value">${totalStr}</span></li>
                        <li><span class="info-label">Depositum (50\u00a0%)</span> <span class="info-value">${depositStr}</span></li>
                    </ul>

                    <h3 style="margin:24px 0 4px;font-size:1rem;color:#1f2937;">Steg 1 – Signer leieavtalen</h3>
                    <p style="margin:0 0 4px;">Les gjennom og signer leieavtalen digitalt ved å klikke på knappen under. Dette låser inn bookingen.</p>

                    <h3 style="margin:24px 0 4px;font-size:1rem;color:#1f2937;">Steg 2 – Betal depositum</h3>
                    ${paymentBlock}

                    <h3 style="margin:24px 0 4px;font-size:1rem;color:#1f2937;">Steg 3 – Etter arrangementet</h3>
                    <p style="margin:0 0 16px;">Styret sender sluttfaktura for restbeløpet etter at arrangementet er avholdt.</p>

                    <p style="font-size:0.9em;color:#6b7280;">Spørsmål? Svar på denne e-posten eller ta kontakt på <a href="mailto:styret@bjørkvang.no" style="color:#1a823b;">styret@bjørkvang.no</a>.</p>
                `;

                const html = generateEmailHtml({
                    title: 'Din booking er godkjent',
                    content: htmlContent,
                    action: {
                        text: 'Signer leieavtale',
                        url: contractLink
                    },
                    previewText: `Booking godkjent! Signer avtalen og betal depositum ${depositStr} for ${formattedDate}.`
                });

                const paymentTextInstructions = paymentMethod === 'vipps'
                    ? `Du vil motta en Vipps-betalingsforespørsel på ${depositStr}.`
                    : `Betal depositum ${depositStr} til kontonummer ${bankAccount}. Merk med: ${existingBooking.id}`;

                await sendEmail({
                    to: existingBooking.requesterEmail.trim(),
                    from,
                    subject: `Booking godkjent – ${formattedDate}`,
                    text: `Hei ${safeName}!\n\nDin booking for ${formattedDate} kl. ${safeTime} er godkjent.\n\nSteg 1 – Signer leieavtalen:\n${contractLink}\n\nSteg 2 – Betal depositum:\n${paymentTextInstructions}\n\nRestbeløpet faktureres etter arrangementet.\n\nVennlig hilsen\nHelgøens Vel`,
                    html: html,
                });
                context.info(`approveBooking: Confirmation email with contract link sent to ${existingBooking.requesterEmail}`);
            }
        } catch (error) {
            context.error('approveBooking: Failed to send booking approval email', {
                error: error.message,
                stack: error.stack,
                bookingId: id
            });
        }

        if (isApiRequest) {
            return createJsonResponse(200, { message: 'Booking approved successfully.' }, request);
        }
        return createHtmlResponse(200, '<p>Booking er nå godkjent og bekreftelse med kontraktlenke er sendt til forespørrer.</p>', request);
    },
});
