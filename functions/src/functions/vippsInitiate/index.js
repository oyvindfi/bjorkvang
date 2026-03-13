const { app } = require('@azure/functions');
const { createJsonResponse, parseBody, resolveBaseUrl } = require('../../../shared/http');
const { initiatePayment } = require('../../../shared/vipps');

app.http('vippsInitiate', {
    methods: ['POST', 'OPTIONS'],
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
            const returnUrl = `${baseUrl.replace('/api', '')}/medlemskap?status=success&orderId=${orderId}`;

            const validTo = new Date();
            validTo.setFullYear(validTo.getFullYear() + 1);
            const validToStr = validTo.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

            const paymentResponse = await initiatePayment({
                amount,
                phoneNumber, // Optional, pre-fills number in Vipps
                returnUrl,
                orderId,
                text: `Medlemskap Helgøens Vel – gjelder frem til ${validToStr}`
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
