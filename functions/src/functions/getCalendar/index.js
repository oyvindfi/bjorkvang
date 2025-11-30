const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');
const { listBookings } = require('../../../shared/cosmosDb');

/**
 * Public calendar endpoint. Masks requester details and only exposes availability.
 */
app.http('getCalendar', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'booking/calendar',
    handler: async (request, context) => {
        context.log('getCalendar: Handling public calendar request');
        
        try {
            const allBookings = await listBookings();
            
            // Only expose minimal information for public calendar
            const bookings = allBookings.map((booking) => ({
                id: booking.id,
                date: booking.date,
                time: booking.time,
                duration: booking.duration,
                status: booking.status === 'approved' ? 'confirmed' : booking.status,
            }));
            
            context.log(`getCalendar: Successfully retrieved ${bookings.length} bookings`);
            return createJsonResponse(200, { bookings }, request);
        } catch (error) {
            context.log.error('getCalendar: Failed to retrieve calendar bookings', {
                error: error.message,
                stack: error.stack
            });
            return createJsonResponse(500, {
                error: 'Kunne ikke hente kalenderdata. Vennligst prøv igjen senere.',
            }, request);
        }
    },
});
