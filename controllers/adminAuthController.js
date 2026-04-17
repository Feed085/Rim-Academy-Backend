const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const getAllowedEmails = () => (process.env.ADMIN_GOOGLE_ALLOWED_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

let googleClient = null;

const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return null;
  }

  if (!googleClient) {
    googleClient = new OAuth2Client(clientId);
  }

  return googleClient;
};

exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential tələb olunur' });
    }

    const client = getGoogleClient();
    const allowedEmails = getAllowedEmails();

    if (!client) {
      return res.status(500).json({ success: false, message: 'GOOGLE_CLIENT_ID təyin edilməyib' });
    }

    if (allowedEmails.length === 0) {
      return res.status(500).json({ success: false, message: 'ADMIN_GOOGLE_ALLOWED_EMAILS təyin edilməyib' });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = (payload?.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(401).json({ success: false, message: 'Google hesab email-i tapılmadı' });
    }

    if (!payload?.email_verified) {
      return res.status(401).json({ success: false, message: 'Google email təsdiqlənməyib' });
    }

    if (!allowedEmails.includes(email)) {
      return res.status(403).json({ success: false, message: 'Bu hesab üçün giriş icazəsi yoxdur' });
    }

    const token = jwt.sign(
      {
        email,
        name: payload?.name || '',
        picture: payload?.picture || '',
        role: 'admin',
      },
      process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          email,
          name: payload?.name || '',
          picture: payload?.picture || '',
        },
      },
    });
  } catch (error) {
    console.error('Admin Google login failed:', error);
    return res.status(401).json({ success: false, message: 'Google girişi uğursuz oldu' });
  }
};