// Visual confirmation that script is running (using your logo)
let lastSolvedProblem = null;
const statusIndicator = document.createElement('div');
statusIndicator.style.cssText = 'position:fixed;top:15px;right:15px;z-index:999999;width:32px;height:32px;border-radius:8px;background:rgba(15, 23, 42, 0.8);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid rgba(16, 185, 129, 0.3);box-shadow:0 0 15px rgba(16, 185, 129, 0.2);transition:all 0.3s;';
statusIndicator.innerHTML = `<img src="${chrome.runtime.getURL('icons/logo.svg')}" style="width:20px;height:20px;filter:drop-shadow(0 0 5px rgba(16, 185, 129, 0.5));">`;
statusIndicator.title = 'LeetCelebrate: Active';
statusIndicator.onclick = () => handleSuccess('Test Problem', 'Hard');
statusIndicator.onmouseover = () => statusIndicator.style.transform = 'scale(1.1)';
statusIndicator.onmouseout = () => statusIndicator.style.transform = 'scale(1.0)';
document.body.appendChild(statusIndicator);

function findTextEverywhere(query) {
  const lowerQuery = query.toLowerCase();
  // Check main document
  if (document.body.innerText.toLowerCase().includes(lowerQuery)) return true;
  
  // Check all shadow roots
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot && el.shadowRoot.textContent.toLowerCase().includes(lowerQuery)) return true;
  }
  return false;
}

// MutationObserver...

// Demo event listener for demonstration purposes
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'celebrate_demo') {
    handleSuccess('Demo Problem', 'Hard');
  }
});

// MutationObserver to detect the "Accepted" verdict
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList' || mutation.type === 'characterData') {
      if (findTextEverywhere('Accepted') && (window.location.href.includes('submissions') || document.querySelector('[data-e2e-locator="submission-result"]'))) {
        const problemTitle = getProblemTitle();
        const difficulty = getDifficulty();
        const submissionId = window.location.pathname; 
        if (lastSolvedProblem !== submissionId) {
          lastSolvedProblem = submissionId;
          handleSuccess(problemTitle, difficulty);
        }
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true, characterData: true });

// Polling fallback (every 2 seconds) to catch what MutationObserver might miss
setInterval(() => {
  const isAcceptedPage = window.location.href.includes('submissions') || 
                         document.querySelector('[data-e2e-locator="submission-result"]') ||
                         document.querySelector('.success__3x5z'); // Legacy selector
                         
  if (findTextEverywhere('Accepted') && isAcceptedPage) {
    const submissionId = window.location.pathname; 
    
    if (lastSolvedProblem !== submissionId) {
      console.log('LeetCelebrate: Poller detected Accepted verdict!');
      const problemTitle = getProblemTitle();
      const difficulty = getDifficulty();
      lastSolvedProblem = submissionId;
      handleSuccess(problemTitle, difficulty);
    }
  }
}, 2000);

function getProblemTitle() {
  const titleEl = document.querySelector('span.text-title-large') || 
                  document.querySelector('a[href*="/problems/"]') || 
                  document.querySelector('[data-cy="question-title"]');
  return titleEl ? titleEl.innerText.replace(/^\d+\.\s*/, '') : 'Unknown Problem';
}

function getDifficulty() {
  const difficultyEl = document.querySelector('div[class*="text-difficulty-"]') || 
                        document.querySelector('.difficulty-label');
  if (!difficultyEl) return 'Medium';
  const text = difficultyEl.innerText;
  if (text.includes('Easy')) return 'Easy';
  if (text.includes('Hard')) return 'Hard';
  return 'Medium';
}

function handleSuccess(problemId, difficulty) {
  const submissionId = window.location.pathname;
  console.log(`LeetCelebrate: Handling success for ${problemId} (${difficulty}) ID: ${submissionId}`);
  
  chrome.runtime.sendMessage({
    type: 'PROBLEM_SOLVED',
    problemId,
    difficulty,
    submissionId
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('LeetCelebrate Error:', chrome.runtime.lastError);
      return;
    }
    
    if (response && response.alreadyCelebrated) {
      console.log('LeetCelebrate: Already celebrated this submission, skipping.');
      return;
    }

    if (response) {
      triggerCelebration(response.xpGained, response.newAchievements);
    }
  });
}

function triggerCelebration(xpGained, newAchievements) {
  if (window.playSuccessSound) {
    window.playSuccessSound();
  }

  const overlay = document.createElement('div');
  overlay.className = 'leet-celebrate-overlay';
  
  const canvas = document.createElement('canvas');
  canvas.className = 'leet-celebrate-canvas';
  overlay.appendChild(canvas);
  
  const text = document.createElement('div');
  text.className = 'celebration-text';
  text.innerText = 'ACCEPTED!';
  overlay.appendChild(text);

  const xpText = document.createElement('div');
  xpText.className = 'xp-gain';
  xpText.innerText = `+${xpGained} XP`;
  overlay.appendChild(xpText);

  document.body.appendChild(overlay);
  startConfetti(canvas);
  
  if (newAchievements && newAchievements.length > 0) {
    newAchievements.forEach((id, index) => {
      setTimeout(() => showAchievement(id), 1500 + (index * 1000));
    });
  }

  setTimeout(() => {
    overlay.style.transition = 'opacity 1s';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 1000);
  }, 4000);
}

function showAchievement(id) {
  const popup = document.createElement('div');
  popup.className = 'achievement-popup';
  const info = {
    'FIRST_STEP': { title: 'First Step', icon: '🌱' },
    'TEN_PROBLEMS': { title: 'Getting Started', icon: '🔥' },
    'CENTURION': { title: 'Centurion', icon: '💯' },
    'WEEK_STREAK': { title: 'Consistent', icon: '📅' },
    'MONTH_STREAK': { title: 'Unstoppable', icon: '🏆' }
  }[id] || { title: 'Achievement', icon: '⭐' };

  popup.innerHTML = `
    <div class="achievement-icon">${info.icon}</div>
    <div class="achievement-info">
      <h4>Achievement Unlocked</h4>
      <p>${info.title}</p>
    </div>
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
  const numberOfPieces = 200;
  const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f', '#ffd700'];

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pieces.length < numberOfPieces) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        rotation: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 5,
        speed: Math.random() * 3 + 2,
        rotSpeed: Math.random() * 10 - 5
      });
    }
    pieces.forEach((p, i) => {
      p.y += p.speed;
      p.rotation += p.rotSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
      if (p.y > canvas.height) pieces.splice(i, 1);
    });
    requestAnimationFrame(update);
  }
  update();
}
