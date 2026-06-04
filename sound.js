/**
 * LeetCelebrate Sound Utility
 * Generates procedural success sounds using Web Audio API
 */

function playSuccessSound() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Create a simple "triumph" sequence
  playTone(audioCtx, 523.25, 0, 0.1); // C5
  playTone(audioCtx, 659.25, 0.1, 0.1); // E5
  playTone(audioCtx, 783.99, 0.2, 0.1); // G5
  playTone(audioCtx, 1046.50, 0.3, 0.4); // C6
}

function playTone(ctx, freq, start, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + start + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
}

// Make it available globally in content script
window.playSuccessSound = playSuccessSound;
