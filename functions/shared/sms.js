// Max 11 chars, ASCII only (A-Za-z0-9) — Norwegian Ø/Æ/Å are not allowed in Twilio sender IDs
const SENDER_ID = process.env.SMS_SENDER_ID || 'Bjorkvang';

const MONTHS_NB = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];

/**
 * Format a YYYY-MM-DD date string to a short Norwegian date, e.g. "30. mai".
 * Falls back to the raw string if parsing fails.
 * @param {string} dateStr
 * @returns {string}
 */
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length < 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (isNaN(day) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return dateStr;
    return `${day}. ${MONTHS_NB[monthIdx]}`;
};

/**
 * Normalize a Norwegian phone number to E.164 (+47XXXXXXXX).
 * Cosmos DB stores phone numbers stripped of the country code.
 * @param {string} phone
 * @returns {string|null}
 */
const normalizeNorwegianPhone = (phone) => {
    if (!phone) return null;
    // Strip all whitespace and dashes
    const stripped = String(phone).replace(/[\s\-]/g, '');
    // Already in E.164 format
    if (/^\+47\d{8}$/.test(stripped)) return stripped;
    // Strip any existing country code prefix
    const digits = stripped.replace(/^(?:\+?47|0047)/, '');
    if (!/^\d{8}$/.test(digits)) return null;
    return `+47${digits}`;
};

/**
 * Send an SMS via Twilio.
 * Never throws — SMS failures are logged but must not block the booking flow.
 * @param {{ to: string; body: string; }} options
 * @param {object} [context] Azure Function context for logging
 * @returns {Promise<{ messageId: string }|null>}
 */
const sendSms = async (options, context = console) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        context.warn('sendSms: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set. Skipping SMS.');
        return null;
    }

    const to = normalizeNorwegianPhone(options.to);
    if (!to) {
        context.warn(`sendSms: Invalid phone number "${options.to}". Skipping SMS.`);
        return null;
    }

    if (!options.body || !options.body.trim()) {
        context.warn('sendSms: Empty body. Skipping SMS.');
        return null;
    }

    // Allow multi-part SMS so Vipps URLs are never silently truncated.
    // Twilio automatically joins segments on modern phones.
    const body = options.body.trim();

    try {
        const twilio = require('twilio');
        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
            from: SENDER_ID,
            to,
            body,
        });
        context.info(`sendSms: SMS sent to ${to}, SID ${message.sid}`);
        return { messageId: message.sid };
    } catch (error) {
        context.error('sendSms: Failed to send SMS', {
            to,
            error: error.message,
            code: error.code,
        });
        return null;
    }
};

module.exports = { sendSms, normalizeNorwegianPhone, formatDate };
