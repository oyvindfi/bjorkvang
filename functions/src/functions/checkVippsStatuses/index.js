const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');
const { listBookings, updateBookingFields } = require('../../../shared/cosmosDb');
const vipps = require('../../../shared/vipps');
const { sendEmail } = require('../../../shared/email');
const { generateEmailHtml } = require('../../../shared/emailTemplate');

/**
 * Check Vipps payment statuses for all bookings with pending Vipps payments.
 * Called automatically when admin loads the dashboard.
 * POST /api/booking/check-vipps-statuses
 *
 * Checks:
 *  - depositVippsOrderId  → sets depositPaid / depositPaidAt
 *  - finalInvoiceVippsOrderId → sets finalInvoicePaid / finalInvoicePaidAt
 *
 * Returns the updated booking list so the dashboard can re-render without
 * a second fetch.
 */
app.http('checkVippsStatuses', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/check-vipps-statuses',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        const now = new Date().toISOString();
        let allBookings = [];
        try {
            allBookings = await listBookings();
        } catch (err) {
            context.error('checkVippsStatuses: Failed to list bookings', err);
            return createJsonResponse(500, { error: 'Kunne ikke hente bookinger.' }, request);
        }

        const updatedIds = [];

        // Only bookings that have a Vipps order we haven't confirmed yet
        const pending = allBookings.filter(b =>
            (b.depositVippsOrderId && !b.depositPaid) ||
            (b.finalInvoiceVippsOrderId && !b.finalInvoicePaid)
        );

        for (const booking of pending) {
            // --- Deposit ---
            if (booking.depositVippsOrderId && !booking.depositPaid) {
                try {
                    const payment = await vipps.getPayment(booking.depositVippsOrderId);
                    const state = payment.state || (payment.aggregate && payment.aggregate.capturedAmount > 0 ? 'CAPTURED' : null);
                    if (state === 'AUTHORIZED' || state === 'CAPTURED') {
                        await updateBookingFields(booking.id, null, {
                            depositPaid: true,
                            depositPaidAt: now
                        });
                        updatedIds.push({ id: booking.id, field: 'depositPaid' });
                        context.info(`checkVippsStatuses: depositPaid set for ${booking.id}`);

                        // Send receipt email
                        const from = process.env.DEFAULT_FROM_ADDRESS;
                        if (from && booking.requesterEmail) {
                            try {
                                const depositNOK = Number(booking.depositAmount) || 0;
                                const depositStr = depositNOK
                                    ? `kr\u00a0${depositNOK.toLocaleString('nb-NO')}`
                                    : 'Forhåndsbetaling';
                                const paidAt = new Date(now).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
                                const dateObj = new Date(`${booking.date}T00:00:00`);
                                const eventDate = !isNaN(dateObj)
                                    ? dateObj.toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                    : (booking.date || '');
                                const html = generateEmailHtml({
                                    title: 'Forhåndsbetaling mottatt \u2705',
                                    previewText: `Vi har mottatt ${depositStr} \u2013 bookingen din er bekreftet.`,
                                    content: `
                                        <p>Hei ${booking.requesterName || ''},</p>
                                        <p>Vi har mottatt <strong>${depositStr}</strong> via Vipps. Bookingen din er n\u00e5 bekreftet.</p>
                                        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">
                                            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Kvitteringsdato</td><td style="padding:8px 0;text-align:right;">${paidAt}</td></tr>
                                            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Bel\u00f8p</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#166534;">${depositStr}</td></tr>
                                            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Betaling</td><td style="padding:8px 0;text-align:right;">Vipps</td></tr>
                                            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Arrangement</td><td style="padding:8px 0;text-align:right;">${eventDate}</td></tr>
                                            <tr><td style="padding:8px 0;color:#6b7280;">Booking-ID</td><td style="padding:8px 0;text-align:right;font-family:monospace;font-size:0.85rem;">${booking.id}</td></tr>
                                        </table>
                                        <p style="color:#4b5563;font-size:0.9rem;">Restbel\u00f8pet faktureres etter at arrangementet er avholdt.</p>
                                        <p style="font-size:0.9em;color:#6b7280;">Sp\u00f8rsm\u00e5l? Ta kontakt p\u00e5 <a href="mailto:styret@bj\u00f8rkvang.no" style="color:#1a823b;">styret@bj\u00f8rkvang.no</a>.</p>
                                    `
                                });
                                await sendEmail({
                                    to: booking.requesterEmail.trim(),
                                    from,
                                    subject: `Kvittering \u2013 Forhåndsbetaling mottatt (${depositStr})`,
                                    text: `Hei ${booking.requesterName || ''}!\n\nVi har mottatt ${depositStr} via Vipps. Bookingen din er bekreftet.\n\nRestbel\u00f8pet faktureres etter arrangementet.\n\nVennlig hilsen\nHelg\u00f8ens Vel`,
                                    html,
                                });
                                context.info(`checkVippsStatuses: Deposit receipt sent to ${booking.requesterEmail}`);
                            } catch (mailErr) {
                                context.warn(`checkVippsStatuses: Could not send deposit receipt for ${booking.id}`, { error: mailErr.message });
                            }
                        }
                    }
                } catch (err) {
                    context.warn(`checkVippsStatuses: Could not check deposit for ${booking.id}: ${err.message}`);
                }
            }

            // --- Final invoice ---
            if (booking.finalInvoiceVippsOrderId && !booking.finalInvoicePaid) {
                try {
                    const payment = await vipps.getPayment(booking.finalInvoiceVippsOrderId);
                    const state = payment.state || (payment.aggregate && payment.aggregate.capturedAmount > 0 ? 'CAPTURED' : null);
                    if (state === 'AUTHORIZED' || state === 'CAPTURED') {
                        await updateBookingFields(booking.id, null, {
                            finalInvoicePaid: true,
                            finalInvoicePaidAt: now
                        });
                        updatedIds.push({ id: booking.id, field: 'finalInvoicePaid' });
                        context.info(`checkVippsStatuses: finalInvoicePaid set for ${booking.id}`);
                    }
                } catch (err) {
                    context.warn(`checkVippsStatuses: Could not check final invoice for ${booking.id}: ${err.message}`);
                }
            }
        }

        // Re-fetch so caller gets fully updated data in one round-trip
        let freshBookings = allBookings;
        if (updatedIds.length > 0) {
            try {
                freshBookings = await listBookings();
            } catch (err) {
                context.warn('checkVippsStatuses: Re-fetch after updates failed; returning stale data', err);
            }
        }

        return createJsonResponse(200, {
            message: 'Vipps status check complete.',
            updatedCount: updatedIds.length,
            updated: updatedIds,
            bookings: freshBookings
        }, request);
    }
});
