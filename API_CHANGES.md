# Multi-Gateway Payment System API Changes

## Overview
This document describes the API changes introduced by the multi-gateway payment system implementation.

## Breaking Changes

### Deprecated Endpoints
- **DEPRECATED**: `POST /explore/paypal-webhook` - Use `POST /api/webhooks/payments/paypal` instead

### Modified Endpoints

#### `POST /explore/modpacks/{modpackId}/acquire/purchase`
**Changes**:
- Removed required `returnUrl` and `cancelUrl` parameters
- Added optional `gatewayType` parameter
- Added optional `countryCode` parameter
- Updated response format

**Old Request Body**:
```json
{
  "returnUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
}
```

**New Request Body**:
```json
{
  "gatewayType": "paypal|mercadopago",  // optional
  "countryCode": "UY"                   // optional, for automatic gateway selection
}
```

**New Response Format**:
```json
{
  "success": true,
  "isFree": false,
  "paymentId": "PAY-123456789",
  "approvalUrl": "https://paypal.com/checkout?token=...",
  "gatewayType": "paypal",
  "status": "pending",
  "amount": "9.99",
  "currency": "USD",
  "metadata": {
    "paypalPaymentId": "PAY-123456789",
    "approvalUrl": "https://paypal.com/checkout?token=..."
  }
}
```

## New Endpoints

### Payment Webhooks

#### `POST /api/webhooks/payments/paypal`
Handles PayPal payment completion webhooks.

**Request Body**: PayPal webhook event payload
**Response**: 
```json
{ "success": true }
```

#### `POST /api/webhooks/payments/mercadopago`
Handles MercadoPago payment notifications.

**Request Body**: MercadoPago webhook event payload
**Response**: 
```json
{ "success": true }
```

#### `GET /api/webhooks/payments/status`
Returns the status of all configured payment gateways.

**Response**:
```json
{
  "status": {
    "paypal": {
      "available": true,
      "configured": true
    },
    "mercadopago": {
      "available": true,
      "configured": false
    }
  },
  "availableGateways": ["paypal"],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### `GET /api/webhooks/payments/health`
Health check endpoint for monitoring.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "gateways": ["paypal"]
}
```

## Gateway Selection Logic

The system automatically selects the best payment gateway based on user location:

1. **Manual Selection**: If `gatewayType` is specified, use that gateway
2. **Automatic Selection**: Based on `countryCode` parameter:
   - Latin America (UY, AR, BR, CL, CO, MX, PE): MercadoPago preferred
   - Other countries: PayPal preferred
3. **Fallback**: Use any available configured gateway

## Webhook Migration

### PayPal Webhook Migration
1. Update your PayPal webhook URL in the PayPal Developer Console
2. Change from: `https://your-domain.com/explore/paypal-webhook`
3. Change to: `https://your-domain.com/api/webhooks/payments/paypal`

### New MercadoPago Webhook
1. Configure in MercadoPago Developer Panel
2. Set URL to: `https://your-domain.com/api/webhooks/payments/mercadopago`
3. Select "payment" events

## Error Handling

### Payment Creation Errors
- `400`: Invalid gateway type or configuration
- `500`: Payment gateway not configured or creation failed

### Webhook Errors
- `400`: Invalid webhook payload or signature
- `500`: Webhook processing failed

## Testing

### Local Testing
Use the provided test script:
```bash
./test-webhooks.sh
```

### Production Testing
1. Use sandbox environments for both gateways
2. Configure webhook URLs with your domain
3. Test payment flows with test cards/accounts
4. Monitor webhook logs for successful processing

## Security Considerations

1. **Webhook Validation**: Implement signature validation for production
2. **HTTPS Required**: All webhook URLs must use HTTPS in production
3. **Rate Limiting**: Consider implementing rate limiting on webhook endpoints
4. **Monitoring**: Monitor webhook failures and payment processing errors

## Frontend Changes

### ModpackAcquisitionDialog Component
- Added gateway selection UI for paid modpacks
- Removed QR code display
- Updated payment flow to be desktop-friendly
- Added automatic gateway selection based on user region