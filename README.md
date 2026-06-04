# 🏆 LeetCelebrate

**LeetCelebrate** is a premium Chrome Extension designed to turn the LeetCode grind into a rewarding, addictive, and gamified experience. Instead of just seeing a green "Accepted" text, celebrate your victories with high-fidelity animations, triumph sounds, and a comprehensive achievement system.

![LeetCelebrate Branding](icons/icon128.png)

## ✨ Features

- **🚀 Instant Celebration**: Detects the "Accepted" verdict in real-time and triggers a celebration sequence including Canvas-based confetti and procedural triumph sounds.
- **📈 Gamification Engine**: 
  - **XP & Leveling**: Earn XP based on problem difficulty (Easy: 50, Medium: 100, Hard: 250).
  - **Daily Streaks**: Track your consistency and maintain your "Velocity."
  - **Achievements**: Unlock unique milestones like "First Step," "Week Streak," and "Centurion."
- **🎨 Elite Aesthetics**: Features a sleek **Grey Glassmorphism** UI, utilizing the **Science Gothic** font for a futuristic, technical feel.
- **🔇 Intelligent Persistence**: Automatically prevents duplicate celebrations for the same submission ID, even on page reloads.

## 🛠 Tech Stack

- **Manifest V3**: Modern Chrome Extension architecture.
- **Vanilla JavaScript**: Lightweight and fast detection logic.
- **Canvas API**: High-performance, low-latency animations.
- **Web Audio API**: Real-time procedural sound generation (no external assets needed).
- **Chrome Storage API**: Secure persistence for your stats and progress.

## 🚀 Installation Instructions

To use LeetCelebrate in your Chrome browser while it's in development, follow these steps:

1.  **Clone or Download** this repository to your local machine.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** using the toggle in the top-right corner.
4.  Click the **Load unpacked** button.
5.  Select the folder containing this repository (`LeetCelebrate`).
6.  **Pin the extension** by clicking the puzzle icon 🧩 in your toolbar and clicking the pin 📌 next to LeetCelebrate.

## 🎮 How to Use

1.  Navigate to any problem on [LeetCode](https://leetcode.com/problems/).
2.  Write your code and click **Submit**.
3.  Upon receiving an **Accepted** verdict, the extension will automatically trigger the celebration sequence.
4.  Click the extension icon any time to check your current **Level**, **XP Progress**, **Streak**, and **Milestones**.

---

*Made with ❤️ for the LeetCode Community.*
