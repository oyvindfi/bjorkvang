const { app } = require('@azure/functions');
const { sendSms, normalizeNorwegianPhone, SMS_MAX_LENGTH } = require('../../../shared/sms');
const { createJsonResponse, parseBody, requireAdminKey } = require('../../../shared/http');

/**
 * POST /api/sms/bulk
 * Admin endpoint for sending an SMS to multiple recipients.
 * Body: { phones: string[]; body: string }
 * Returns: { ok: true, sent: number, failed: number, results: Array<{phone, ok, error?}> }
 */
app.http('sendBulkSms', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'sms/bulk',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        const authError = requireAdminKey(request);
        if (authError) {
            return createJsonResponse(401, { error: 'Unauthorized' }, request);
        }

        const parsed = await parseBody(request);
        const { phones, body } = parsed;

        if (!body || !String(body).trim()) {
            return createJsonResponse(400, { error: 'Melding (body) er påkrevd.' }, request);
        }

        if (String(body).trim().length > SMS_MAX_LENGTH) {
            return createJsonResponse(400, { error: `Meldingen er for lang. Maks ${SMS_MAX_LENGTH} tegn.` }, request);
        }

        if (!Array.isArray(phones) || phones.length === 0) {
            return createJsonResponse(400, { error: '"phones" må være en liste med minst ett nummer.' }, request);
        }

        const messageBody = String(body).trim();
        const results = [];
        let sent = 0;
        let failed = 0;

        for (const rawPhone of phones) {
            const normalized = normalizeNorwegianPhone(String(rawPhone));
            if (!normalized) {
                results.push({ phone: rawPhone, ok: false, error: 'Ugyldig nummer' });
                failed++;
                continue;
            }
            try {
                const result = await sendSms({ to: normalized, body: messageBody }, context);
                if (result) {
                    results.push({ phone: normalized, ok: true, messageId: result.messageId });
                    sent++;
                } else {
                    results.push({ phone: normalized, ok: false, error: 'SMS ikke sendt (ingen respons)' });
                    failed++;
                }
            } catch (err) {
                context.error(`sendBulkSms: failed for ${normalized}: ${err.message}`);
                results.push({ phone: normalized, ok: false, error: err.message });
                failed++;
            }
        }

        context.info(`sendBulkSms: sent=${sent}, failed=${failed}, total=${results.length}`);
        return createJsonResponse(200, { ok: true, sent, failed, total: results.length, results }, request);
    },
});
