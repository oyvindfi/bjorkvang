const { app } = require('@azure/functions');
const { sendSms, normalizeNorwegianPhone } = require('../../../shared/sms');
const { createJsonResponse, parseBody } = require('../../../shared/http');
const { getBooking } = require('../../../shared/cosmosDb');

/**
 * POST /api/sms/send
 * Admin endpoint for manually sending an SMS to a booking's phone number.
 * Body: { to?: string; bookingId?: string; body: string }
 * Either `to` (raw number) or `bookingId` (looked up from Cosmos) must be provided.
 */
app.http('sendSms', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'sms/send',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return createJsonResponse(204, {}, request);
        }

        const parsed = await parseBody(request);
        const { bookingId, body } = parsed;
        let { to } = parsed;

        if (!body || !String(body).trim()) {
            return createJsonResponse(400, { error: 'Melding (body) er påkrevd.' }, request);
        }

        // Resolve phone from bookingId if `to` not supplied directly
        if (!to && bookingId) {
            const booking = await getBooking(String(bookingId).trim());
            if (!booking) {
                return createJsonResponse(404, { error: 'Booking ikke funnet.' }, request);
            }
            if (!booking.phone) {
                return createJsonResponse(400, { error: 'Bookingen har ikke registrert et telefonnummer.' }, request);
            }
            to = booking.phone;
        }

        if (!to) {
            return createJsonResponse(400, { error: 'Enten "to" eller "bookingId" er påkrevd.' }, request);
        }

        const normalized = normalizeNorwegianPhone(String(to));
        if (!normalized) {
            return createJsonResponse(400, { error: `Ugyldig telefonnummer: "${to}". Forventet 8-sifret norsk nummer.` }, request);
        }

        const result = await sendSms({ to: normalized, body: String(body).trim() }, context);

        if (!result) {
            return createJsonResponse(500, { error: 'SMS kunne ikke sendes. Sjekk Twilio-konfigurasjon i serveren.' }, request);
        }

        context.info(`sendSms function: SMS sent to ${normalized}, SID ${result.messageId}`);
        return createJsonResponse(200, { ok: true, messageId: result.messageId, to: normalized }, request);
    },
});
