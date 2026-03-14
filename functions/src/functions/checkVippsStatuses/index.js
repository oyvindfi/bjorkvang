const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');
const { listBookings, updateBookingFields } = require('../../../shared/cosmosDb');
const vipps = require('../../../shared/vipps');

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
