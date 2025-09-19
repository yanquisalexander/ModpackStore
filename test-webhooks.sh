#!/bin/bash

# Simple webhook testing script
# This script tests the new payment webhook endpoints

API_BASE="http://localhost:3000/api/webhooks/payments"

echo "🧪 Testing Payment Webhook Endpoints"
echo "===================================="

# Test health check
echo
echo "1. Testing health check endpoint..."
curl -s -X GET "$API_BASE/health" | jq . || echo "❌ Health check failed"

# Test gateway status
echo
echo "2. Testing gateway status endpoint..."
curl -s -X GET "$API_BASE/status" | jq . || echo "❌ Gateway status failed"

# Test PayPal webhook with sample payload
echo
echo "3. Testing PayPal webhook endpoint..."
curl -s -X POST "$API_BASE/paypal" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "WH-TEST-123",
    "event_type": "PAYMENT.SALE.COMPLETED",
    "resource": {
      "id": "PAY-TEST-123",
      "state": "completed",
      "amount": {
        "total": "9.99",
        "currency": "USD"
      },
      "custom": "{\"modpackId\":\"test-modpack-id\",\"userId\":\"test-user-id\"}"
    }
  }' | jq . || echo "❌ PayPal webhook test failed"

# Test MercadoPago webhook with sample payload
echo
echo "4. Testing MercadoPago webhook endpoint..."
curl -s -X POST "$API_BASE/mercadopago" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123456789,
    "live_mode": false,
    "type": "payment",
    "date_created": "2024-01-01T12:00:00.000Z",
    "application_id": 1234567890,
    "user_id": 987654321,
    "version": 1,
    "api_version": "v1",
    "action": "payment.updated",
    "data": {
      "id": "TEST-PAYMENT-123"
    }
  }' | jq . || echo "❌ MercadoPago webhook test failed"

echo
echo "✅ Webhook testing completed!"
echo
echo "📝 Notes:"
echo "   - These tests use mock data and may fail if database entities don't exist"
echo "   - For full testing, create test modpacks and users in your database"
echo "   - Configure actual payment gateway credentials for real webhook testing"