// Simple notification sound using Web Audio API - no external files needed
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Create a pleasant two-tone notification sound
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(ctx.destination);

    // First tone
    oscillator1.type = 'sine';
    oscillator1.frequency.setValueAtTime(587.33, now); // D5
    oscillator1.frequency.setValueAtTime(783.99, now + 0.15); // G5

    // Second tone (harmony)
    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(440, now); // A4
    oscillator2.frequency.setValueAtTime(587.33, now + 0.15); // D5

    // Volume envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gainNode.gain.setValueAtTime(0.3, now + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.35, now + 0.2);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.5);

    oscillator1.start(now);
    oscillator2.start(now);
    oscillator1.stop(now + 0.5);
    oscillator2.stop(now + 0.5);
  } catch (e) {
    console.warn('[Sound] Could not play notification sound:', e);
  }
}
