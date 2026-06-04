/**
 * LeetCelebrate Storage Utility
 */

const LEET_CELEBRATE_STORAGE_KEY = 'leet_celebrate_data';

const DEFAULT_DATA = {
  xp: 0,
  level: 1,
  totalSolved: 0,
  streak: 0,
  lastSolveDate: null,
  lastCelebratedId: null,
  achievements: [],
  history: [] // { date, problemId, difficulty, xpGained }
};

async function getGameData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([LEET_CELEBRATE_STORAGE_KEY], (result) => {
      resolve(result[LEET_CELEBRATE_STORAGE_KEY] || { ...DEFAULT_DATA });
    });
  });
}

async function saveGameData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [LEET_CELEBRATE_STORAGE_KEY]: data }, () => {
      resolve();
    });
  });
}

function calculateLevel(xp) {
  // Simple level formula: Level = floor(sqrt(xp / 100)) + 1
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function getXPForDifficulty(difficulty) {
  switch (difficulty?.toLowerCase()) {
    case 'easy': return 50;
    case 'medium': return 100;
    case 'hard': return 250;
    default: return 50;
  }
}

async function addSolve(problemId, difficulty, submissionId) {
  const data = await getGameData();
  
  // If we already celebrated this specific submission ID, stop.
  if (data.lastCelebratedId === submissionId) {
    return { alreadyCelebrated: true };
  }
  
  const xpGained = getXPForDifficulty(difficulty);
  const today = new Date().toDateString();
  
  data.xp += xpGained;
  data.level = calculateLevel(data.xp);
  data.totalSolved += 1;
  data.lastCelebratedId = submissionId;
  
  // Streak logic
  if (data.lastSolveDate) {
    const lastDate = new Date(data.lastSolveDate);
    const diffDays = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      data.streak += 1;
    } else if (diffDays > 1) {
      data.streak = 1;
    }
  } else {
    data.streak = 1;
  }
  
  data.lastSolveDate = new Date().toISOString();
  
  // History
  data.history.push({
    date: new Date().toISOString(),
    problemId,
    difficulty,
    xpGained
  });

  // Check for achievements
  const newAchievements = checkAchievements(data);
  data.achievements = [...new Set([...data.achievements, ...newAchievements])];
  
  await saveGameData(data);
  return { data, xpGained, newAchievements };
}

function checkAchievements(data) {
  const achievements = [];
  if (data.totalSolved >= 1) achievements.push('FIRST_STEP');
  if (data.totalSolved >= 10) achievements.push('TEN_PROBLEMS');
  if (data.totalSolved >= 100) achievements.push('CENTURION');
  if (data.streak >= 7) achievements.push('WEEK_STREAK');
  if (data.streak >= 30) achievements.push('MONTH_STREAK');
  
  return achievements;
}

const ACHIEVEMENT_INFO = {
  'FIRST_STEP': { title: 'First Step', desc: 'Solved your first problem!', icon: '🌱' },
  'TEN_PROBLEMS': { title: 'Getting Started', desc: 'Solved 10 problems!', icon: '🔥' },
  'CENTURION': { title: 'Centurion', desc: 'Solved 100 problems!', icon: '💯' },
  'WEEK_STREAK': { title: 'Consistent', desc: '7 days streak!', icon: '📅' },
  'MONTH_STREAK': { title: 'Unstoppable', desc: '30 days streak!', icon: '🏆' }
};
