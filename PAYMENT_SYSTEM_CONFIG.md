# Multi-Gateway Payment System Environment Configuration

This document describes the environment variables needed to configure the multi-gateway payment system.

## Required Environment Variables

### PayPal Configuration
```bash
# PayPal API credentials
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here

# PayPal environment (sandbox for testing, production for live)
PAYPAL_BASE_URL=https://api.sandbox.paypal.com  # or https://api.paypal.com for production
```

### MercadoPago Configuration
```bash
# MercadoPago API credentials
MERCADOPAGO_ACCESS_TOKEN=your_mercadopago_access_token_here

# MercadoPago environment (optional, defaults to sandbox in development)
MERCADOPAGO_BASE_URL=https://api.mercadopago.com

# MercadoPago webhook secret (optional, for webhook validation)
MERCADOPAGO_WEBHOOK_SECRET=your_webhook_secret_here

# MercadoPago webhook URL (where MercadoPago will send notifications)
MERCADOPAGO_WEBHOOK_URL=https://your-domain.com/api/webhooks/payments/mercadopago
```

### General Payment Configuration
```bash
# Commission rate for platform (0.30 = 30%)
COMMISSION_RATE=0.30
```

## Gateway Selection Logic

The system automatically chooses the best payment gateway based on the user's region:

- **Latin American countries** (UY, AR, BR, CL, CO, MX, PE): MercadoPago preferred
- **Other countries**: PayPal preferred
- **Fallback**: If preferred gateway is not configured, uses available gateway
- **Manual selection**: Users can override automatic selection in the UI

## Webhook Endpoints

The new webhook endpoints are available at:

- **PayPal**: `POST /api/webhooks/payments/paypal`
- **MercadoPago**: `POST /api/webhooks/payments/mercadopago`
- **Status check**: `GET /api/webhooks/payments/status`
- **Health check**: `GET /api/webhooks/payments/health`

## Testing

### PayPal Sandbox
1. Create a PayPal developer account at https://developer.paypal.com
2. Create a sandbox application to get `CLIENT_ID` and `CLIENT_SECRET`
3. Use `https://api.sandbox.paypal.com` as the base URL

### MercadoPago Sandbox
1. Create a MercadoPago developer account at https://developers.mercadopago.com
2. Get your test access token from the credentials section
3. Use the sandbox environment for testing

### Webhook Testing
You can test webhooks using tools like ngrok for local development:

```bash
# Start ngrok
ngrok http 3000

# Use the ngrok URL in your webhook configuration
# Example: https://abc123.ngrok.io/api/webhooks/payments/paypal
```

## Security Notes

- Store all credentials as environment variables, never in code
- Use sandbox environments for development and testing
- Implement proper webhook signature validation in production
- Monitor webhook endpoints for security and performance
- Rotate API credentials regularly

## Migration from Legacy System

The old PayPal webhook at `/explore/paypal-webhook` has been deprecated. Update your PayPal webhook configuration to point to the new endpoint:

**Old**: `https://your-domain.com/explore/paypal-webhook`
**New**: `https://your-domain.com/api/webhooks/payments/paypal`