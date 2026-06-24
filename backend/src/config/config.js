require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  githubRedirectUri: process.env.GITHUB_REDIRECT_URI,
};

// Simple validation
const missingKeys = [];
if (!config.githubClientId || config.githubClientId === 'your_github_client_id_here') {
  missingKeys.push('GITHUB_CLIENT_ID');
}
if (!config.githubClientSecret || config.githubClientSecret === 'your_github_client_secret_here') {
  missingKeys.push('GITHUB_CLIENT_SECRET');
}

if (missingKeys.length > 0) {
  console.warn(`[WARNING] Missing or default environment variables: ${missingKeys.join(', ')}. GitHub login will fail until these are configured in backend/.env.`);
}

module.exports = config;
