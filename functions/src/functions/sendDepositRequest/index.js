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
 * Send a deposit payment request to the booking requester.
 * POST /api/booking/send-deposit
 * Body: { id }
 *
 * - If booking.paymentMethod === 'vipps': creates a Vipps payment link and emails it.
 * - If 'bank': emails bank account details.
 * Idempotent: returns 200 if depositRequested is already true.
 */
app.http('sendDepositRequest', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/send-deposit',
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

        const booking = await getBooking(id.trim());
        if (!booking) {
            return createJsonResponse(404, { error: 'Booking not found.' }, request);
        }

        if (booking.status !== 'approved') {
            return createJsonResponse(409, {
                error: 'Booking must be approved before sending a deposit request.'
            }, request);
        }

        // Idempotent — safe to call again, returns current state
        if (booking.depositRequested) {
            return createJsonResponse(200, {
                message: 'Depositumforespørsel allerede sendt.',
                booking
            }, request);
        }

        const from = process.env.DEFAULT_FROM_ADDRESS;
        if (!from) {
            context.error('sendDepositRequest: DEFAULT_FROM_ADDRESS is not set');
            return createJsonResponse(500, { error: 'Manglende e-postkonfigurasjon.' }, request);
        }

        if (!booking.requesterEmail) {
            return createJsonResponse(400, { error: 'Booking mangler e-postadresse.' }, request);
        }

        const totalNOK = booking.totalAmount || 0;
        const depositNOK = Math.round(totalNOK * 0.5);
        const remainingNOK = totalNOK - depositNOK;
        const paymentMethod = booking.paymentMethod || 'bank';
        const bankAccount = process.env.BANK_ACCOUNT || '1822.40.12345';
        const websiteUrl = process.env.WEBSITE_URL || 'https://bjørkvang.no';
        const spaces = Array.isArray(booking.spaces) ? booking.spaces.join(', ') : (booking.spaces || '');
        const now = new Date().toISOString();

        const summaryTable = `
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">
                <tr style="border-bottom:1px solid #e5e7eb;">
                    <td style="padding:8px 0;color:#6b7280;">Arrangement</td>
                    <td style="padding:8px 0;text-align:right;">${escapeHtml(booking.eventType || '')}</td>
                </tr>
                <tr style="border-bottom:1px solid #e5e7eb;">
                    <td style="padding:8px 0;color:#6b7280;">Dato</td>
                    <td style="padding:8px 0;text-align:right;">${escapeHtml(booking.date || '')}</td>
                </tr>
                <tr style="border-bottom:1px solid #e5e7eb;">
                    <td style="padding:8px 0;color:#6b7280;">Lokaler</td>
                    <td style="padding:8px 0;text-align:right;">${escapeHtml(spaces)}</td>
                </tr>
                <tr style="border-bottom:1px solid #e5e7eb;">
                    <td style="padding:8px 0;color:#6b7280;">Estimert totalpris</td>
                    <td style="padding:8px 0;text-align:right;">kr ${totalNOK.toLocaleString('nb-NO')}</td>
                </tr>
                <tr>
                    <td style="padding:12px 0;font-weight:bold;font-size:17px;">Depositum å betale nå (50&nbsp;%)</td>
                    <td style="padding:12px 0;text-align:right;font-weight:bold;font-size:17px;">kr ${depositNOK.toLocaleString('nb-NO')}</td>
                </tr>
            </table>
            <p style="font-size:0.88rem;color:#6b7280;">
                Restbeløpet (kr ${remainingNOK.toLocaleString('nb-NO')}) faktureres etter arrangementet.
                Depositum er ikke refunderbart ved kansellering uten saklig grunn.
            </p>`;

        let depositVippsOrderId = null;
        let vippsUrl = null;
        let emailHtml, emailText, emailSubject;

        if (paymentMethod === 'vipps') {
            // Sanitise booking ID for Vipps reference (alphanumeric only, max 50 chars)
            const safeId = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
            const orderId = `dep-${safeId}-${Date.now().toString(36)}`.slice(0, 50);
            const returnUrl = `${websiteUrl}/booking?depositReturn=1&orderId=${encodeURIComponent(orderId)}`;

            try {
                const vippsResponse = await vipps.initiatePayment({
                    amount: depositNOK * 100, // øre
                    orderId,
                    returnUrl,
                    text: `Depositum – Bjørkvang (${booking.eventType || 'leie'})`,
                    phoneNumber: booking.phone || undefined
                });
                vippsUrl = vippsResponse.redirectUrl;
                depositVippsOrderId = orderId;
            } catch (err) {
                context.error('sendDepositRequest: Failed to create Vipps payment', err);
                return createJsonResponse(502, { error: 'Kunne ikke opprette Vipps-betaling.' }, request);
            }

            emailSubject = `Depositumforespørsel – Bjørkvang leie (${booking.date || ''})`;
            emailText = [
                `Hei ${booking.requesterName},`,
                '',
                'Din bookingforespørsel er godkjent! For å sikre datoen ber vi deg betale 50 % depositum via Vipps.',
                '',
                `Arrangement: ${booking.eventType || ''}`,
                `Dato: ${booking.date || ''}`,
                `Lokaler: ${spaces}`,
                `Estimert totalpris: kr ${totalNOK.toLocaleString('nb-NO')}`,
                `Depositum nå (50%): kr ${depositNOK.toLocaleString('nb-NO')}`,
                '',
                `Betal med Vipps: ${vippsUrl}`,
                '',
                `Restbeløpet (kr ${remainingNOK.toLocaleString('nb-NO')}) faktureres etter arrangementet.`,
                'Depositum er ikke refunderbart ved kansellering uten saklig grunn.',
                '',
                'Med vennlig hilsen,',
                'Styret ved Bjørkvang'
            ].join('\n');

            emailHtml = generateEmailHtml({
                title: 'Depositumforespørsel – Bjørkvang',
                previewText: `Betal depositum kr ${depositNOK.toLocaleString('nb-NO')} for din booking`,
                content: `
                    <p>Hei ${escapeHtml(booking.requesterName)},</p>
                    <p>🎉 Din bookingforespørsel er godkjent! For å sikre datoen ber vi deg betale
                    <strong>50&nbsp;% depositum</strong> innen 5 dager.</p>
                    ${summaryTable}
                    <p>Har du spørsmål, ta kontakt med oss på
                    <a href="mailto:styret@bjørkvang.no">styret@bjørkvang.no</a>.</p>
                    <p>Med vennlig hilsen,<br>Styret ved Bjørkvang</p>`,
                action: { text: '💳 Betal depositum med Vipps', url: vippsUrl }
            });
        } else {
            // Bank transfer
            emailSubject = `Depositumforespørsel – Bjørkvang leie (${booking.date || ''})`;
            emailText = [
                `Hei ${booking.requesterName},`,
                '',
                'Din bookingforespørsel er godkjent! For å sikre datoen ber vi deg betale 50 % depositum via bankoverføring innen 5 dager.',
                '',
                `Arrangement: ${booking.eventType || ''}`,
                `Dato: ${booking.date || ''}`,
                `Lokaler: ${spaces}`,
                `Estimert totalpris: kr ${totalNOK.toLocaleString('nb-NO')}`,
                `Depositum nå (50%): kr ${depositNOK.toLocaleString('nb-NO')}`,
                '',
                `Kontonummer: ${bankAccount}`,
                `Merk betalingen med: ${id}`,
                'Betalingsfrist: 5 dager',
                '',
                `Restbeløpet (kr ${remainingNOK.toLocaleString('nb-NO')}) faktureres etter arrangementet.`,
                'Depositum er ikke refunderbart ved kansellering uten saklig grunn.',
                '',
                'Med vennlig hilsen,',
                'Styret ved Bjørkvang'
            ].join('\n');

            emailHtml = generateEmailHtml({
                title: 'Depositumforespørsel – Bjørkvang',
                previewText: `Betal depositum kr ${depositNOK.toLocaleString('nb-NO')} – kontonr. ${bankAccount}`,
                content: `
                    <p>Hei ${escapeHtml(booking.requesterName)},</p>
                    <p>🎉 Din bookingforespørsel er godkjent! For å sikre datoen ber vi deg betale
                    <strong>50&nbsp;% depositum</strong> via bankoverføring innen 5 dager.</p>
                    ${summaryTable}
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:16px 0;">
                        <p style="margin:0 0 8px;font-weight:bold;">Betalingsinformasjon</p>
                        <p style="margin:4px 0;">🏦 <strong>Kontonummer:</strong> ${escapeHtml(bankAccount)}</p>
                        <p style="margin:4px 0;">📋 <strong>Merk betalingen med:</strong> ${escapeHtml(id)}</p>
                        <p style="margin:4px 0;">📅 <strong>Betalingsfrist:</strong> 5 dager</p>
                    </div>
                    <p>Har du spørsmål, ta kontakt med oss på
                    <a href="mailto:styret@bjørkvang.no">styret@bjørkvang.no</a>.</p>
                    <p>Med vennlig hilsen,<br>Styret ved Bjørkvang</p>`
            });
        }

        try {
            await sendEmail({
                from,
                to: booking.requesterEmail,
                subject: emailSubject,
                html: emailHtml,
                text: emailText
            });
        } catch (err) {
            context.error('sendDepositRequest: Failed to send email', err);
            return createJsonResponse(500, { error: 'Kunne ikke sende e-post.' }, request);
        }

        const updateFields = {
            depositRequested: true,
            depositRequestedAt: now,
            depositAmount: depositNOK
        };
        if (depositVippsOrderId) {
            updateFields.depositVippsOrderId = depositVippsOrderId;
        }

        const updated = await updateBookingFields(id.trim(), null, updateFields);
        context.info(`sendDepositRequest: sent to ${booking.requesterEmail} for booking ${id} via ${paymentMethod}`);

        return createJsonResponse(200, {
            message: 'Depositumforespørsel sendt.',
            sentTo: booking.requesterEmail,
            depositAmount: depositNOK,
            paymentMethod,
            ...(vippsUrl ? { vippsUrl } : {}),
            booking: updated || booking
        }, request);
    }
});
