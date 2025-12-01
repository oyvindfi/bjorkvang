const { app } = require('@azure/functions');
const { createJsonResponse, parseBody, resolveBaseUrl } = require('../../shared/http');
const { initiatePayment } = require('../../shared/vipps');

app.http('vippsInitiate', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'vipps/initiate',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const { phoneNumber } = body;

            // Default membership fee: 250 NOK
            const amount = 25000; // in øre
            const orderId = `membership-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const baseUrl = resolveBaseUrl(request);
            
            // In production, this should point to a dedicated success page
            // For now, we redirect back to medlemskap.html with a query param
            const returnUrl = `${baseUrl.replace('/api', '')}/medlemskap.html?status=success&orderId=${orderId}`;

            const paymentResponse = await initiatePayment({
                amount,
                phoneNumber, // Optional, pre-fills number in Vipps
                returnUrl,
                orderId,
                text: 'Medlemskap Helgøens Vel (årlig fornyelse)'
            });

            return createJsonResponse(200, {
                url: paymentResponse.redirectUrl,
                orderId: orderId
            });

        } catch (error) {
            context.error('Vipps initiate error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
