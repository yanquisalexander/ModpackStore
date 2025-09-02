# Twitch Subscription-Based Access System

This system allows modpack creators to restrict access to their content based on Twitch subscriptions, enabling monetization through Twitch's subscription system.

## Features

- **User Twitch Linking**: Users can link their Twitch accounts through their profile
- **Subscription Verification**: Real-time verification of Twitch subscriptions
- **Modpack Access Control**: Creators can enable Twitch subscription requirements
- **Multiple Channel Support**: Support for requiring subscriptions to any of multiple channels
- **Seamless Integration**: Built on top of existing OAuth infrastructure

## Setup

### Environment Variables

Add the following environment variables to your backend `.env` file:

```env
# Twitch OAuth Configuration
TWITCH_CLIENT_ID=your_twitch_client_id_here
TWITCH_CLIENT_SECRET=your_twitch_client_secret_here
TWITCH_REDIRECT_URI=http://localhost:1958/callback
```

### Twitch Application Setup

1. Go to the [Twitch Developer Console](https://dev.twitch.tv/console)
2. Create a new application
3. Set the OAuth Redirect URL to `http://localhost:1958/callback` (or your production URL)
4. Note your Client ID and Client Secret
5. Add them to your environment variables

### Database Migration

Run the database migration to add the required fields:

```bash
# In the backend directory
npm run db:migrate
```

This will add:
- `twitch_id`, `twitch_access_token`, `twitch_refresh_token` to the `users` table
- `requires_twitch_subscription`, `twitch_creator_ids` to the `modpacks` table

## Usage

### For Users

1. **Link Twitch Account**:
   - Go to your profile page (`/profile`)
   - Click "Link Twitch Account" in the integrations section
   - Complete the OAuth flow in your browser
   - Your Twitch account is now linked

2. **Access Protected Content**:
   - When viewing a Twitch-protected modpack, you'll see subscription requirements
   - If you're subscribed to any of the required channels, you can access the content
   - If not, you'll see links to subscribe to the channels

### For Creators

1. **Enable Twitch Protection**:
   - When creating or editing a modpack, find the "Twitch Settings" section
   - Toggle "Require Twitch Subscription"
   - Add one or more Twitch channel names or IDs that users must be subscribed to

2. **Manage Channels**:
   - You can add multiple channels (users need to be subscribed to at least one)
   - Use either the channel name (e.g., "channelname") or Twitch user ID
   - You can add/remove channels at any time

### For Administrators

The system integrates with the existing admin panel for managing modpack settings and user accounts.

## Technical Details

### OAuth Flow

1. User clicks "Link Twitch Account" on their profile
2. Frontend calls `start_twitch_auth` Tauri command
3. Rust server starts listening on port 1958
4. Browser opens Twitch OAuth URL
5. User completes OAuth on Twitch
6. Twitch redirects to `http://localhost:1958/callback` with authorization code
7. Rust server receives the code and sends it to the backend
8. Backend exchanges code for access/refresh tokens and links the account

### Subscription Verification

1. When user attempts to access protected content, backend checks:
   - Is the user's Twitch account linked?
   - Are their tokens still valid? (refreshes if needed)
   - Are they subscribed to any of the required channels?
2. Uses Twitch API to verify subscription status in real-time
3. Grants or denies access based on verification results

### Components

- **TwitchLinkingComponent**: Profile integration for linking accounts
- **TwitchRequirements**: Shows subscription requirements on modpack pages
- **TwitchSettingsComponent**: Creator/admin interface for configuring modpack requirements
- **TwitchService**: Backend service handling OAuth and subscription verification
- **ModpackAccessService**: Centralized access control logic

## Security Considerations

- Twitch access tokens are encrypted in the database
- Refresh tokens are used to maintain long-term access without re-authentication
- All API calls to Twitch use proper authentication headers
- Subscription status is verified server-side to prevent tampering

## Future Enhancements

The modular architecture supports easy addition of:
- YouTube membership verification
- Patreon subscription checking
- Discord server membership requirements
- Custom subscription tiers and pricing

## Troubleshooting

### Common Issues

1. **"Twitch OAuth credentials not configured"**
   - Ensure `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are set in environment variables

2. **"Failed to link Twitch account"**
   - Check that the redirect URI matches exactly in Twitch app settings
   - Verify the Rust server is running on port 1958

3. **"Unable to verify Twitch subscriptions"**
   - Check that user's Twitch tokens are still valid
   - Verify the channel IDs are correct
   - Ensure the Twitch API is accessible

### Logs

Check the application logs for detailed error messages:
- Rust logs: Look for "Twitch" related messages in the Tauri console
- Backend logs: Check for API call failures and database errors
- Frontend logs: Browser console will show component-level errors

## API Endpoints

### Twitch OAuth
- `GET /auth/twitch/callback` - Handle OAuth callback (requires authentication)
- `POST /auth/twitch/unlink` - Unlink Twitch account (requires authentication)
- `GET /auth/twitch/status` - Get Twitch link status (requires authentication)

### Modpack Access
- Access control is integrated into existing modpack endpoints
- Download/access requests automatically verify subscription requirements