const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');
const { getBooking, updateBookingFields } = require('../../../shared/cosmosDb');
const { sendEmail } = require('../../../shared/email');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

/**
 * Mark a booking's final invoice as paid (manual confirmation by admin).
 * POST /api/booking/final-invoice-paid?id={id}
 */
app.http('finalInvoicePaid', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/final-invoice-paid',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        const id = request.query.get('id');

        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            context.warn('finalInvoicePaid called with missing or invalid ID');
            return createJsonResponse(400, { error: 'Missing booking id.' }, request);
        }

        const booking = await getBooking(id.trim());
        if (!booking) {
            context.warn(`finalInvoicePaid: Booking not found for ID: ${id}`);
            return createJsonResponse(404, { error: 'Booking not found.' }, request);
        }

        if (booking.finalInvoicePaid) {
            context.info(`finalInvoicePaid: Already marked as paid for booking ${id}`);
            return createJsonResponse(200, { message: 'Sluttfaktura allerede registrert som betalt.', booking }, request);
        }

        const updated = await updateBookingFields(id.trim(), null, {
            finalInvoicePaid: true,
            finalInvoicePaidAt: new Date().toISOString()
        });

        if (!updated) {
            context.error(`finalInvoicePaid: Failed to update booking ${id}`);
            return createJsonResponse(500, { error: 'Kunne ikke oppdatere bestillingen.' }, request);
        }

        context.info(`finalInvoicePaid: Marked final invoice as paid for booking ${id}`);

        // Send receipt email to requester
        const from = process.env.DEFAULT_FROM_ADDRESS;
        if (from && updated.requesterEmail) {
            try {
                const invoiceNOK = Number(updated.finalInvoiceAmountNOK) || 0;
                const invoiceStr = invoiceNOK
                    ? `kr\u00a0${invoiceNOK.toLocaleString('nb-NO')}`
                    : 'sluttbeløpet';
                const paidAt = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
                const dateObj = new Date(`${updated.date}T00:00:00`);
                const eventDate = !isNaN(dateObj)
                    ? dateObj.toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : (updated.date || '');

                const depositNOK = Number(updated.depositAmount) || 0;
                const totalNOK = Number(updated.totalAmount) || 0;

                const html = generateEmailHtml({
                    title: 'Sluttoppgjør mottatt \u2705',
                    previewText: `Vi har mottatt ${invoiceStr} \u2013 takk for leien!`,
                    content: `
                        <p>Hei ${updated.requesterName || ''},</p>
                        <p>Vi har mottatt sluttoppgjøret for ditt arrangement. Alt er nå betalt \u2013 tusen takk!</p>
                        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">
                            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Kvitteringsdato</td><td style="padding:8px 0;text-align:right;">${paidAt}</td></tr>
                            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Arrangement</td><td style="padding:8px 0;text-align:right;">${eventDate}</td></tr>
                            ${totalNOK ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Total leiesum</td><td style="padding:8px 0;text-align:right;">kr\u00a0${totalNOK.toLocaleString('nb-NO')}</td></tr>` : ''}
                            ${depositNOK ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Depositum (betalt)</td><td style="padding:8px 0;text-align:right;">kr\u00a0${depositNOK.toLocaleString('nb-NO')}</td></tr>` : ''}
                            <tr><td style="padding:8px 0;color:#6b7280;">Sluttoppgjør</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#166534;">${invoiceStr}</td></tr>
                        </table>
                        <p style="color:#4b5563;">Vi håper arrangementet var vellykket, og ønsker deg velkommen tilbake!</p>
                        <p style="font-size:0.9em;color:#6b7280;">Spørsmål? Ta kontakt på <a href="mailto:styret@bjørkvang.no" style="color:#1a823b;">styret@bjørkvang.no</a>.</p>
                    `
                });
                await sendEmail({
                    to: updated.requesterEmail.trim(),
                    from,
                    subject: `Kvittering \u2013 sluttoppgjør mottatt`,
                    text: `Hei ${updated.requesterName || ''}!\n\nVi har mottatt sluttoppgjøret (${invoiceStr}) for ditt arrangement ${eventDate}. Alt er nå betalt.\n\nTusen takk!\n\nVennlig hilsen\nHelgøens Vel`,
                    html,
                });
                context.info(`finalInvoicePaid: Receipt sent to ${updated.requesterEmail}`);
            } catch (mailErr) {
                context.warn('finalInvoicePaid: Could not send receipt email', { error: mailErr.message });
            }
        }

        return createJsonResponse(200, { message: 'Sluttfaktura registrert som betalt.', booking: updated }, request);
    }
});
