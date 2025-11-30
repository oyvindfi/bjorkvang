const { app } = require('@azure/functions');
const { getBooking } = require('../../../shared/cosmosDb');
const { createJsonResponse } = require('../../../shared/http');

app.http('getBooking', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const id = request.query.get('id');

        if (!id) {
            return createJsonResponse(400, { message: 'Missing booking ID' }, request);
        }

        try {
            // We don't have the partition key (date) in the URL, so we rely on the 
            // cross-partition query implemented in cosmosDb.getBooking(id, null)
            const booking = await getBooking(id, null);

            if (!booking) {
                return createJsonResponse(404, { message: 'Booking not found' }, request);
            }

            // Return the booking details
            return createJsonResponse(200, booking, request);

        } catch (error) {
            context.error(`Error fetching booking ${id}:`, error);
            return createJsonResponse(500, { message: 'Internal server error' }, request);
        }
    }
});
