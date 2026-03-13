const { app } = require('@azure/functions');
const { createJsonResponse, parseBody } = require('../../../shared/http');
const { getRecurringAgreement } = require('../../../shared/vipps');

app.http('vippsMembershipStatus', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'vipps/membership/status',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const { agreementId } = body;

            if (!agreementId) {
                return createJsonResponse(400, { error: 'agreementId er påkrevd' });
            }

            const agreement = await getRecurringAgreement(agreementId);

            context.log('Agreement status:', agreementId, agreement.status);

            return createJsonResponse(200, {
                status: agreement.status,  // PENDING | ACTIVE | STOPPED | EXPIRED
                agreementId: agreement.id,
                productName: agreement.productName,
                pricing: agreement.pricing,
                start: agreement.start,
                stop: agreement.stop,
            });

        } catch (error) {
            context.error('vippsMembershipStatus error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
