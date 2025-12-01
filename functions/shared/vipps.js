const fetch = require('node-fetch');

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

    const response = await fetch(`${VIPPS_BASE_URL}/accessToken/get`, {
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
        merchantInfo: {
            merchantSerialNumber: VIPPS_MERCHANT_SERIAL_NUMBER,
            callbackPrefix: `${process.env.PUBLIC_FUNCTION_BASE_URL}/api/vipps/callback`,
            fallBack: returnUrl,
        },
        customerInfo: {},
        transaction: {
            orderId: orderId,
            amount: amount, // Amount in øre
            transactionText: text,
        },
    };

    if (phoneNumber) {
        payload.customerInfo.mobileNumber = phoneNumber;
    }

    const response = await fetch(`${VIPPS_BASE_URL}/ecomm/v2/payments`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Ocp-Apim-Subscription-Key': VIPPS_SUBSCRIPTION_KEY,
            'Content-Type': 'application/json',
            'Merchant-Serial-Number': VIPPS_MERCHANT_SERIAL_NUMBER
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
 * @param {string} orderId 
 */
const getPaymentDetails = async (orderId) => {
    const accessToken = await getAccessToken();

    const response = await fetch(`${VIPPS_BASE_URL}/ecomm/v2/payments/${orderId}/details`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Ocp-Apim-Subscription-Key': VIPPS_SUBSCRIPTION_KEY,
            'Merchant-Serial-Number': VIPPS_MERCHANT_SERIAL_NUMBER
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get payment details: ${response.status} ${errorText}`);
    }

    return await response.json();
};

module.exports = {
    initiatePayment,
    getPaymentDetails
};
