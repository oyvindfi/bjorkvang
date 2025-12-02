const { app } = require('@azure/functions');
const { createJsonResponse, parseBody } = require('../../../shared/http');
const { getPayment, capturePayment } = require('../../../shared/vipps');

app.http('vippsCheckStatus', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'vipps/check-status',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const { orderId } = body;

            if (!orderId) {
                return createJsonResponse(400, { error: 'Missing orderId' });
            }

            const payment = await getPayment(orderId);
            let status = payment.state; // e.g., 'CREATED', 'AUTHORIZED', 'TERMINATED'

            // If authorized, capture the payment to complete it
            if (status === 'AUTHORIZED') {
                try {
                    // Capture the full amount
                    await capturePayment(orderId, payment.amount.value);
                    status = 'CAPTURED'; 
                } catch (captureError) {
                    context.error('Capture failed:', captureError);
                    // If capture fails, we still report the authorized state, but log it.
                }
            }

            return createJsonResponse(200, {
                status: status,
                details: payment
            });

        } catch (error) {
            context.error('Vipps check status error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
