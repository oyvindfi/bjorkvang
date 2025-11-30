const ALLOWED_ORIGINS = [
    'https://xn--bjrkvang-64a.no',
    'https://bjorkvang.no',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

const PUBLIC_BASE_URL = (process.env.PUBLIC_FUNCTION_BASE_URL || '').replace(/\/$/, '');

const getCorsOrigin = (request) => {
    if (!request || !request.headers) return ALLOWED_ORIGINS[0];
    const origin = request.headers.get('origin');
    if (ALLOWED_ORIGINS.includes(origin)) {
        return origin;
    }
    return ALLOWED_ORIGINS[0];
};

/**
 * Create a JSON Azure Function response with shared CORS headers.
 */
const createJsonResponse = (status, body = {}, request = null, extraHeaders = {}) => ({
    status,
    jsonBody: body,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getCorsOrigin(request),
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        ...extraHeaders,
    },
});

/**
 * Create a HTML response while still sending back the CORS headers for consistency.
 */
const createHtmlResponse = (status, html, request = null) => ({
    status,
    body: html,
    headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': getCorsOrigin(request),
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    },
});

/**
 * Attempt to parse the incoming body from JSON or urlencoded form data.
 */
const parseBody = async (request) => {
    try {
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            return await request.json();
        }

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.text();
            return Object.fromEntries(new URLSearchParams(formData));
        }

        return await request.json();
    } catch (_) {
        return {};
    }
};

/**
 * Resolve the base URL that should be used inside emails.
 * Defaults to the incoming request origin unless PUBLIC_FUNCTION_BASE_URL is set.
 */
const resolveBaseUrl = (request) => {
    if (PUBLIC_BASE_URL) {
        return PUBLIC_BASE_URL;
    }

    try {
        const url = new URL(request.url);
        return `${url.protocol}//${url.host}`;
    } catch (_) {
        return '';
    }
};

module.exports = {
    ALLOWED_ORIGINS,
    createHtmlResponse,
    createJsonResponse,
    parseBody,
    resolveBaseUrl,
};
