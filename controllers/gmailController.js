const { google } = require('googleapis');
const prisma = require('../config/prisma');

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  `${process.env.BACKEND_URL}/api/gmail/callback`
);

// Generate Gmail OAuth URL
exports.getAuthUrl = async (req, res) => {
  try {
    console.log('Gmail auth-url request from user:', req.userId);
    console.log('GMAIL_CLIENT_ID:', process.env.GMAIL_CLIENT_ID);
    console.log('BACKEND_URL:', process.env.BACKEND_URL);
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.metadata'
      ],
      prompt: 'consent',
      state: req.userId, // Pass user ID for callback
    });
    
    console.log('Generated auth URL:', authUrl);
    res.json({ authUrl });
  } catch (error) {
    console.error('Gmail auth-url error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL', details: error.message });
  }
};

// Handle OAuth callback
exports.handleCallback = async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token,
        gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    res.redirect(`${process.env.FRONTEND_URL}/gmail-callback?gmail=connected`);
  } catch (error) {
    console.error('Gmail OAuth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/gmail-callback?gmail=error`);
  }
};

// Get Gmail connection status
exports.getStatus = async (req, res) => {
  try {
    console.log('Gmail status check for user:', req.userId);
    
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { gmailAccessToken: true, gmailRefreshToken: true },
    });
    
    console.log('Gmail connected:', !!(user?.gmailAccessToken && user?.gmailRefreshToken));
    
    res.json({ 
      connected: !!(user?.gmailAccessToken && user?.gmailRefreshToken) 
    });
  } catch (error) {
    console.error('Gmail status error:', error);
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
};

// Disconnect Gmail
exports.disconnect = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { gmailAccessToken: true },
    });

    // Revoke token with Google
    if (user?.gmailAccessToken) {
      try {
        await oauth2Client.revokeToken(user.gmailAccessToken);
      } catch (e) {
        console.error('Token revocation failed:', e);
      }
    }

    // Clear tokens from database
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        gmailAccessToken: null,
        gmailRefreshToken: null,
        gmailTokenExpiry: null,
      },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
};

// Helper: Get valid access token (refresh if needed)
async function getValidAccessToken(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      gmailAccessToken: true,
      gmailRefreshToken: true,
      gmailTokenExpiry: true,
    },
  });

  if (!user?.gmailRefreshToken) {
    throw new Error('Gmail not connected');
  }

  // Check if token is expired
  const now = new Date();
  if (user.gmailTokenExpiry && now >= user.gmailTokenExpiry) {
    // Refresh token
    oauth2Client.setCredentials({
      refresh_token: user.gmailRefreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update database
    await prisma.user.update({
      where: { id: userId },
      data: {
        gmailAccessToken: credentials.access_token,
        gmailTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });

    return credentials.access_token;
  }

  return user.gmailAccessToken;
}

// Send email via Gmail API
exports.sendEmail = async (userId, { to, subject, html, fromName, attachments = [] }) => {
  try {
    const accessToken = await getValidAccessToken(userId);
    
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // Create email message with From name
    const fromHeader = fromName ? `From: ${fromName} <${user.email}>` : `From: ${user.email}`;
    const message = [
      fromHeader,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return { success: true, messageId: result.data.id };
  } catch (error) {
    console.error('Gmail send error:', error);
    throw error;
  }
};

module.exports.getValidAccessToken = getValidAccessToken;
