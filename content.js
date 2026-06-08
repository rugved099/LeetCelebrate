/**
 * LeetCelebrate — content.js  (isolated world)
 *
 * Detection strategy:
 *   A) postMessage from interceptor.js (MAIN world) → poll /check/ API
 *   B) DOM MutationObserver fallback — watches for fresh "Accepted" result
 */

// ── Prevent double-init on SPA navigation ─────────────────────────────────────
if (!window.__lcContentInit) {
  window.__lcContentInit = true;
  init();
}

function init() {

/* ─────────────────────────────────────────────────────────────────────────────
   A) Listen for submission ID posted by interceptor.js
   ──────────────────────────────────────────────────────────────────────────── */
const polled = new Set();

window.addEventListener('message', (e) => {
  if (!e.data || e.data.source !== 'lc-intercept' || e.data.type !== 'SUBMIT_ID') return;
  const id = e.data.id;
  if (!id || polled.has(String(id))) return;
  polled.add(String(id));
  console.log('[LeetCelebrate] Got submission ID:', id);
  pollCheck(id);
});

function pollCheck(submissionId) {
  const url = `https://leetcode.com/submissions/detail/${submissionId}/check/`;
  let n = 0;
  console.log('[LeetCelebrate] Polling:', url);

  const timer = setInterval(() => {
    if (++n > 45) {                      // 45 × 2 s = 90 s timeout
      clearInterval(timer);
      polled.delete(String(submissionId));
      console.warn('[LeetCelebrate] Poll timed out for', submissionId);
      return;
    }

    fetch(url, {
      credentials: 'include',
      headers: { 'x-requested-with': 'XMLHttpRequest' }
    })
      .then(r => r.json())
      .then(data => {
        console.log('[LeetCelebrate] poll #' + n, '→', data.state, '|', data.status_msg);
        if (data.state !== 'SUCCESS') return;   // still judging
        clearInterval(timer);
        polled.delete(String(submissionId));
        if (data.status_msg === 'Accepted') {
          console.log('[LeetCelebrate] 🎉 Accepted!');
          domFallbackUsed = true;               // prevent DOM fallback double-fire
          handleSuccess(getProblemTitle(), getDifficulty(), String(submissionId));
        } else {
          console.log('[LeetCelebrate] Verdict:', data.status_msg);
        }
      })
      .catch(err => console.warn('[LeetCelebrate] poll error:', err.message));

  }, 2000);
}

/* ─────────────────────────────────────────────────────────────────────────────
   B) DOM MutationObserver fallback
   Watches for the accepted result panel appearing in the DOM.
   We look for an element that contains "Accepted" AND a large "N/N testcases passed"
   count (full submission) — not the Run-Code yellow-box results.
   We arm the fallback when a "Pending / Judging" state is seen, so we only
   fire on FRESH submissions, not page-loads or old-submission views.
   ──────────────────────────────────────────────────────────────────────────── */
let armed          = false;   // set true when judging state detected
let domFallbackUsed = false;  // prevent double celebration

function checkDOMForAccepted() {
  if (!armed || domFallbackUsed) return;

  // Look for the submission result text anywhere in the visible page
  const body = document.body;
  if (!body) return;

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
  let   node;
  let   foundAccepted = false;
  let   testcaseNode  = null;

  while ((node = walker.nextNode())) {
    const t = node.textContent.trim().toLowerCase();
    if (t === 'accepted') foundAccepted = true;
    // "1019 / 1019 testcases passed" — the number before "/" must be > 10
    // (Run-Code only has 2-3 sample cases, full submissions have many more)
    const m = t.match(/(\d+)\s*\/\s*\d+\s*testcases?\s*passed/);
    if (m && parseInt(m[1], 10) > 10) testcaseNode = node;
  }

  if (foundAccepted && testcaseNode) {
    domFallbackUsed = true;
    armed = false;
    console.log('[LeetCelebrate] DOM fallback fired: Accepted + testcases passed detected');
    handleSuccess(getProblemTitle(), getDifficulty(), 'dom_' + Date.now());
  }
}

// Watch for judging state → arm the fallback
// Watch for DOM changes → run accepted check
const observer = new MutationObserver(() => {
  const bodyText = (document.body?.innerText || '').toLowerCase();

  if (!armed) {
    if (bodyText.includes('judging') || bodyText.includes('pending') || bodyText.includes('evaluating')) {
      armed = true;
      domFallbackUsed = false;
      console.log('[LeetCelebrate] DOM fallback: armed (judging detected)');
    }
  } else {
    // Once armed, check every mutation for accepted result
    checkDOMForAccepted();
  }
});

observer.observe(document.body, { childList: true, subtree: true, characterData: true });


/* ─────────────────────────────────────────────────────────────────────────────
   "Made by Rug" watermark (bottom-right, Science Gothic font)
   ──────────────────────────────────────────────────────────────────────────── */

// Load Science Gothic from Google Fonts
const fontLink = document.createElement('link');
fontLink.rel  = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Science+Gothic&display=swap';
document.head.appendChild(fontLink);

const watermark = document.createElement('div');
watermark.id = 'lc-watermark';
watermark.textContent = 'LEETCELEBRATE-Made by Rug';
watermark.style.cssText = [
  'position:fixed',
  'bottom:18px',
  'right:20px',
  'z-index:2147483647',
  'font-family:"Science Gothic", sans-serif',
  'font-size:13px',
  'font-weight:400',
  'letter-spacing:0.08em',
  'color:rgba(255,255,255,0.18)',
  'pointer-events:none',
  'user-select:none',
  'text-rendering:optimizeLegibility'
].join(';');
document.body.appendChild(watermark);


/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */
function getProblemTitle() {
  const el = document.querySelector('span.text-title-large') ||
             document.querySelector('[data-cy="question-title"]') ||
             document.querySelector('a[href*="/problems/"]');
  return el
    ? (el.innerText || el.textContent).replace(/^\d+\.\s*/, '').trim()
    : 'Unknown Problem';
}

function getDifficulty() {
  const el = document.querySelector('div[class*="text-difficulty-"]') ||
             document.querySelector('.difficulty-label');
  if (!el) return 'Medium';
  const t = el.innerText || '';
  if (t.includes('Easy')) return 'Easy';
  if (t.includes('Hard')) return 'Hard';
  return 'Medium';
}

function handleSuccess(problemId, difficulty, submissionId) {
  const sid = submissionId || (window.location.pathname + '_' + Date.now());
  console.log(`[LeetCelebrate] handleSuccess → "${problemId}" (${difficulty}) sid=${sid}`);

  chrome.runtime.sendMessage(
    { type: 'PROBLEM_SOLVED', problemId, difficulty, submissionId: sid },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('[LeetCelebrate]', chrome.runtime.lastError.message);
        return;
      }
      if (response?.alreadyCelebrated) {
        console.log('[LeetCelebrate] Already celebrated, skipping.');
        return;
      }
      if (response) triggerCelebration(response.xpGained, response.newAchievements);
    }
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   Celebration UI
   ──────────────────────────────────────────────────────────────────────────── */
function triggerCelebration(xpGained, newAchievements) {
  if (window.playSuccessSound) window.playSuccessSound();

  const overlay = document.createElement('div');
  overlay.className = 'leet-celebrate-overlay';

  const canvas = document.createElement('canvas');
  canvas.className = 'leet-celebrate-canvas';
  overlay.appendChild(canvas);

  const text = document.createElement('div');
  text.className = 'celebration-text';
  text.innerText = 'ACCEPTED!';
  overlay.appendChild(text);

  const xpEl = document.createElement('div');
  xpEl.className = 'xp-gain';
  xpEl.innerText = `+${xpGained} XP`;
  overlay.appendChild(xpEl);

  document.body.appendChild(overlay);
  startConfetti(canvas);

  (newAchievements || []).forEach((id, i) => {
    setTimeout(() => showAchievement(id), 1500 + i * 1000);
  });

  setTimeout(() => {
    overlay.style.transition = 'opacity 1s';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 1000);
  }, 4000);
}

function showAchievement(id) {
  const popup = document.createElement('div');
  popup.className = 'achievement-popup';
  const info = ({
    FIRST_STEP:   { title: 'First Step',     icon: '🌱' },
    TEN_PROBLEMS: { title: 'Getting Started', icon: '🔥' },
    CENTURION:    { title: 'Centurion',       icon: '💯' },
    WEEK_STREAK:  { title: 'Consistent',      icon: '📅' },
    MONTH_STREAK: { title: 'Unstoppable',     icon: '🏆' }
  })[id] || { title: 'Achievement', icon: '⭐' };

  popup.innerHTML = `
    <div class="achievement-icon">${info.icon}</div>
    <div class="achievement-info"><h4>Achievement Unlocked</h4><p>${info.title}</p></div>
  `;
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add('show'), 100);
  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => popup.remove(), 500);
  }, 5000);
}

function startConfetti(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const pieces = [];
  const colors = ['#f00','#0f0','#00f','#ff0','#0ff','#f0f','#ffd700'];

  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pieces.length < 200) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 360,
        c: colors[Math.random() * colors.length | 0],
        s: Math.random() * 10 + 5,
        v: Math.random() * 3 + 2,
        rs: Math.random() * 10 - 5
      });
    }
    pieces.forEach((p, i) => {
      p.y += p.v; p.r += p.rs;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r * Math.PI / 180);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
      ctx.restore();
      if (p.y > canvas.height) pieces.splice(i, 1);
    });
    requestAnimationFrame(draw);
  })();
}

} // end init()
