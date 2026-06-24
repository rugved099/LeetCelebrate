import React, { useState, useEffect } from 'react';

const ACHIEVEMENT_INFO = {
  'FIRST_STEP': { title: 'First Step', desc: 'Solved your first problem', icon: '🌱' },
  'TEN_PROBLEMS': { title: 'Getting Started', desc: 'Solved 10 problems', icon: '🔥' },
  'CENTURION': { title: 'Centurion', desc: 'Solved 100 problems', icon: '💯' },
  'WEEK_STREAK': { title: 'Consistent', desc: '7 days solve streak', icon: '📅' },
  'MONTH_STREAK': { title: 'Unstoppable', desc: '30 days solve streak', icon: '🏆' }
};

export default function Popup() {
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' or 'sync'
  
  // Game state
  const [gameData, setGameData] = useState({
    xp: 0,
    level: 1,
    totalSolved: 0,
    streak: 0,
    achievements: []
  });
  
  // GitHub state
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState(null);
  const [autoSync, setAutoSync] = useState(true);
  const [repoName, setRepoName] = useState('leetcode-solutions');
  const [lastSynced, setLastSynced] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    // Load initial states
    chrome.storage.local.get([
      'githubToken',
      'githubUser',
      'autoSync',
      'repoName',
      'lastSynced',
      'syncHistory',
      'pendingSubmission',
      'leet_celebrate_data'
    ], (result) => {
      if (result.githubToken) {
        setConnected(true);
        setUser(result.githubUser);
      }
      if (result.autoSync !== undefined) setAutoSync(result.autoSync);
      if (result.repoName) setRepoName(result.repoName);
      if (result.lastSynced) setLastSynced(result.lastSynced);
      if (result.syncHistory) setSyncHistory(result.syncHistory);
      if (result.pendingSubmission) setPendingSubmission(result.pendingSubmission);
      
      if (result.leet_celebrate_data) {
        setGameData(result.leet_celebrate_data);
      }
    });

    // Listen for changes
    const handleStorageChange = (changes, areaName) => {
      if (areaName !== 'local') return;

      if (changes.githubToken) {
        if (changes.githubToken.newValue) {
          setConnected(true);
        } else {
          setConnected(false);
          setUser(null);
        }
      }
      if (changes.githubUser) {
        setUser(changes.githubUser.newValue);
      }
      if (changes.autoSync !== undefined) {
        setAutoSync(changes.autoSync.newValue);
      }
      if (changes.repoName) {
        setRepoName(changes.repoName.newValue);
      }
      if (changes.lastSynced) {
        setLastSynced(changes.lastSynced.newValue);
      }
      if (changes.syncHistory) {
        setSyncHistory(changes.syncHistory.newValue || []);
      }
      if (changes.pendingSubmission) {
        setPendingSubmission(changes.pendingSubmission.newValue);
      }
      if (changes.leet_celebrate_data) {
        setGameData(changes.leet_celebrate_data.newValue || {
          xp: 0,
          level: 1,
          totalSolved: 0,
          streak: 0,
          achievements: []
        });
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const handleConnect = () => {
    setStatusMsg({ text: 'Opening GitHub login...', type: 'info' });
    chrome.tabs.create({ url: 'http://localhost:5000/auth/github' });
  };

  const handleDisconnect = () => {
    chrome.runtime.sendMessage({ type: 'DISCONNECT_GITHUB' }, (res) => {
      if (res && res.success) {
        setConnected(false);
        setUser(null);
        setPendingSubmission(null);
        setLastSynced(null);
        setSyncHistory([]);
        showStatus('Disconnected successfully!', 'success');
      } else {
        showStatus(res?.error || 'Failed to disconnect', 'error');
      }
    });
  };

  const handleToggleAutoSync = () => {
    const newValue = !autoSync;
    setAutoSync(newValue);
    chrome.storage.local.set({ autoSync: newValue });
    showStatus(`Auto Sync ${newValue ? 'Enabled' : 'Disabled'}`, 'success');
  };

  const handleManualSync = () => {
    if (syncing) return;
    setSyncing(true);
    setStatusMsg({ text: 'Syncing to GitHub...', type: 'info' });

    chrome.runtime.sendMessage({ type: 'TRIGGER_MANUAL_SYNC' }, (res) => {
      setSyncing(false);
      if (res && res.success) {
        showStatus('Solution synced successfully!', 'success');
        setPendingSubmission(null);
      } else {
        showStatus(res?.error || 'Sync failed', 'error');
      }
    });
  };

  const showStatus = (text, type) => {
    setStatusMsg({ text, type });
    setTimeout(() => {
      setStatusMsg({ text: '', type: '' });
    }, 4000);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Calculate XP boundaries for progress bar
  const calculateXpProgress = () => {
    const lvl = gameData.level;
    const currentLvlMinXp = (lvl - 1) * (lvl - 1) * 100;
    const nextLvlMinXp = lvl * lvl * 100;
    
    const xpInLevel = gameData.xp - currentLvlMinXp;
    const xpNeededForLevel = nextLvlMinXp - currentLvlMinXp;
    const percent = Math.min(100, Math.max(0, (xpInLevel / xpNeededForLevel) * 100));

    return {
      xpInLevel,
      xpNeededForLevel,
      percent,
      nextLvlXp: nextLvlMinXp
    };
  };

  const xpProgress = calculateXpProgress();

  return (
    <div className="popup-container">
      {/* HEADER */}
      <header className="header">
        <div className="logo-container">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          <span className="logo-text">LeetCelebrate</span>
        </div>
        
        {/* TABS SELECTOR */}
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            🏆 Progress
          </button>
          <button 
            className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            🔄 GitHub
          </button>
        </div>
      </header>

      {/* BANNER NOTIFICATION */}
      {statusMsg.text && (
        <div className={`status-banner banner-${statusMsg.type}`}>
          {statusMsg.text}
        </div>
      )}

      {/* CONTENT */}
      <main className="content">
        
        {/* ==================== TAB 1: GAMIFICATION PROGRESS ==================== */}
        {activeTab === 'progress' && (
          <div className="tab-content progress-tab">
            
            {/* LEVEL CARD */}
            <div className="level-card">
              <div className="level-badge">LVL {gameData.level}</div>
              <div className="xp-details">
                <span className="xp-label">Total XP: <strong>{gameData.xp}</strong></span>
                <span className="xp-remaining">{xpProgress.xpNeededForLevel - xpProgress.xpInLevel} XP to Level {gameData.level + 1}</span>
              </div>
              <div className="xp-progress-bar-container">
                <div 
                  className="xp-progress-bar-fill"
                  style={{ width: `${xpProgress.percent}%` }}
                ></div>
              </div>
              <div className="xp-limits">
                <span>{(gameData.level - 1) ** 2 * 100} XP</span>
                <span>{xpProgress.percent.toFixed(0)}%</span>
                <span>{xpProgress.nextLvlXp} XP</span>
              </div>
            </div>

            {/* QUICK STATS ROW */}
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-icon">🔥</span>
                <div className="stat-info">
                  <span className="stat-value">{gameData.streak}</span>
                  <span className="stat-label">Day Streak</span>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">🎯</span>
                <div className="stat-info">
                  <span className="stat-value">{gameData.totalSolved}</span>
                  <span className="stat-label">Solved</span>
                </div>
              </div>
            </div>

            {/* ACHIEVEMENTS GRID */}
            <div className="achievements-section">
              <h4 className="section-title">Achievements</h4>
              <div className="achievements-grid">
                {Object.entries(ACHIEVEMENT_INFO).map(([key, info]) => {
                  const isUnlocked = gameData.achievements.includes(key);
                  return (
                    <div 
                      key={key} 
                      className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                      title={info.desc}
                    >
                      <div className="ach-icon-wrapper">
                        {info.icon}
                        {!isUnlocked && <span className="lock-overlay">🔒</span>}
                      </div>
                      <div className="ach-title">{info.title}</div>
                      <div className="ach-desc">{info.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: GITHUB SYNC ==================== */}
        {activeTab === 'sync' && (
          <div className="tab-content sync-tab">
            {!connected ? (
              /* LOGIN */
              <div className="auth-screen">
                <div className="welcome-graphic">
                  <span className="welcome-emoji">⚙️</span>
                </div>
                <h2>LeetCode Sync Setup</h2>
                <p>Connect your GitHub account to sync your solution code directly into your repository after acceptance.</p>
                <button className="btn-connect" onClick={handleConnect}>
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                  Connect GitHub Account
                </button>
                <div className="auth-disclaimer">
                  Creates public <code>leetcode-solutions</code> repository automatically.
                </div>
              </div>
            ) : (
              /* CONNECTED PANEL */
              <div className="dashboard">
                
                {/* USER INFO */}
                <div className="user-card">
                  <img className="user-avatar" src={user?.avatarUrl || 'https://github.com/identicons/ghost.png'} alt="avatar" />
                  <div className="user-info">
                    <div className="user-meta">
                      <h3>{user?.login || 'Connected User'}</h3>
                      <button className="btn-disconnect" onClick={handleDisconnect} title="Disconnect account">
                        Disconnect
                      </button>
                    </div>
                    <a href={`https://github.com/${user?.login}/${repoName}`} target="_blank" rel="noreferrer" className="repo-link">
                      Repository: {repoName}
                      <svg className="external-link-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </a>
                  </div>
                </div>

                {/* TOGGLE */}
                <div className="control-panel">
                  <div className="toggle-container" onClick={handleToggleAutoSync}>
                    <div className="toggle-label-group">
                      <span className="toggle-title">Auto Sync Solutions</span>
                      <span className="toggle-desc">Pushes solutions instantly on Accepted status</span>
                    </div>
                    <div className={`toggle-switch ${autoSync ? 'active' : ''}`}>
                      <span className="toggle-handle"></span>
                    </div>
                  </div>
                </div>

                {/* PENDING MANUAL CARD */}
                {pendingSubmission && (
                  <div className="manual-sync-card">
                    <div className="alert-badge">Pending Sync</div>
                    <h4>{pendingSubmission.problemTitle}</h4>
                    <div className="meta-row">
                      <span className="meta-tag language-tag">{pendingSubmission.language}</span>
                      <span className={`meta-tag diff-tag ${pendingSubmission.difficulty.toLowerCase()}`}>
                        {pendingSubmission.difficulty}
                      </span>
                    </div>
                    <button className="btn-sync-now" onClick={handleManualSync} disabled={syncing}>
                      {syncing ? 'Syncing...' : 'Sync to GitHub Now'}
                    </button>
                  </div>
                )}

                {/* LAST SYNCED */}
                {lastSynced && (
                  <div className="last-synced-card">
                    <h4 className="section-title">Last Synced</h4>
                    <div className="synced-item">
                      <div className="synced-item-main">
                        <span className="item-title">{lastSynced.problemTitle}</span>
                        <span className={`item-diff ${lastSynced.difficulty.toLowerCase()}`}>{lastSynced.difficulty}</span>
                      </div>
                      <div className="synced-item-meta">
                        <span className="item-lang">{lastSynced.language}</span>
                        <span className="item-time">{formatTime(lastSynced.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* HISTORY */}
                {syncHistory.length > 0 && (
                  <div className="history-section">
                    <h4 className="section-title">Recent Activity</h4>
                    <div className="history-list">
                      {syncHistory.map((item, idx) => (
                        <a key={idx} href={item.path} target="_blank" rel="noreferrer" className="history-item">
                          <div className="history-item-left">
                            <span className="history-id">#{item.problemId}</span>
                            <span className="history-title">{item.problemTitle}</span>
                          </div>
                          <div className="history-item-right">
                            <span className="history-lang">{item.language}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      
      <footer className="footer">
        <span>Version 2.0.0 • LeetCelebrate</span>
      </footer>
    </div>
  );
}
