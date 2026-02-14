const { app } = require('@azure/functions');
const { createJsonResponse, parseBody, resolveBaseUrl } = require('../../../shared/http');
const { initiatePayment } = require('../../../shared/vipps');

// Pricing structure in NOK
const PRICING = {
    'Peisestue': 1500,
    'Salen': 3000,
    'Hele lokalet': 4000,
    'Bryllupspakke': 6000,
    'Små møter': 30 // per person
};

// Calculate total amount based on selected spaces and attendees
const calculateAmount = (spaces, attendees) => {
    let total = 0;

    spaces.forEach(space => {
        if (space === 'Små møter') {
            // For small meetings, calculate per person
            const count = parseInt(attendees) || 10; // Default to 10 if not specified
            total += PRICING[space] * count;
        } else if (PRICING[space]) {
            total += PRICING[space];
        }
    });

    return total * 100; // Convert to øre
};

app.http('vippsInitiateBooking', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'vipps/initiate-booking',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const {
                phoneNumber,
                spaces,
                attendees,
                date,
                time,
                requesterName,
                eventType
            } = body;

            // Validate required fields
            if (!spaces || !Array.isArray(spaces) || spaces.length === 0) {
                return createJsonResponse(400, { error: 'Spaces must be specified' });
            }

            if (!date || !time || !requesterName) {
                return createJsonResponse(400, { error: 'Date, time, and name are required' });
            }

            // Calculate amount
            const amount = calculateAmount(spaces, attendees);

            if (amount === 0) {
                return createJsonResponse(400, { error: 'Invalid pricing configuration' });
            }

            // Generate unique order ID including booking details
            const orderId = `booking-${date}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const baseUrl = resolveBaseUrl(request);

            // Return URL should include booking reference
            const returnUrl = `${baseUrl.replace('/api', '')}/booking?status=success&orderId=${orderId}`;

            // Create descriptive payment text
            const paymentText = `Booking ${eventType || 'arrangement'} - ${spaces.join(', ')} - ${date} kl ${time}`;

            const paymentResponse = await initiatePayment({
                amount,
                phoneNumber, // Optional, pre-fills number in Vipps
                returnUrl,
                orderId,
                text: paymentText
            });

            return createJsonResponse(200, {
                url: paymentResponse.redirectUrl,
                orderId: orderId,
                amount: amount / 100 // Return amount in NOK for reference
            });

        } catch (error) {
            context.error('Vipps booking initiate error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
