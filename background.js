/**
 * LeetCelebrate Background Service Worker
 */

importScripts('storage.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('LeetCelebrate Extension Installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROBLEM_SOLVED') {
    addSolve(request.problemId, request.difficulty, request.submissionId).then((result) => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.type === 'GET_DATA') {
    getGameData().then((data) => {
      sendResponse(data);
    });
    return true;
  }
});
