import { getFileExtension, generateHeaderComment } from '../utils/mappings.js';
import { updateSolutionsAndGenerateReadme } from '../utils/readmeGenerator.js';

// Default repository name
const REPO_NAME = 'leetcode-solutions';

const LEET_CELEBRATE_STORAGE_KEY = 'leet_celebrate_data';

const DEFAULT_GAME_DATA = {
  xp: 0,
  level: 1,
  totalSolved: 0,
  streak: 0,
  lastSolveDate: null,
  lastCelebratedId: null,
  achievements: [],
  history: [] // { date, problemId, difficulty, xpGained }
};

// Initialize extension state on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['autoSync', 'repoName', 'syncHistory', LEET_CELEBRATE_STORAGE_KEY], (result) => {
    const updates = {};
    if (result.autoSync === undefined) updates.autoSync = true;
    if (result.repoName === undefined) updates.repoName = REPO_NAME;
    if (result.syncHistory === undefined) updates.syncHistory = [];
    if (result[LEET_CELEBRATE_STORAGE_KEY] === undefined) {
      updates[LEET_CELEBRATE_STORAGE_KEY] = { ...DEFAULT_GAME_DATA };
    }
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
  console.log('[LeetCode-Sync-Background] Service worker installed with LeetCelebrate data initialized.');
});

/* ─────────────────────────────────────────────────────────────────────────────
   1. Message Handler
   ──────────────────────────────────────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  if (type === 'SAVE_GITHUB_TOKEN') {
    handleSaveToken(payload, sendResponse);
    return true; // asynchronous response
  } 
  
  else if (type === 'SUBMISSION_ACCEPTED') {
    handleSubmissionAccepted(payload, sendResponse);
    return true; // asynchronous response
  } 
  
  else if (type === 'TRIGGER_MANUAL_SYNC') {
    handleManualSync(sendResponse);
    return true; // asynchronous response
  } 
  
  else if (type === 'DISCONNECT_GITHUB') {
    handleDisconnect(sendResponse);
    return true; // asynchronous response
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   2. Auth Handler
   ──────────────────────────────────────────────────────────────────────────── */
async function handleSaveToken(token, sendResponse) {
  try {
    console.log('[LeetCode-Sync-Background] Validating token with GitHub API...');
    const user = await fetchGitHubUser(token);
    
    await chrome.storage.local.set({
      githubToken: token,
      githubUser: {
        login: user.login,
        avatarUrl: user.avatar_url,
        htmlUrl: user.html_url
      }
    });

    console.log('[LeetCode-Sync-Background] GitHub account connected successfully:', user.login);
    
    // Automatically check or create the repository upon login
    await checkOrCreateRepo(token, user.login, REPO_NAME);
    
    sendResponse({ success: true, user });
  } catch (err) {
    console.error('[LeetCode-Sync-Background] Auth verification failed:', err.message);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleDisconnect(sendResponse) {
  try {
    await chrome.storage.local.remove(['githubToken', 'githubUser', 'pendingSubmission', 'lastSynced']);
    console.log('[LeetCode-Sync-Background] Disconnected GitHub account.');
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. Submission Sync Handler
   ──────────────────────────────────────────────────────────────────────────── */
async function handleSubmissionAccepted(submission, sendResponse) {
  try {
    // 1. Process gamification metrics first!
    const gameResult = await addSolve(submission.problemId, submission.difficulty, submission.submissionId);

    if (gameResult.alreadyCelebrated) {
      console.log('[LeetCode-Sync-Background] Submission already processed. Skipping sync & animation.');
      sendResponse({ success: true, alreadyCelebrated: true });
      return;
    }

    // Prepare response payload for content script
    const responsePayload = {
      success: true,
      alreadyCelebrated: false,
      xpGained: gameResult.xpGained,
      newAchievements: gameResult.newAchievements
    };

    // 2. Set file extension dynamically
    submission.extension = getFileExtension(submission.language);

    // 3. Process GitHub sync if connected
    chrome.storage.local.get(['githubToken', 'githubUser', 'autoSync', 'repoName'], async (state) => {
      const { githubToken, githubUser, autoSync, repoName } = state;

      if (!githubToken || !githubUser) {
        console.log('[LeetCode-Sync-Background] Solution gamified. GitHub not connected, skipping sync.');
        sendResponse(responsePayload); // Send game response anyway!
        return;
      }

      if (autoSync) {
        console.log('[LeetCode-Sync-Background] Auto sync enabled. Committing solution...');
        try {
          await runSyncFlow(githubToken, githubUser.login, repoName, submission);
          sendResponse({ ...responsePayload, synced: true });
        } catch (err) {
          console.error('[LeetCode-Sync-Background] Auto sync failed:', err.message);
          showNotification(
            'Sync Failed',
            `Failed to sync "${submission.problemTitle}": ${err.message}`
          );
          sendResponse({ ...responsePayload, synced: false, syncError: err.message });
        }
      } else {
        console.log('[LeetCode-Sync-Background] Auto sync disabled. Queueing submission for manual sync...');
        await chrome.storage.local.set({ pendingSubmission: submission });
        
        showNotification(
          'Solution Ready to Sync',
          `Click the extension popup to push "${submission.problemTitle}" to GitHub.`
        );
        
        sendResponse({ ...responsePayload, queued: true });
      }
    });
  } catch (err) {
    console.error('[LeetCode-Sync-Background] Error handling accepted submission:', err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleManualSync(sendResponse) {
  chrome.storage.local.get(['githubToken', 'githubUser', 'repoName', 'pendingSubmission'], async (state) => {
    const { githubToken, githubUser, repoName, pendingSubmission } = state;

    if (!githubToken || !githubUser) {
      sendResponse({ success: false, error: 'GitHub is not connected' });
      return;
    }

    if (!pendingSubmission) {
      sendResponse({ success: false, error: 'No pending submission to sync' });
      return;
    }

    try {
      console.log('[LeetCode-Sync-Background] Starting manual sync...');
      const result = await runSyncFlow(githubToken, githubUser.login, repoName, pendingSubmission);
      
      // Clear pending submission
      await chrome.storage.local.remove('pendingSubmission');
      
      sendResponse({ success: true, ...result });
    } catch (err) {
      console.error('[LeetCode-Sync-Background] Manual sync failed:', err.message);
      showNotification(
        'Sync Failed',
        `Failed to sync "${pendingSubmission.problemTitle}": ${err.message}`
      );
      sendResponse({ success: false, error: err.message });
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. Sync Flow Implementation (GitHub API calls)
   ──────────────────────────────────────────────────────────────────────────── */
async function runSyncFlow(token, owner, repoName, submission) {
  // Ensure repo exists
  await checkOrCreateRepo(token, owner, repoName);

  // 1. Create file content with header comments
  const header = generateHeaderComment({
    problemTitle: submission.problemTitle,
    problemId: submission.problemId,
    difficulty: submission.difficulty,
    language: submission.language,
    runtime: submission.runtime,
    memory: submission.memory,
    date: new Date().toISOString().split('T')[0]
  });

  const fullContent = header + submission.code;
  const contentBase64 = btoa(unescape(encodeURIComponent(fullContent)));

  // Format problem number: zero-pad to 4 digits
  const paddedId = String(submission.problemId).padStart(4, '0');
  const sanitizedTitle = submission.problemTitle
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9__-]/g, '');
  
  const filename = `${paddedId}_${sanitizedTitle}.${submission.extension}`;
  const solutionPath = `${submission.difficulty}/${filename}`;

  console.log(`[LeetCode-Sync-Background] Committing file: ${solutionPath}`);

  // Get existing file details (for SHA) if it exists
  const existingFile = await getFileDetails(token, owner, repoName, solutionPath);
  const fileSha = existingFile ? existingFile.sha : null;

  // Commit solution file
  const commitMsg = `Sync LeetCode solution: ${submission.problemTitle} (${submission.language})`;
  await commitToGitHub(token, owner, repoName, solutionPath, contentBase64, commitMsg, fileSha);

  // 2. Fetch and update solutions.json & README.md
  console.log('[LeetCode-Sync-Background] Updating solutions list and README...');
  
  // Read current solutions.json
  const existingSolutionsFile = await getFileDetails(token, owner, repoName, 'solutions.json');
  let solutionsList = [];
  let solutionsSha = null;

  if (existingSolutionsFile) {
    try {
      solutionsSha = existingSolutionsFile.sha;
      const decodedSolutions = decodeBase64(existingSolutionsFile.content);
      solutionsList = JSON.parse(decodedSolutions);
    } catch (e) {
      console.warn('[LeetCode-Sync-Background] Error parsing existing solutions.json, starting fresh:', e);
      solutionsList = [];
    }
  }

  // Update lists and rebuild readme content
  const { updatedSolutions, readmeContent } = updateSolutionsAndGenerateReadme(solutionsList, submission);

  // Commit solutions.json
  const solutionsBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(updatedSolutions, null, 2))));
  await commitToGitHub(
    token, 
    owner, 
    repoName, 
    'solutions.json', 
    solutionsBase64, 
    `Update solutions.json index [skip ci]`, 
    solutionsSha
  );

  // Commit README.md
  const readmeFile = await getFileDetails(token, owner, repoName, 'README.md');
  const readmeSha = readmeFile ? readmeFile.sha : null;
  const readmeBase64 = btoa(unescape(encodeURIComponent(readmeContent)));

  await commitToGitHub(
    token,
    owner,
    repoName,
    'README.md',
    readmeBase64,
    `Update README.md statistics [skip ci]`,
    readmeSha
  );

  // 3. Save sync history
  const syncInfo = {
    problemId: submission.problemId,
    problemTitle: submission.problemTitle,
    difficulty: submission.difficulty,
    language: submission.language,
    timestamp: Date.now(),
    path: `${owner}/${repoName}/blob/main/${solutionPath}`
  };

  await saveSyncToHistory(syncInfo);

  // Trigger Notification
  showNotification(
    'Sync Successful',
    `"${submission.problemTitle}" has been committed to ${repoName}!`
  );

  return { success: true, path: solutionPath };
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. Helper GitHub API client wrappers
   ──────────────────────────────────────────────────────────────────────────── */
async function fetchGitHubUser(token) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  if (!res.ok) throw new Error(`GitHub user fetch returned status ${res.status}`);
  return res.json();
}

async function checkOrCreateRepo(token, owner, repoName) {
  const url = `https://api.github.com/repos/${owner}/${repoName}`;
  const checkRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (checkRes.status === 200) {
    console.log(`[LeetCode-Sync-Background] Repository "${repoName}" already exists.`);
    return;
  }

  if (checkRes.status === 404) {
    console.log(`[LeetCode-Sync-Background] Repository "${repoName}" not found. Creating it...`);
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        name: repoName,
        description: 'Auto-synced LeetCode solutions repository. Created by LeetCelebrate.',

        private: false,
        has_issues: false,
        has_projects: false,
        has_wiki: false
      })
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create repository: ${createRes.statusText}`);
    }

    console.log(`[LeetCode-Sync-Background] Repository "${repoName}" successfully created.`);
    
    // Give GitHub some time to initialize the repository metadata
    await new Promise(resolve => setTimeout(resolve, 1000));
  } else {
    throw new Error(`Repo check failed with status ${checkRes.status}`);
  }
}

async function getFileDetails(token, owner, repoName, path) {
  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (res.status === 200) {
    return res.json(); // contains content (base64) and sha
  }
  if (res.status === 404) {
    return null;
  }
  throw new Error(`Failed to fetch file details for ${path}. Status: ${res.status}`);
}

async function commitToGitHub(token, owner, repoName, path, contentBase64, message, sha) {
  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;
  const body = {
    message,
    content: contentBase64
  };
  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(`GitHub commit failed for ${path}: ${errorDetails.message || res.statusText}`);
  }

  return res.json();
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. Auxiliary Helpers
   ──────────────────────────────────────────────────────────────────────────── */
async function saveSyncToHistory(syncInfo) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['syncHistory'], async (result) => {
      const history = result.syncHistory || [];
      // Prepends newest item, caps at 10 items
      const updatedHistory = [syncInfo, ...history].slice(0, 10);
      
      await chrome.storage.local.set({
        lastSynced: syncInfo,
        syncHistory: updatedHistory
      });
      resolve();
    });
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}

// Cross-browser base64 decoder for UTF-8 files
function decodeBase64(str) {
  // Decode base64 strings containing unicode characters correctly
  return decodeURIComponent(
    atob(str.replace(/\s/g, ''))
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. Gamification Calculations (LeetCelebrate Logic)
   ──────────────────────────────────────────────────────────────────────────── */
function calculateLevel(xp) {
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

function checkAchievements(data) {
  const achievements = [];
  if (data.totalSolved >= 1) achievements.push('FIRST_STEP');
  if (data.totalSolved >= 10) achievements.push('TEN_PROBLEMS');
  if (data.totalSolved >= 100) achievements.push('CENTURION');
  if (data.streak >= 7) achievements.push('WEEK_STREAK');
  if (data.streak >= 30) achievements.push('MONTH_STREAK');
  return achievements;
}

async function addSolve(problemId, difficulty, submissionId) {
  return new Promise((resolve) => {
    chrome.storage.local.get([LEET_CELEBRATE_STORAGE_KEY], async (result) => {
      const data = result[LEET_CELEBRATE_STORAGE_KEY] || { ...DEFAULT_GAME_DATA };

      // If we already celebrated this specific submission ID, stop.
      if (data.lastCelebratedId === submissionId) {
        resolve({ alreadyCelebrated: true });
        return;
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

      await chrome.storage.local.set({ [LEET_CELEBRATE_STORAGE_KEY]: data });
      resolve({ alreadyCelebrated: false, xpGained, newAchievements, data });
    });
  });
}
