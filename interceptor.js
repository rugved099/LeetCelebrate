/**
 * LeetCelebrate — interceptor.js
 *
 * This file runs in "world": "MAIN" (LeetCode's own JS context, not the
 * isolated content-script world). This bypasses LeetCode's Content Security
 * Policy (CSP) and lets us patch window.fetch / XMLHttpRequest directly.
 *
 * When a submission POST is detected, we extract the submission_id from the
 * response and post it to the isolated content script via window.postMessage.
 */

(function () {
  if (window.__lcIntercepted) return;
  window.__lcIntercepted = true;

  function notifyContentScript(submissionId) {
    console.log('[LC-Interceptor] submission_id captured:', submissionId);
    window.postMessage(
      { source: 'lc-intercept', type: 'SUBMIT_ID', id: submissionId },
      '*'
    );
  }

  /* ── Patch window.fetch ──────────────────────────────────────────────────── */
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const url =
      args[0] instanceof Request ? args[0].url : String(args[0] || '');
    const res = await _fetch.apply(this, args);

    try {
      // REST submit: POST /problems/{slug}/submit/
      if (/\/problems\/[^/]+\/submit\/?$/.test(url)) {
        const data = await res.clone().json();
        if (data && data.submission_id) {
          notifyContentScript(data.submission_id);
        }
      }

      // GraphQL: some regions use submitCode mutation
      if (url.includes('/graphql')) {
        const body =
          args[1] && args[1].body ? String(args[1].body) : '';
        if (body.includes('submitCode') || body.includes('submit_code')) {
          const data = await res.clone().json();
          const id =
            data?.data?.submitCode?.submissionId ||
            data?.data?.submit_code?.submission_id ||
            null;
          if (id) notifyContentScript(id);
        }
      }
    } catch (_) {}

    return res;
  };

  /* ── Patch XMLHttpRequest (fallback) ─────────────────────────────────────── */
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._lcUrl = String(url || '');
    this._lcMethod = String(method || '').toUpperCase();
    return _open.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (
      this._lcMethod === 'POST' &&
      /\/problems\/[^/]+\/submit\/?$/.test(this._lcUrl)
    ) {
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          if (data && data.submission_id) notifyContentScript(data.submission_id);
        } catch (_) {}
      });
    }
    return _send.apply(this, args);
  };

  console.log('[LC-Interceptor] fetch + XHR patched (MAIN world).');
})();
