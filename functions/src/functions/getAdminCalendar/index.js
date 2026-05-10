const { app } = require('@azure/functions');
const { createJsonResponse, requireAdminKey } = require('../../../shared/http');
const { listBookings } = require('../../../shared/cosmosDb');

/**
 * Admin calendar endpoint with full requester visibility.
 */
app.http('getAdminCalendar', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'booking/admin',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        const authError = requireAdminKey(request);
        if (authError) return authError;

        context.log('Handling getAdminCalendar request');

        try {
            const bookings = await listBookings();
            context.log(`Successfully retrieved ${bookings.length} bookings for admin calendar.`);
            return createJsonResponse(200, { bookings }, request);
        } catch (error) {
            context.log.error('Failed to retrieve admin calendar bookings', error);
            return createJsonResponse(500, {
                error: 'Kunne ikke hente booking-data. Vennligst prøv igjen senere.',
            }, request);
        }
    },
});
