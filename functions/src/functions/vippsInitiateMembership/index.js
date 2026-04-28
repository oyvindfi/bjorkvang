const { app } = require('@azure/functions');
const { createJsonResponse, parseBody } = require('../../../shared/http');
const { createRecurringAgreement } = require('../../../shared/vipps');
const { saveMember } = require('../../../shared/cosmosDb');

app.http('vippsInitiateMembership', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'vipps/membership/create',
    handler: async (request, context) => {
        try {
            const body = await parseBody(request);
            const { phoneNumber, name } = body;

            const amount = 25000; // 250 kr i øre
            // Vipps Recurring API krever HTTPS-URLer.
            // Bruk den konfigurerte SITE_BASE_URL eller fall tilbake til produksjonsdomenet.
            const siteBase = process.env.SITE_BASE_URL || 'https://bjorkvang.org';

            // agreementId genereres av Vipps; vi sender den via redirect-parameteren
            // slik at frontend kan sjekke status etter godkjenning
            const merchantRedirectUrl = `${siteBase}/medlemskap?status=success`;
            const merchantAgreementUrl = `${siteBase}/medlemskap#administrer`;

            const agreementResponse = await createRecurringAgreement({
                productName: 'Medlemskap Helgøens Vel',
                productDescription: 'Årlig kontingent – 250 kr. Gir rabatt på leie av Bjørkvang.',
                amount,
                intervalUnit: 'YEAR',
                intervalCount: 1,
                merchantRedirectUrl,
                merchantAgreementUrl,
                phoneNumber,
                chargeNow: true,
            });

            context.log('Recurring agreement created:', agreementResponse.agreementId);

            // Persist member record so admin can view all members
            try {
                await saveMember({
                    id: agreementResponse.agreementId,
                    agreementId: agreementResponse.agreementId,
                    name: name || null,
                    phoneNumber: phoneNumber || null,
                    status: 'PENDING',
                    productName: 'Medlemskap Helgøens Vel',
                    amount: amount, // øre
                });
            } catch (saveErr) {
                // Non-fatal: log but don't block the redirect
                context.warn('saveMember feilet (ikke blokkerende):', saveErr.message);
            }

            return createJsonResponse(200, {
                url: agreementResponse.vippsConfirmationUrl,
                agreementId: agreementResponse.agreementId,
            });

        } catch (error) {
            context.error('vippsInitiateMembership error:', error);
            return createJsonResponse(500, { error: error.message });
        }
    }
});
