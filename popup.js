/**
 * LeetCelebrate Popup Script
 */

const ACHIEVEMENT_INFO = {
  'FIRST_STEP': { title: 'First Step', desc: 'Solved your first problem!', icon: '🌱' },
  'TEN_PROBLEMS': { title: 'Getting Started', desc: 'Solved 10 problems!', icon: '🔥' },
  'CENTURION': { title: 'Centurion', desc: 'Solved 100 problems!', icon: '💯' },
  'WEEK_STREAK': { title: 'Consistent', desc: '7 days streak!', icon: '📅' },
  'MONTH_STREAK': { title: 'Unstoppable', desc: '30 days streak!', icon: '🏆' }
};

document.addEventListener('DOMContentLoaded', () => {
  renderData();

  // Handle the demo trigger from the badge-click style logic
  const testBtn = document.getElementById('test-btn');
  if (testBtn) {
    testBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              window.postMessage({ type: 'celebrate_demo' }, '*');
            }
          });
        }
      });
    });
  }
});

function renderData() {
  chrome.runtime.sendMessage({ type: 'GET_DATA' }, (data) => {
    if (!data) return;

    // Stats
    document.getElementById('level-val').innerText = data.level || 1;
    document.getElementById('solved-val').innerText = data.totalSolved || 0;
    document.getElementById('streak-val').innerText = data.streak || 0;

    // XP calculation
    const currentLevel = data.level || 1;
    const currentXP = data.xp || 0;
    const baseXPForLevel = Math.pow(currentLevel - 1, 2) * 100;
    const nextLevelXP = Math.pow(currentLevel, 2) * 100;
    const xpInLevel = currentXP - baseXPForLevel;
    const totalXPRequired = nextLevelXP - baseXPForLevel;
    
    const progress = Math.min(100, (xpInLevel / totalXPRequired) * 100);
    
    document.getElementById('xp-fill').style.width = `${progress}%`;
    document.getElementById('xp-val').innerText = `${Math.floor(xpInLevel)} / ${totalXPRequired} XP`;

    // Achievements
    const list = document.getElementById('achievement-list');
    list.innerHTML = '';
    
    Object.keys(ACHIEVEMENT_INFO).forEach(id => {
      const isUnlocked = data.achievements && data.achievements.includes(id);
      const item = document.createElement('div');
      item.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
      item.title = `${ACHIEVEMENT_INFO[id].title}: ${ACHIEVEMENT_INFO[id].desc}`;
      item.innerText = ACHIEVEMENT_INFO[id].icon;
      list.appendChild(item);
    });
  });
}
