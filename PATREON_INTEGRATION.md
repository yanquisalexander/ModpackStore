# Patreon Integration Configuration

## Environment Variables

The following environment variables are required for the Patreon integration to work properly:

### Backend Environment Variables

Add these to your backend `.env` file:

```bash
# Patreon OAuth Configuration
PATREON_CLIENT_ID=your_patreon_client_id
PATREON_CLIENT_SECRET=your_patreon_client_secret
PATREON_REDIRECT_URI=http://localhost:1959/callback

# Patreon Webhook Configuration
PATREON_WEBHOOK_SECRET=your_patreon_webhook_secret
```

### Frontend Environment Variables

The frontend will automatically use the correct OAuth flow through the Tauri backend, so no additional environment variables are needed.

## Setting Up Patreon OAuth Application

1. Go to [Patreon Developer Portal](https://www.patreon.com/portal/registration/register-clients)
2. Create a new client application
3. Set the redirect URI to: `http://localhost:1959/callback`
4. Copy the Client ID and Client Secret to your backend `.env` file
5. Set up webhook endpoint (optional, for real-time subscription updates):
   - Webhook URL: `https://your-backend-domain.com/v1/webhooks/payments/patreon`
   - Events: `members:create`, `members:update`, `members:delete`, `members:pledge:create`, `members:pledge:update`, `members:pledge:delete`

## OAuth Flow Architecture

The new Patreon integration follows the same pattern as Discord/Twitch integrations:

1. **Frontend initiates OAuth**: User clicks "Connect Patreon" button
2. **Tauri opens browser**: `start_patreon_auth()` command opens Patreon OAuth URL
3. **User authorizes**: User completes OAuth flow in browser
4. **Rust captures callback**: Minimal HTTP server on port 1959 receives the callback
5. **Forward to backend**: Rust sends the authorization code to the backend API
6. **Backend processes**: Backend exchanges code for tokens and links the account
7. **Update UI**: Frontend receives success event and refreshes user data

## Webhook Processing

The backend automatically processes Patreon webhooks to keep user subscription data up-to-date:

- **Member events**: Handle account creation, updates, and deletions
- **Pledge events**: Handle subscription changes, cancellations, and tier changes
- **Security**: All webhooks are validated using MD5 signature verification

## Supported Patreon Tiers

The system supports the following tier structure:

- **Basic Tier**: $3+ per month
  - Custom cover images
  - Priority support

- **Premium Tier**: $5+ per month
  - All Basic features
  - Early access to new features
  - Exclusive modpacks

- **Elite Tier**: $10+ per month
  - All Premium features
  - Custom badges
  - Beta feature access

## Testing the Integration

1. Start the backend server with the environment variables configured
2. Start the frontend application
3. Navigate to Profile → Integrations
4. Click "Connect Patreon"
5. Complete the OAuth flow in the browser
6. Check that the connection status is updated in the UI

## Troubleshooting

### OAuth Issues
- Ensure the redirect URI matches exactly: `http://localhost:1959/callback`
- Check that all environment variables are properly set
- Verify that port 1959 is not blocked by firewall

### Webhook Issues
- Verify webhook secret is correctly configured
- Check backend logs for webhook processing errors
- Ensure webhook URL is publicly accessible (for production)

### UI Issues
- Check browser console for any JavaScript errors
- Verify that the Tauri commands are properly registered
- Ensure the backend API endpoints are responding correctly