const { app } = require('@azure/functions');
const { createJsonResponse } = require('../../../shared/http');

app.http('vippsCallback', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'vipps/callback/v2/payments/{orderId}',
    handler: async (request, context) => {
        const orderId = request.params.orderId;
        
        try {
            const body = await request.json();
            context.info(`Vipps callback received for order ${orderId}:`, body);

            // Here you would typically:
            // 1. Verify the transaction status (RESERVE, SALE, etc.)
            // 2. Update your database (e.g., mark member as paid)
            // 3. Send a confirmation email

            if (body.transactionInfo && body.transactionInfo.status === 'RESERVED') {
                context.info(`Payment reserved for order ${orderId}. Capture should be performed.`);
                // In a real scenario, you might want to capture the payment immediately or later.
                // For membership, immediate capture is usually fine.
            }

            return createJsonResponse(200, { message: 'Callback received' });

        } catch (error) {
            context.error(`Error processing Vipps callback for ${orderId}:`, error);
            return createJsonResponse(500, { error: 'Internal server error' });
        }
    }
});
