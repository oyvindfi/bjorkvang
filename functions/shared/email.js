const DEFAULT_PLUNK_API_URL = 'https://api.useplunk.com/v1/send';

const getPlunkApiUrl = () => {
    const configured = process.env.PLUNK_API_URL && process.env.PLUNK_API_URL.trim();
    return configured || DEFAULT_PLUNK_API_URL;
};

const buildPayload = (options) => {
    const payload = {
        from: options.from,
        to: options.to,
        subject: options.subject,
        ...(options.text ? { text: options.text } : {}),
        ...(options.html ? { html: options.html } : {}),
    };

    if (options.replyTo) {
        payload.replyTo = options.replyTo;
    }

    return payload;
};

/**
 * Send an email using Plunk's REST API over HTTPS.
 * @param {{ from?: string; to?: string; subject?: string; text?: string; html?: string; replyTo?: string; }} options
 * @returns {Promise<{ messageId?: string; response?: any }>}
 */
const sendEmail = async (options) => {
    const token = process.env.PLUNK_API_TOKEN;

    if (!token) {
        throw new Error('PLUNK_API_TOKEN environment variable is not set.');
    }

    const urlString = getPlunkApiUrl();
    const payload = buildPayload(options);

    try {
        const response = await fetch(urlString, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Plunk API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        // Plunk usually returns { success: true, id: "..." }
        const messageId = data.id || data.messageId; 

        return {
            messageId,
            response: data
        };

    } catch (error) {
        console.error('Failed to send email via Plunk:', error);
        throw error;
    }
};

module.exports = {
    DEFAULT_PLUNK_API_URL,
    getPlunkApiUrl,
    sendEmail,
};
