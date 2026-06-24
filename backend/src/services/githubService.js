const axios = require('axios');
const config = require('../config/config');

/**
 * Exchanges OAuth authorization code for a GitHub access token.
 * @param {string} code - The authorization code from GitHub callback.
 * @returns {Promise<Object>} The access token data from GitHub.
 */
async function exchangeCodeForToken(code) {
  try {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code: code,
        redirect_uri: config.githubRedirectUri,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.error) {
      throw new Error(response.data.error_description || response.data.error);
    }

    return response.data; // contains access_token, token_type, scope
  } catch (error) {
    console.error('[githubService] Error exchanging code for token:', error.message);
    throw error;
  }
}

module.exports = {
  exchangeCodeForToken,
};
