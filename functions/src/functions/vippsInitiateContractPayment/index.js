const { app } = require('@azure/functions');
const { createJsonResponse, parseBody, resolveBaseUrl } = require('../../../shared/http');
const { initiatePayment } = require('../../../shared/vipps');
const { getBooking } = require('../../../shared/cosmosDb');

/**
 * Initiate Vipps payment for a booking after contract has been signed.
 * Uses the stored paymentAmount from the booking record.
 */
app.http('vippsInitiateContractPayment', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'vipps/initiate-contract-payment',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const { bookingId, phoneNumber } = body;

            if (!bookingId) {
                return createJsonResponse(400, { error: 'bookingId is required' });
            }

            // Fetch the booking to get payment amount
            const booking = await getBooking(bookingId, null);

            if (!booking) {
                return createJsonResponse(404, { error: 'Booking not found' });
            }

            // Check if both parties have signed
            const contract = booking.contract || {};
            if (!contract.signedAt || !contract.landlordSignedAt) {
                return createJsonResponse(400, { error: 'Contract must be fully signed before payment' });
            }

            // Check if already paid
            if (booking.paymentStatus === 'paid') {
                return createJsonResponse(400, { error: 'This booking has already been paid' });
            }

            // Get payment amount (should be stored in booking, or calculate from spaces)
            let amount = booking.paymentAmount;

            if (!amount) {
                // Fallback: calculate from spaces if not stored
                context.warn(`Payment amount not stored for booking ${bookingId}, calculating from spaces`);

                const PRICING = {
                    'Peisestue': 1500,
                    'Salen': 3000,
                    'Hele lokalet': 4000,
                    'Bryllupspakke': 6000,
                    'Små møter': 30 // per person
                };

                amount = 0;
                const spaces = Array.isArray(booking.spaces) ? booking.spaces : [booking.spaces];

                spaces.forEach(space => {
                    if (space === 'Små møter') {
                        amount += PRICING[space] * (booking.attendees || 10);
                    } else if (PRICING[space]) {
                        amount += PRICING[space];
                    }
                });

                // Convert to øre
                amount = amount * 100;
            }

            if (amount === 0) {
                return createJsonResponse(400, { error: 'Unable to determine payment amount' });
            }

            // Generate order ID
            const orderId = `contract-payment-${bookingId}-${Date.now()}`;
            const baseUrl = resolveBaseUrl(request);

            // Return URL
            const returnUrl = `${baseUrl.replace('/api', '')}/complete-payment.html?status=success&bookingId=${bookingId}&orderId=${orderId}`;

            // Payment description
            const paymentText = `Betaling for booking ${bookingId.replace('booking-', '').toUpperCase()} - ${booking.spaces ? (Array.isArray(booking.spaces) ? booking.spaces.join(', ') : booking.spaces) : 'Bjørkvang'}`;

            const paymentResponse = await initiatePayment({
                amount,
                phoneNumber, // Optional
                returnUrl,
                orderId,
                text: paymentText
            });

            return createJsonResponse(200, {
                url: paymentResponse.redirectUrl,
                orderId: orderId,
                amount: amount / 100, // Return in NOK
                bookingId: bookingId
            });

        } catch (error) {
            context.error('Vipps contract payment initiate error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
