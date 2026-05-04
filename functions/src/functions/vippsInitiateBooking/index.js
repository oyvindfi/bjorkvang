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

const MEMBER_DISCOUNT = 500; // kr
const MEMBER_ELIGIBLE_SPACES = ['Hele lokalet', 'Bryllupspakke'];

// Calculate total amount based on selected spaces, attendees, and membership discount
const calculateAmount = (spaces, attendees, isMember = false) => {
    let total = 0;

    spaces.forEach(space => {
        if (space === 'Små møter') {
            const count = parseInt(attendees) || 10;
            total += PRICING[space] * count;
        } else if (PRICING[space]) {
            total += PRICING[space];
        }
    });

    const isEligible = spaces.some(s => MEMBER_ELIGIBLE_SPACES.includes(s));
    if (isMember && isEligible) {
        total = Math.max(0, total - MEMBER_DISCOUNT);
    }

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
                eventType,
                isMember
            } = body;

            if (!date || !time || !requesterName) {
                return createJsonResponse(400, { error: 'Date, time, and name are required' });
            }

            // Calculate full amount and 50% deposit
            const totalAmount = calculateAmount(spaces, attendees, isMember === true);

            if (totalAmount === 0) {
                return createJsonResponse(400, { error: 'Invalid pricing configuration' });
            }

            const depositAmount = Math.round(totalAmount / 2); // 50% deposit in øre

            // Generate unique order ID including booking details
            const orderId = `booking-${date}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const baseUrl = resolveBaseUrl(request);

            // Return URL should include booking reference
            const returnUrl = `${baseUrl.replace('/api', '')}/booking?status=success&orderId=${orderId}`;

            // Create descriptive payment text
            const paymentText = `Forhåndsbetaling (50%) – ${eventType || 'arrangement'} - ${spaces.join(', ')} - ${date} kl ${time}`;

            const paymentResponse = await initiatePayment({
                amount: depositAmount,
                phoneNumber, // Optional, pre-fills number in Vipps
                returnUrl,
                orderId,
                text: paymentText
            });

            return createJsonResponse(200, {
                url: paymentResponse.redirectUrl,
                orderId: orderId,
                depositAmount: depositAmount / 100, // in NOK
                totalAmount: totalAmount / 100      // in NOK – for reference
            });

        } catch (error) {
            context.error('Vipps booking initiate error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
