/**
 * LeetCelebrate — content.js
 *
 * Runs in the isolated content script world.
 * - Injects interceptor.js in MAIN world.
 * - Receives intercepted submit ID or submissionDetails.
 * - Polls check API if necessary.
 * - Queries GraphQL API to get full code/details.
 * - Implements MutationObserver DOM fallback.
 */

// Prevent double execution on SPA navigation
if (!window.__lcSyncContentInit) {
  window.__lcSyncContentInit = true;
  initExtension();
}

function initExtension() {
  console.log('[LeetCelebrate-Content] Initializing LeetCelebrate content script...');

  // Track submission IDs we have already processed
  const processedSubmissions = new Set();
  let domFallbackArmed = false;
  let hasCelebratedOrSynced = false;

  /* ─────────────────────────────────────────────────────────────────────────────
     1. Listen for messages from interceptor.js (MAIN world)
     ──────────────────────────────────────────────────────────────────────────── */
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'lc-sync-intercept') return;

    const { type, payload } = event.data;

    if (type === 'SUBMIT_ID') {
      const { submissionId } = payload;
      if (processedSubmissions.has(String(submissionId))) return;
      
      console.log('[LeetCode-Sync-Content] Captured submission ID:', submissionId);
      processedSubmissions.add(String(submissionId));
      pollSubmissionCheck(submissionId);
    } 
    
    else if (type === 'SUBMISSION_DETAILS') {
      const details = payload;
      if (details.statusCode === 10 || details.statusDisplay === 'Accepted') {
        const subId = String(details.id || details.submissionId);
        if (processedSubmissions.has(subId)) return;
        
        processedSubmissions.add(subId);
        console.log('[LeetCode-Sync-Content] Intercepted accepted submission details:', details);
        
        hasCelebratedOrSynced = true;
        syncSubmission(formatSubmissionDetails(details));
      }
    }
  });

  /* ─────────────────────────────────────────────────────────────────────────────
     2. Poll Submission Check Endpoint
     ──────────────────────────────────────────────────────────────────────────── */
  function pollSubmissionCheck(submissionId) {
    const url = `https://leetcode.com/submissions/detail/${submissionId}/check/`;
    let pollCount = 0;
    
    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > 30) { // 30 * 2s = 60s timeout
        clearInterval(interval);
        processedSubmissions.delete(String(submissionId));
        console.warn('[LeetCode-Sync-Content] Polling timed out for ID:', submissionId);
        return;
      }

      try {
        const res = await fetch(url, {
          credentials: 'include',
          headers: { 'x-requested-with': 'XMLHttpRequest' }
        });
        const data = await res.json();
        
        console.log(`[LeetCode-Sync-Content] Polling submission ${submissionId} (Attempt ${pollCount}):`, data.state);

        if (data.state === 'SUCCESS') {
          clearInterval(interval);
          if (data.status_msg === 'Accepted') {
            console.log('[LeetCode-Sync-Content] 🎉 Submission accepted! Fetching full details...');
            hasCelebratedOrSynced = true;
            fetchAndSyncDetails(submissionId);
          } else {
            console.log('[LeetCode-Sync-Content] Verdict not Accepted:', data.status_msg);
          }
        }
      } catch (err) {
        console.error('[LeetCode-Sync-Content] Error polling check endpoint:', err.message);
      }
    }, 2000);
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     3. Fetch submission details via GraphQL
     ──────────────────────────────────────────────────────────────────────────── */
  async function fetchAndSyncDetails(submissionId) {
    try {
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
      
      const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrftoken': csrfToken,
        },
        body: JSON.stringify({
          query: `
            query submissionDetails($submissionId: Int!) {
              submissionDetails(submissionId: $submissionId) {
                runtimeDisplay
                memoryDisplay
                code
                timestamp
                statusCode
                lang {
                  name
                  verboseName
                }
                question {
                  questionId
                  titleSlug
                  title
                  difficulty
                }
              }
            }
          `,
          variables: { submissionId: parseInt(submissionId, 10) }
        })
      });

      const result = await response.json();
      const details = result?.data?.submissionDetails;

      if (details) {
        details.id = submissionId;
        syncSubmission(formatSubmissionDetails(details));
      } else {
        console.error('[LeetCode-Sync-Content] GraphQL details empty, trying DOM fallback...');
        runDOMFallback();
      }
    } catch (err) {
      console.error('[LeetCode-Sync-Content] GraphQL query failed:', err.message);
      runDOMFallback();
    }
  }

  /**
   * Formats the GraphQL response into the unified sync structure.
   */
  function formatSubmissionDetails(details) {
    return {
      problemId: details.question.questionId,
      problemTitle: details.question.title,
      problemSlug: details.question.titleSlug,
      difficulty: details.question.difficulty,
      language: details.lang.verboseName || details.lang.name,
      runtime: details.runtimeDisplay,
      memory: details.memoryDisplay,
      submissionId: String(details.id || details.submissionId || Date.now()),
      timestamp: String(details.timestamp || Math.floor(Date.now() / 1000)),
      code: details.code
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     4. Fallback DOM MutationObserver
     ──────────────────────────────────────────────────────────────────────────── */
  const observer = new MutationObserver(() => {
    const textContent = (document.body?.innerText || '').toLowerCase();

    // 1. Arm if judging/pending state detected
    if (!domFallbackArmed) {
      if (textContent.includes('judging') || textContent.includes('pending') || textContent.includes('evaluating')) {
        domFallbackArmed = true;
        hasCelebratedOrSynced = false;
        console.log('[LeetCode-Sync-Content] DOM fallback armed (judging detected).');
      }
    } else {
      // 2. If armed, look for Accepted state and test cases passed
      const hasAccepted = textContent.includes('accepted');
      // Look for the "N / N testcases passed" format in the DOM to make sure it's a full submit
      const hasTestcasesPassed = /testcases?\s*passed/i.test(textContent);

      if (hasAccepted && hasTestcasesPassed && !hasCelebratedOrSynced) {
        hasCelebratedOrSynced = true;
        domFallbackArmed = false;
        console.log('[LeetCode-Sync-Content] DOM fallback triggered: Accepted detected.');
        runDOMFallback();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  /* ─────────────────────────────────────────────────────────────────────────────
     5. DOM Fallback Flow: Query GraphQL for latest submissions
     ──────────────────────────────────────────────────────────────────────────── */
  async function runDOMFallback() {
    console.log('[LeetCode-Sync-Content] Running DOM GraphQL fallback...');
    
    // Extract slug from URL
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    if (!match) {
      console.warn('[LeetCode-Sync-Content] Could not extract problem slug from path:', window.location.pathname);
      return;
    }
    const slug = match[1];

    try {
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
      
      // Fetch user's submissions list for this problem slug
      const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrftoken': csrfToken,
        },
        body: JSON.stringify({
          query: `
            query questionSubmissionList($questionSlug: String!, $offset: Int!, $limit: Int!) {
              questionSubmissionList(questionSlug: $questionSlug, offset: $offset, limit: $limit) {
                submissions {
                  id
                  statusDisplay
                  lang
                  title
                }
              }
            }
          `,
          variables: { questionSlug: slug, offset: 0, limit: 5 }
        })
      });

      const result = await response.json();
      const submissions = result?.data?.questionSubmissionList?.submissions || [];
      
      // Find the first "Accepted" submission
      const acceptedSub = submissions.find(s => s.statusDisplay === 'Accepted');
      
      if (acceptedSub) {
        console.log('[LeetCode-Sync-Content] DOM Fallback found accepted submission ID:', acceptedSub.id);
        fetchAndSyncDetails(acceptedSub.id);
      } else {
        console.warn('[LeetCode-Sync-Content] DOM Fallback: No accepted submission found in recent list.');
      }
    } catch (err) {
      console.error('[LeetCode-Sync-Content] DOM Fallback failed to query submissions list:', err.message);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     6. Sync Submission with Background Worker
     ──────────────────────────────────────────────────────────────────────────── */
  function syncSubmission(payload) {
    console.log('[LeetCode-Sync-Content] Sending submission to background for sync:', payload.problemTitle);
    
    chrome.runtime.sendMessage(
      { type: 'SUBMISSION_ACCEPTED', payload },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[LeetCode-Sync-Content] Error sending message to background:', chrome.runtime.lastError.message);
          return;
        }
        console.log('[LeetCode-Sync-Content] Background sync response:', response);
        
        if (response && response.success) {
          if (response.alreadyCelebrated) {
            console.log('[LeetCode-Sync-Content] Already celebrated this submission. Skipping animation.');
            return;
          }
          
          // Trigger visual celebration!
          triggerCelebration(response.xpGained, response.newAchievements);
        }
      }
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     7. Gamified Celebrations (confetti, sounds, achievements)
     ──────────────────────────────────────────────────────────────────────────── */
  
  function triggerCelebration(xpGained, newAchievements) {
    console.log(`[LeetCode-Sync-Content] 🎉 Celebrating accepted solution (+${xpGained} XP)`);
    
    // Play triumph sound
    playSuccessSound();

    // Create celebration overlay
    const overlay = document.createElement('div');
    overlay.className = 'leet-celebrate-overlay';

    // Create confetti canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'leet-celebrate-canvas';
    overlay.appendChild(canvas);

    // Create ACCEPTED text
    const text = document.createElement('div');
    text.className = 'celebration-text';
    text.innerText = 'ACCEPTED!';
    overlay.appendChild(text);

    // Create floating XP gain text
    const xpEl = document.createElement('div');
    xpEl.className = 'xp-gain';
    xpEl.innerText = `+${xpGained || 50} XP`;
    overlay.appendChild(xpEl);

    document.body.appendChild(overlay);
    
    // Start confetti physics loop
    startConfetti(canvas);

    // Trigger achievement toasts (delayed sequence)
    (newAchievements || []).forEach((id, i) => {
      setTimeout(() => showAchievementToast(id), 1500 + i * 1200);
    });

    // Fade out and cleanup celebration overlay
    setTimeout(() => {
      overlay.style.transition = 'opacity 1.2s ease';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 1200);
    }, 3800);
  }

  function playSuccessSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playTone = (freq, start, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + duration);
      };

      // Play C5 -> E5 -> G5 -> C6 sequence
      playTone(523.25, 0, 0.1);
      playTone(659.25, 0.1, 0.1);
      playTone(783.99, 0.2, 0.1);
      playTone(1046.50, 0.3, 0.45);
    } catch (err) {
      console.warn('[LeetCode-Sync-Content] AudioContext could not play sound:', err.message);
    }
  }

  function showAchievementToast(id) {
    const info = ({
      FIRST_STEP:   { title: 'First Step',     desc: 'Solved your first problem!', icon: '🌱' },
      TEN_PROBLEMS: { title: 'Getting Started', desc: 'Solved 10 problems!',       icon: '🔥' },
      CENTURION:    { title: 'Centurion',       desc: 'Solved 100 problems!',      icon: '💯' },
      WEEK_STREAK:  { title: 'Consistent',      desc: '7 days streak!',            icon: '📅' },
      MONTH_STREAK: { title: 'Unstoppable',     desc: '30 days streak!',           icon: '🏆' }
    })[id] || { title: 'Achievement Unlocked', desc: 'Congratulations!', icon: '⭐' };

    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = `
      <div class="achievement-icon">${info.icon}</div>
      <div class="achievement-info">
        <h4>Achievement Unlocked</h4>
        <p>${info.title}</p>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // Slide in
    setTimeout(() => popup.classList.add('show'), 50);
    
    // Slide out and clean up
    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 600);
    }, 4500);
  }

  function startConfetti(canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const pieces = [];
    const colors = ['#3a86ff', '#8338ec', '#ff006e', '#ffbe0b', '#fb5607', '#2ea44f', '#ffffff'];

    // Auto-resize canvas on window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let animationFrameId;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Spawn new pieces
      if (pieces.length < 150) {
        pieces.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height - canvas.height,
          r: Math.random() * 360,
          c: colors[Math.floor(Math.random() * colors.length)],
          s: Math.random() * 8 + 6,
          v: Math.random() * 2.5 + 2,
          rs: Math.random() * 6 - 3
        });
      }

      // Draw and update pieces
      pieces.forEach((p, i) => {
        p.y += p.v;
        p.r += p.rs;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.r * Math.PI) / 180);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.restore();

        // Remove offscreen pieces
        if (p.y > canvas.height) {
          pieces.splice(i, 1);
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    }

    draw();

    // Cleanup resize listener and animations when element is destroyed
    const cleanupObserver = new MutationObserver((mutations) => {
      if (!document.body.contains(canvas)) {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
        cleanupObserver.disconnect();
      }
    });
    cleanupObserver.observe(document.body, { childList: true });
  }
}
