const { app } = require('@azure/functions');
const { createJsonResponse, parseBody, resolveBaseUrl } = require('../../../shared/http');
const { initiatePayment } = require('../../../shared/vipps');

app.http('vippsDonate', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'vipps/donate',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const amount = parseInt(body.amount);

            if (!amount || amount < 1000) {
                return createJsonResponse(400, { error: 'Minste beløp er 10 kr (1000 øre)' });
            }

            const orderId = `donation-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const baseUrl = resolveBaseUrl(request);
            const returnUrl = `${baseUrl.replace('/api', '')}/stott-oss?status=success&orderId=${orderId}&amount=${amount}`;
            const kroner = Math.round(amount / 100);

            const paymentResponse = await initiatePayment({
                amount,
                phoneNumber: body.phoneNumber,
                returnUrl,
                orderId,
                text: `Donasjon til Bjørkvang – ${kroner} kr`
            });

            return createJsonResponse(200, {
                url: paymentResponse.redirectUrl,
                orderId,
                amount
            });

        } catch (error) {
            context.error('Vipps donate error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
