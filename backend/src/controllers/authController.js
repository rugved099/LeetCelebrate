const githubService = require('../services/githubService');
const config = require('../config/config');

/**
 * Redirects the user to GitHub's OAuth authorization page.
 */
function redirectToGithub(req, res) {
  const clientId = config.githubClientId;
  const redirectUri = encodeURIComponent(config.githubRedirectUri);
  const scope = 'repo';
  // Use state to prevent CSRF, or pass along custom extension state if needed
  const state = req.query.state || 'lc-sync-state';

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  res.redirect(githubAuthUrl);
}

/**
 * Handles the GitHub callback, exchanges the code for a token, and redirects to a success page.
 */
async function handleCallback(req, res, next) {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.redirect(`/auth/error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(error_description || '')}`);
  }

  if (!code) {
    return res.redirect('/auth/error?error=no_code&description=No+authorization+code+received');
  }

  try {
    const tokenData = await githubService.exchangeCodeForToken(code);
    const token = tokenData.access_token;

    // Redirect to the success page with the token
    // We pass it via query initially, but our success page will immediately consume and clear it
    res.redirect(`/auth/success?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[authController] Error in OAuth callback:', err.message);
    res.redirect(`/auth/error?error=exchange_failed&description=${encodeURIComponent(err.message)}`);
  }
}

/**
 * Renders a premium, modern success page containing the token.
 */
function renderSuccessPage(req, res) {
  const token = req.query.token || '';

  // Return a stunning, premium dark-themed success page
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authentication Successful</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #0d1117;
          --panel: #161b22;
          --border: #30363d;
          --primary: #2ea44f;
          --text: #c9d1d9;
          --text-muted: #8b949e;
          --glow: rgba(46, 164, 79, 0.4);
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background-color: var(--bg);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
        }
        .container {
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          max-width: 480px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 40px rgba(46, 164, 79, 0.1);
          transform: translateY(20px);
          opacity: 0;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideUp {
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .success-icon-container {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(46, 164, 79, 0.1);
          border: 2px solid var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          box-shadow: 0 0 20px var(--glow);
          animation: pulse 2s infinite alternate;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 10px var(--glow); }
          100% { box-shadow: 0 0 25px var(--glow); }
        }
        .success-icon {
          font-size: 40px;
          color: var(--primary);
          animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s both;
        }
        @keyframes scaleIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        h1 {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          font-size: 16px;
          color: var(--text-muted);
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .spinner {
          border: 3px solid var(--border);
          border-top: 3px solid var(--primary);
          border-radius: 50%;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        /* Hidden token container for the extension content script to read */
        #auth-token-carrier {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon-container">
          <span class="success-icon">✓</span>
        </div>
        <h1>Successfully Connected!</h1>
        <p>LeetCelebrate is configuring your workspace. This page will close automatically in a moment.</p>
        <div class="spinner"></div>
      </div>
      
      <!-- Safe carrier for the token that the chrome extension can scrape -->
      <div id="auth-token-carrier" data-token="${token}"></div>

      <script>
        // Immediately strip the token from the URL for security
        if (window.history.replaceState) {
          const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
      </script>
    </body>
    </html>
  `);
}

/**
 * Renders an error page.
 */
function renderErrorPage(req, res) {
  const { error, description } = req.query;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authentication Failed</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #0d1117;
          --panel: #161b22;
          --border: #30363d;
          --error: #f85149;
          --text: #c9d1d9;
          --text-muted: #8b949e;
          --glow: rgba(248, 81, 73, 0.4);
        }
        body {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background-color: var(--bg);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          max-width: 480px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 40px rgba(248, 81, 73, 0.1);
        }
        .error-icon-container {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(248, 81, 73, 0.1);
          border: 2px solid var(--error);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          box-shadow: 0 0 20px var(--glow);
        }
        .error-icon {
          font-size: 40px;
          color: var(--error);
        }
        h1 {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 12px;
          color: #f85149;
        }
        p {
          font-size: 16px;
          color: var(--text-muted);
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .error-details {
          background-color: #0d1117;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          font-family: monospace;
          font-size: 14px;
          color: #ff7b72;
          word-break: break-all;
          text-align: left;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon-container">
          <span class="error-icon">✕</span>
        </div>
        <h1>Connection Failed</h1>
        <p>An error occurred while connecting your GitHub account. Please try again.</p>
        <div class="error-details">
          <strong>Error:</strong> ${error || 'unknown_error'}<br>
          <strong>Details:</strong> ${description || 'No additional details provided.'}
        </div>
      </div>
    </body>
    </html>
  `);
}

module.exports = {
  redirectToGithub,
  handleCallback,
  renderSuccessPage,
  renderErrorPage,
};
