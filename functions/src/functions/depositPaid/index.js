const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');
const { getBooking, updateBookingFields } = require('../../../shared/cosmosDb');

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
        return createJsonResponse(200, { message: 'Depositum registrert som betalt.', booking: updated }, request);
    }
});
