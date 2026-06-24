/**
 * LeetCelebrate — interceptor.js
 *
 * Runs in the MAIN world to patch fetch and XHR, intercepting GraphQL
 * and REST calls for submissions.
 */

(function () {
  if (window.__lcSyncIntercepted) return;
  window.__lcSyncIntercepted = true;

  console.log('[LeetCode-Sync-Interceptor] Main world fetch/XHR interceptor loaded.');

  function notifyContentScript(type, payload) {
    window.postMessage(
      { source: 'lc-sync-intercept', type, payload },
      '*'
    );
  }

  /* ── Patch fetch ────────────────────────────────────────────────────────── */
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args[0] instanceof Request ? args[0].url : String(args[0] || '');
    const response = await originalFetch.apply(this, args);

    try {
      // 1. Intercept REST submit endpoint: POST /problems/{slug}/submit/
      if (/\/problems\/[^/]+\/submit\/?/.test(url)) {
        const clonedRes = response.clone();
        const data = await clonedRes.json();
        if (data && data.submission_id) {
          console.log('[LeetCode-Sync-Interceptor] Intercepted REST submission ID:', data.submission_id);
          notifyContentScript('SUBMIT_ID', { submissionId: data.submission_id });
        }
      }

      // 2. Intercept GraphQL calls
      if (url.includes('/graphql')) {
        const options = args[1] || {};
        let requestBody = '';
        
        if (options.body) {
          requestBody = typeof options.body === 'string' ? options.body : '';
        }

        // Check if this is a submission trigger (GraphQL submitCode mutation)
        if (requestBody.includes('submitCode') || requestBody.includes('submit_code')) {
          const clonedRes = response.clone();
          const data = await clonedRes.json();
          const id = data?.data?.submitCode?.submissionId || data?.data?.submit_code?.submission_id;
          if (id) {
            console.log('[LeetCode-Sync-Interceptor] Intercepted GraphQL submission ID:', id);
            notifyContentScript('SUBMIT_ID', { submissionId: id });
          }
        }

        // Check if this is fetching detailed submission info
        if (requestBody.includes('submissionDetails')) {
          const clonedRes = response.clone();
          const data = await clonedRes.json();
          const details = data?.data?.submissionDetails;
          if (details) {
            console.log('[LeetCode-Sync-Interceptor] Intercepted GraphQL submissionDetails:', details);
            notifyContentScript('SUBMISSION_DETAILS', details);
          }
        }
      }
    } catch (err) {
      // Fail silently to not impact LeetCode page functionality
    }

    return response;
  };

  /* ── Patch XMLHttpRequest (fallback) ─────────────────────────────────────── */
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._lcSyncUrl = String(url || '');
    this._lcSyncMethod = String(method || '').toUpperCase();
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const xhr = this;
    if (
      xhr._lcSyncMethod === 'POST' &&
      /\/problems\/[^/]+\/submit\/?/.test(xhr._lcSyncUrl)
    ) {
      xhr.addEventListener('load', function () {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data && data.submission_id) {
            console.log('[LeetCode-Sync-Interceptor] Intercepted XHR REST submission ID:', data.submission_id);
            notifyContentScript('SUBMIT_ID', { submissionId: data.submission_id });
          }
        } catch (_) {}
      });
    }
    return originalSend.apply(this, args);
  };
})();
