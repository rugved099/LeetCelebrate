/**
 * LeetCelebrate — auth-content.js
 *
 * Runs on https://leetcelebrate.onrender.com/auth/success.
 * Captures the OAuth access token from the page and passes it to the extension.
 */

(function () {
  console.log('[LeetCode-Sync-Auth] Auth success content script loaded.');

  const carrier = document.getElementById('auth-token-carrier');
  if (!carrier) {
    console.error('[LeetCode-Sync-Auth] Auth token carrier element not found.');
    return;
  }

  const token = carrier.getAttribute('data-token');

  if (token) {
    console.log('[LeetCode-Sync-Auth] Securely captured token. Sending to background service worker...');
    
    chrome.runtime.sendMessage(
      { type: 'SAVE_GITHUB_TOKEN', payload: token },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[LeetCode-Sync-Auth] Error communicating token to background:', chrome.runtime.lastError.message);
          return;
        }

        if (response && response.success) {
          console.log('[LeetCode-Sync-Auth] Token successfully stored. Closing tab...');
          // Delay briefly to allow user to see success state
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          console.error('[LeetCode-Sync-Auth] Background script failed to save token:', response?.error);
        }
      }
    );
  } else {
    console.error('[LeetCode-Sync-Auth] Token was empty inside carrier.');
  }
})();
