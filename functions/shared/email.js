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
        body: options.html || options.text, // Plunk expects 'body' for the content
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

    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
                // If 4xx error (client error), do not retry
                if (response.status >= 400 && response.status < 500) {
                    const errorText = await response.text();
                    throw new Error(`Plunk API error (Client): ${response.status} ${response.statusText} - ${errorText}`);
                }
                
                // If 5xx error (server error), throw to trigger retry
                const errorText = await response.text();
                throw new Error(`Plunk API error (Server): ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            // Plunk usually returns { success: true, id: "..." }
            const messageId = data.id || data.messageId; 

            return {
                messageId,
                response: data
            };

        } catch (error) {
            lastError = error;
            console.warn(`Email send attempt ${attempt}/${maxRetries} failed: ${error.message}`);
            
            // Don't retry if it was a client error (4xx)
            if (error.message.includes('Plunk API error (Client)')) {
                throw error;
            }

            if (attempt < maxRetries) {
                // Exponential backoff: 500ms, 1000ms, 2000ms...
                const delay = 500 * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    console.error('Failed to send email via Plunk after multiple attempts:', lastError);
    throw lastError;
};

module.exports = {
    DEFAULT_PLUNK_API_URL,
    getPlunkApiUrl,
    sendEmail,
};
