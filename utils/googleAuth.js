const { OAuth2Client } = require('google-auth-library');

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

const verifyGoogleCredential = async (credential) => {
  const client = getGoogleClient();

  if (!client) {
    const error = new Error('GOOGLE_CLIENT_ID təyin edilməyib');
    error.statusCode = 500;
    throw error;
  }

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
};

module.exports = {
  getGoogleClient,
  verifyGoogleCredential,
};