const fetch = require('node-fetch');

/**
 * Testbeløp for Vipps testmiljø (MT).
 * Beløp oppgis i øre (minor units). Bruk disse for å trigge spesifikke utfall i testappen.
 * Dokumentasjon: https://developer.vippsmobilepay.com/docs/test-environment/
 */
const VIPPS_TEST_AMOUNTS = {
    // Betalingsfeil
    INSUFFICIENT_FUNDS: 151,
    REFUSED_BY_ISSUER: 182,
    SUSPECTED_FRAUD: 183,
    WITHDRAWAL_LIMIT_EXCEEDED: 184,
    EXPIRED_CARD: 186,
    INVALID_CARD: 187,
    THREE_D_SECURE_DENIED: 197,   // Kun Norge
    UNKNOWN_RESULT_1H: 201,        // Ukjent resultat i 1 time
    SCA_REQUIRED: 202,             // Kun Norge
    // Refusjonsfeil
    REFUND_CANNOT_REFUND_SINGLE: 123,  // Kan ikke refundere enkeltoverføringer / bruker slettet
    REFUND_PERIOD_EXPIRED: 124
};

const VIPPS_CLIENT_ID = process.env.VIPPS_CLIENT_ID;
const VIPPS_CLIENT_SECRET = process.env.VIPPS_CLIENT_SECRET;
const VIPPS_SUBSCRIPTION_KEY = process.env.VIPPS_SUBSCRIPTION_KEY;
const VIPPS_MERCHANT_SERIAL_NUMBER = process.env.VIPPS_MERCHANT_SERIAL_NUMBER;
const VIPPS_BASE_URL = process.env.VIPPS_BASE_URL || 'https://apitest.vipps.no'; // Default to test environment

/**
 * Get an access token from Vipps.
 * Tokens are valid for 1 hour. In a production app, you should cache this.
 */
const getAccessToken = async () => {
    if (!VIPPS_CLIENT_ID || !VIPPS_CLIENT_SECRET || !VIPPS_SUBSCRIPTION_KEY) {
        throw new Error('Missing Vipps configuration (CLIENT_ID, CLIENT_SECRET, or SUBSCRIPTION_KEY)');
    }

    const response = await fetch(`${VIPPS_BASE_URL}/accesstoken/get`, {
        method: 'POST',
        headers: {
            'client_id': VIPPS_CLIENT_ID,
            'client_secret': VIPPS_CLIENT_SECRET,
            'Ocp-Apim-Subscription-Key': VIPPS_SUBSCRIPTION_KEY,
            'Merchant-Serial-Number': VIPPS_MERCHANT_SERIAL_NUMBER
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
};

/**
 * Initiate a payment session with Vipps.
 * @param {Object} paymentDetails
 * @param {string} paymentDetails.amount - Amount in NOK (e.g., 25000 for 250.00 kr)
 * @param {string} paymentDetails.phoneNumber - User's phone number (optional)
 * @param {string} paymentDetails.returnUrl - URL to redirect user after payment
 * @param {string} paymentDetails.orderId - Unique order ID
 * @param {string} paymentDetails.text - Transaction text
 */
const initiatePayment = async ({ amount, phoneNumber, returnUrl, orderId, text }) => {
    const accessToken = await getAccessToken();

    const payload = {
        amount: {
            currency: 'NOK',
            value: amount // Amount in øre
        },
        paymentMethod: {
            type: 'WALLET'
        },
        reference: orderId,
        returnUrl: returnUrl,
        userFlow: 'WEB_REDIRECT',
        paymentDescription: text
    };

    if (phoneNumber) {
        payload.customer = {
            phoneNumber: phoneNumber
        };
    }

    const response = await fetch(`${VIPPS_BASE_URL}/epayment/v1/payments`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Ocp-Apim-Subscription-Key': VIPPS_SUBSCRIPTION_KEY,
            'Content-Type': 'application/json',
            'Merchant-Serial-Number': VIPPS_MERCHANT_SERIAL_NUMBER,
            'Idempotency-Key': orderId
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to initiate payment: ${response.status} ${errorText}`);
    }

    return await response.json();
};

/**
 * Get payment details/status.
 * @param {string} reference 
 */
const getPayment = async (reference) => {
    const accessToken = await getAccessToken();

    const response = await fetch(`${VIPPS_BASE_URL}/epayment/v1/payments/${reference}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Ocp-Apim-Subscription-Key': VIPPS_SUBSCRIPTION_KEY,
            'Merchant-Serial-Number': VIPPS_MERCHANT_SERIAL_NUMBER
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get payment: ${response.status} ${errorText}`);
    }

    return await response.json();
};

/**
 * Capture a payment.
 * @param {string} reference
 * @param {number} amount - Amount in øre
 */
const capturePayment = async (reference, amount) => {
    const accessToken = await getAccessToken();

    const payload = {
        modificationAmount: {
            currency: 'NOK',
            value: amount
        }
    };

    const response = await fetch(`${VIPPS_BASE_URL}/epayment/v1/payments/${reference}/capture`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Ocp-Apim-Subscription-Key': VIPPS_SUBSCRIPTION_KEY,
            'Content-Type': 'application/json',
            'Merchant-Serial-Number': VIPPS_MERCHANT_SERIAL_NUMBER,
            'Idempotency-Key': `${reference}-capture`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to capture payment: ${response.status} ${errorText}`);
    }

    return await response.json();
};

module.exports = {
    initiatePayment,
    getPayment,
    capturePayment,
    VIPPS_TEST_AMOUNTS
};
