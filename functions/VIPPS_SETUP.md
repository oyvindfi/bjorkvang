# Vipps Payment Integration Setup

This document explains how to configure Vipps payment integration for the Bjørkvang booking system.

## Overview

The Vipps payment integration allows:
- **Membership payments**: 250 NOK annual membership fee
- **Booking payments**: Variable amounts based on selected spaces and services
- **Automatic payment confirmation**: Bookings with successful payments are automatically approved

## Required Environment Variables

Add these variables to your `local.settings.json` (for local development) or Azure Function App Configuration (for production):

```json
{
  "Values": {
    "VIPPS_CLIENT_ID": "your-client-id",
    "VIPPS_CLIENT_SECRET": "your-client-secret",
    "VIPPS_SUBSCRIPTION_KEY": "your-subscription-key",
    "VIPPS_MERCHANT_SERIAL_NUMBER": "your-merchant-serial-number",
    "VIPPS_BASE_URL": "https://apitest.vipps.no",
    "WEBSITE_URL": "https://bjørkvang.no"
  }
}
```

### Variable Descriptions

| Variable | Description | Example |
|----------|-------------|---------|
| `VIPPS_CLIENT_ID` | OAuth 2.0 client ID from Vipps developer portal | `client-1234-5678` |
| `VIPPS_CLIENT_SECRET` | OAuth 2.0 client secret from Vipps developer portal | `secret-abcd-efgh` |
| `VIPPS_SUBSCRIPTION_KEY` | API subscription key (Ocp-Apim-Subscription-Key) | `1234567890abcdef` |
| `VIPPS_MERCHANT_SERIAL_NUMBER` | Unique merchant identifier | `123456` |
| `VIPPS_BASE_URL` | API base URL | Test: `https://apitest.vipps.no`<br>Production: `https://api.vipps.no` |
| `WEBSITE_URL` | Frontend website URL for email links | Production: `https://bjørkvang.no`<br>Local: `http://localhost:3000` |

## Getting Vipps Credentials

### 1. Create Vipps Developer Account

1. Go to [Vipps Developer Portal](https://developer.vippsmobilepay.com/)
2. Sign up or log in with your business account
3. Create a new sales unit

### 2. Get Test Credentials

1. Navigate to **Test Keys** section in the developer portal
2. Copy the following credentials:
   - Client ID
   - Client Secret
   - Subscription Key (Ocp-Apim-Subscription-Key)
   - Merchant Serial Number

### 3. Test Environment Setup

For testing, use these settings:
```json
{
  "VIPPS_BASE_URL": "https://apitest.vipps.no"
}
```

### 4. Production Credentials

When ready for production:
1. Request production credentials from Vipps
2. Complete Vipps' production checklist
3. Update `VIPPS_BASE_URL` to `https://api.vipps.no`
4. Add production credentials to Azure Function App configuration

## API Endpoints

The integration includes three Vipps-related endpoints:

### 1. Initiate Membership Payment
```
POST /api/vipps/initiate
```
Initiates a 250 NOK membership payment. Returns redirect URL for Vipps payment.

**Request Body:**
```json
{
  "phoneNumber": "+4712345678" // Optional
}
```

**Response:**
```json
{
  "url": "https://vipps.no/payment/...",
  "orderId": "membership-1234567890-abc"
}
```

### 2. Initiate Booking Payment
```
POST /api/vipps/initiate-booking
```
Initiates a booking payment with variable amount based on selected spaces.

**Request Body:**
```json
{
  "phoneNumber": "+4712345678",
  "spaces": ["Salen", "Peisestue"],
  "attendees": 50,
  "date": "2025-06-15",
  "time": "18:00",
  "requesterName": "John Doe",
  "eventType": "Familiefeiring"
}
```

**Response:**
```json
{
  "url": "https://vipps.no/payment/...",
  "orderId": "booking-2025-06-15-1234567890-abc",
  "amount": 4500  // Amount in NOK
}
```

### 3. Check Payment Status
```
POST /api/vipps/check-status
```
Checks the status of a Vipps payment and captures it if authorized.

**Request Body:**
```json
{
  "orderId": "booking-2025-06-15-1234567890-abc"
}
```

**Response:**
```json
{
  "status": "CAPTURED",
  "details": { /* Full Vipps payment details */ }
}
```

## Pricing Structure

Bookings are automatically priced based on selected spaces:

| Space | Price (NOK) |
|-------|-------------|
| Peisestue | 1,500 |
| Salen | 3,000 |
| Hele lokalet | 4,000 |
| Bryllupspakke | 6,000 |
| Små møter | 30 per person |

The total amount is calculated by the `vippsInitiateBooking` function.

## Payment Flow

### Membership Payment Flow

1. User clicks "Betal med Vipps" on membership page
2. Frontend calls `/api/vipps/initiate`
3. User is redirected to Vipps
4. User completes payment in Vipps app
5. User returns to `medlemskap?status=success&orderId=...`
6. Frontend calls `/api/vipps/check-status` to verify payment
7. Success message displayed

### Booking Payment Flow

1. User fills out booking form and selects "Betal nå med Vipps"
2. Booking details stored in sessionStorage
3. Frontend calls `/api/vipps/initiate-booking`
4. User is redirected to Vipps
5. User completes payment in Vipps app
6. User returns to `booking?status=success&orderId=...`
7. Frontend calls `/api/vipps/check-status` to verify payment
8. If payment successful:
   - Booking is submitted to `/api/booking` with `paymentStatus: 'paid'`
   - Booking automatically gets status `'approved'` (no manual approval needed)
   - Confirmation emails sent
   - Booking appears in calendar as confirmed

## Testing

### Test Payment Flow

1. Start Azure Functions locally:
   ```bash
   cd functions
   npm start
   ```

2. Access the site locally (e.g., `http://localhost:8080/booking`)

3. Create a test booking and select Vipps payment

4. Use Vipps test app or test credentials to complete payment

### Vipps Test App

Download the Vipps Merchant Test (MT) app from:
- iOS: App Store
- Android: Google Play

Use test phone numbers and credentials provided in the Vipps developer portal.

## Webhook Integration

Vipps can send callbacks to your server when payment status changes.

**Callback Endpoint:**
```
POST /api/vipps/callback/v2/payments/{orderId}
```

This endpoint receives payment status updates from Vipps. Currently it logs the event but doesn't perform additional actions since we verify status when the user returns.

## Security Considerations

1. **Never expose credentials in frontend code** - all Vipps calls go through backend functions

2. **Validate payment status** - always verify payment with `/api/vipps/check-status` before accepting a booking

3. **Use HTTPS in production** - Vipps requires secure connections

4. **Store credentials securely** - use Azure Key Vault for production credentials

5. **Implement idempotency** - each payment uses a unique `orderId` to prevent double-charging

## Troubleshooting

### "Failed to get access token"

Check that all four credentials are correctly set:
- VIPPS_CLIENT_ID
- VIPPS_CLIENT_SECRET
- VIPPS_SUBSCRIPTION_KEY
- VIPPS_MERCHANT_SERIAL_NUMBER

### "Failed to initiate payment"

1. Verify `VIPPS_BASE_URL` is set correctly
2. Check that credentials match the environment (test vs production)
3. Ensure API keys are not expired

### Payment succeeds but booking not created

Check browser console for errors. The booking details should be in `sessionStorage`. If they're missing, the browser may have cleared them or the user returned to a different session.

### Testing in Production

Use a small amount (e.g., 1 NOK) for real payment testing before going live with full amounts.

## Support Resources

- [Vipps Developer Documentation](https://developer.vippsmobilepay.com/)
- [Vipps ePayment API](https://developer.vippsmobilepay.com/docs/APIs/epayment-api/)
- [Vipps Integration Checklist](https://developer.vippsmobilepay.com/docs/getting-started/integration-checklist/)
- [Vipps Support](https://developer.vippsmobilepay.com/docs/support/)
