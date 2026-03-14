const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');
const { getBooking, updateBookingFields } = require('../../../shared/cosmosDb');
const { sendEmail } = require('../../../shared/email');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

/**
 * Mark a booking's deposit as received (manual confirmation by admin).
 * POST /api/booking/deposit-paid?id={id}
 */
app.http('depositPaid', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/deposit-paid',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        const id = request.query.get('id');

        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            context.warn('depositPaid called with missing or invalid ID');
            return createJsonResponse(400, { error: 'Missing booking id.' }, request);
        }

        const booking = await getBooking(id.trim());
        if (!booking) {
            context.warn(`depositPaid: Booking not found for ID: ${id}`);
            return createJsonResponse(404, { error: 'Booking not found.' }, request);
        }

        if (booking.depositPaid) {
            context.info(`depositPaid: Deposit already marked as paid for booking ${id}`);
            return createJsonResponse(200, { message: 'Depositum allerede registrert som betalt.', booking }, request);
        }

        const updated = await updateBookingFields(id.trim(), null, {
            depositPaid: true,
            depositPaidAt: new Date().toISOString()
        });

        if (!updated) {
            context.error(`depositPaid: Failed to update booking ${id}`);
            return createJsonResponse(500, { error: 'Kunne ikke oppdatere bestillingen.' }, request);
        }

        context.info(`depositPaid: Marked deposit as paid for booking ${id}`);

        // Send receipt email to requester
        const from = process.env.DEFAULT_FROM_ADDRESS;
        if (from && updated.requesterEmail) {
            try {
                const depositNOK = Number(updated.depositAmount) || 0;
                const depositStr = depositNOK
                    ? `kr\u00a0${depositNOK.toLocaleString('nb-NO')}`
                    : 'depositum';
                const paidAt = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
                const dateObj = new Date(`${updated.date}T00:00:00`);
                const eventDate = !isNaN(dateObj)
                    ? dateObj.toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : (updated.date || '');
                const html = generateEmailHtml({
                    title: 'Depositum mottatt \u2705',
                    previewText: `Vi har mottatt ${depositStr} \u2013 bookingen din er bekreftet.`,
                    content: `
                        <p>Hei ${updated.requesterName || ''},</p>
                        <p>Vi har mottatt <strong>${depositStr}</strong> i depositum. Bookingen din er n\u00e5 bekreftet.</p>
                        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">
                            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Kvitteringsdato</td><td style="padding:8px 0;text-align:right;">${paidAt}</td></tr>
                            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Bel\u00f8p</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#166534;">${depositStr}</td></tr>
                            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Arrangement</td><td style="padding:8px 0;text-align:right;">${eventDate}</td></tr>
                            <tr><td style="padding:8px 0;color:#6b7280;">Booking-ID</td><td style="padding:8px 0;text-align:right;font-family:monospace;font-size:0.85rem;">${updated.id}</td></tr>
                        </table>
                        <p style="color:#4b5563;font-size:0.9rem;">Restbel\u00f8pet faktureres etter at arrangementet er avholdt.</p>
                        <p style="font-size:0.9em;color:#6b7280;">Sp\u00f8rsm\u00e5l? Ta kontakt p\u00e5 <a href="mailto:styret@bj\u00f8rkvang.no" style="color:#1a823b;">styret@bj\u00f8rkvang.no</a>.</p>
                    `
                });
                await sendEmail({
                    to: updated.requesterEmail.trim(),
                    from,
                    subject: `Kvittering \u2013 depositum mottatt (${depositStr})`,
                    text: `Hei ${updated.requesterName || ''}!\n\nVi har mottatt ${depositStr} i depositum. Bookingen din er bekreftet.\n\nRestbel\u00f8pet faktureres etter arrangementet.\n\nVennlig hilsen\nHelg\u00f8ens Vel`,
                    html,
                });
                context.info(`depositPaid: Receipt sent to ${updated.requesterEmail}`);
            } catch (mailErr) {
                context.warn('depositPaid: Could not send receipt email', { error: mailErr.message });
            }
        }

        return createJsonResponse(200, { message: 'Depositum registrert som betalt.', booking: updated }, request);
    }
});
