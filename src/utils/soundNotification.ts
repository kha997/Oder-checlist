/**
 * Web Audio API Chime Synthesizer
 * Generates pleasant, non-intrusive sound alerts without any external audio asset dependencies.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('AudioContext not available:', e);
    return null;
  }
}

export type SoundType =
  | 'NEW_ORDER'
  | 'READY_FOR_DELIVERY'
  | 'CAMERA_SHUTTER'
  | 'SCAN_SUCCESS'
  | 'OUT_FOR_DELIVERY_DUE'
  | 'RECURRING_ORDER_GENERATED'
  | 'SYSTEM';

/**
 * Play a notification chime
 * - NEW_ORDER: High-low pleasant dual chime (Bell sound)
 * - READY_FOR_DELIVERY: Triumphant ascending 3-tone chime (Rocket/Ready sound)
 * - CAMERA_SHUTTER: Quick tactile camera snap click
 * - SCAN_SUCCESS: Crisp high beep confirming scan match
 * - OUT_FOR_DELIVERY_DUE: Urgent attention chime warning delivery time is due
 * - RECURRING_ORDER_GENERATED: Upbeat recurring cycle harmonic chime
 */
export function playNotificationSound(type: SoundType): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'NEW_ORDER') {
      // Pleasant dual chime: 587.33 Hz (D5) -> 880 Hz (A5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12); // A5

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);

      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
    } else if (type === 'OUT_FOR_DELIVERY_DUE') {
      // Urgent due alarm: rhythmic double pulse alert
      const tones = [740, 880, 740, 880];
      tones.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.12;
        const endTime = startTime + 0.18;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, endTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(endTime);
      });
    } else if (type === 'RECURRING_ORDER_GENERATED') {
      // Upbeat 4-tone harmonic cycle chime: C5 -> E5 -> G5 -> C6
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.08;
        const endTime = startTime + 0.35;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, endTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(endTime);
      });
    } else if (type === 'READY_FOR_DELIVERY') {
      // READY_FOR_DELIVERY: Upward cheerful triple chime 523.25 (C5) -> 659.25 (E5) -> 783.99 (G5)
      const notes = [523.25, 659.25, 783.99];
      const duration = 0.15;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const startTime = now + idx * 0.1;
        const endTime = startTime + duration + 0.2;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.22, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, endTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(endTime);
      });
    } else if (type === 'CAMERA_SHUTTER') {
      // Tactile camera shutter click
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.07);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.08);
    } else if (type === 'SCAN_SUCCESS') {
      // Crisp 2-tone success blip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'SYSTEM') {
      // Gentle soft chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (err) {
    console.warn('Failed to play notification audio:', err);
  }
}
