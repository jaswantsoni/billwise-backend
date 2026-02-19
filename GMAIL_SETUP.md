# Gmail OAuth Setup Instructions

## 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Gmail API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

## 2. Configure OAuth Consent Screen (Test Mode)

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose **"External"** user type
3. Fill in:
   - App name: **Kampony**
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - Click "Add or Remove Scopes"
   - Search and add: `https://www.googleapis.com/auth/gmail.send`
5. **Add test users** (REQUIRED for test mode):
   - Click "Add Users"
   - Add email addresses that will test the integration
   - Only these emails can authorize the app in test mode
6. Save and continue
7. **Keep app in "Testing" status** (do not publish)
   - In test mode, only added test users can connect
   - No verification required
   - 100 user limit

## 3. Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: **Web application**
4. Name: **Kampony Gmail Integration**
5. Authorized redirect URIs:
   ```
   http://localhost:3000/api/gmail/callback
   https://your-backend-domain.com/api/gmail/callback
   ```
   Note: Frontend will handle the redirect at `/gmail-callback` route
6. Click "Create"
7. Copy **Client ID** and **Client Secret**

## 4. Update Environment Variables

Add to `.env`:
```bash
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:8080
```

## 5. Update Database Schema

Run:
```bash
npx prisma db push
```

## 6. Install Dependencies

```bash
npm install googleapis
```

## 7. Test Integration

1. Start backend: `npm run dev`
2. Start frontend: `npm run dev`
3. Navigate to `/gmail-settings`
4. Click "Connect Gmail"
5. Authorize the app
6. Check connection status

## Security Notes

- ✅ Only `gmail.send` scope requested (no inbox access)
- ✅ Tokens stored in database (not frontend)
- ✅ Automatic token refresh implemented
- ✅ Token revocation on disconnect
- ✅ Separate from login OAuth
- ✅ **Test mode**: Only whitelisted test users can connect
- ⚠️ **Test mode limitation**: Refresh tokens expire after 7 days if app not published

## Usage in Code

Send email via Gmail:
```javascript
const { sendEmail } = require('./controllers/gmailController');

await sendEmail(userId, {
  to: 'customer@example.com',
  subject: 'Invoice #123',
  html: '<h1>Your Invoice</h1>',
});
```

## Troubleshooting

**Error: redirect_uri_mismatch**
- Ensure callback URL in Google Console matches exactly
- Include protocol (http/https)
- No trailing slash

**Error: access_denied**
- User declined authorization
- Check OAuth consent screen configuration

**Error: invalid_grant**
- Refresh token expired or revoked
- User needs to reconnect Gmail

**Error: "Access blocked: This app's request is invalid"**
- User email not added to test users list
- Go to OAuth consent screen > Test users > Add the email

**Test Mode Limitations**
- Only 100 test users allowed
- Refresh tokens expire after 7 days (reconnect required)
- To remove 7-day limit: Publish app (requires verification)



investigate what is wrong with SEO implementation as this project ahs many features including, GST invoice create, performa create, credit/debit ote create, purchase entry, inventory management, client communication with gmail apis, whatsapp apis. auto gst details verify auto HSN/SAC search