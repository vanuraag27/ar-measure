class SoundAndSpeechManager {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Voice Guidance (English or Hindi)
  private translateToHindi(text: string): string {
    const map: Record<string, string> = {
      'Measurement reset.': 'माप रीसेट हो गया।',
      'Wall set. Now aim at points on the wall.': 'दीवार तय हो गई। अब दीवार पर बिंदुओं पर निशाना लगाइए।',
      'Start locked.': 'शुरुआती बिंदु लॉक हो गया।',
      'Base locked. Aim at the top.': 'आधार लॉक हो गया। अब ऊपरी सिरे पर निशाना लगाइए।',
      'Now aim at the top edge of the object.': 'अब वस्तु के ऊपरी किनारे पर निशाना लगाइए।',
      'Saved.': 'सेव हो गया।',
    };
    if (map[text]) return map[text];
    const m = /^Point (\d+) added\.$/.exec(text);
    if (m) return `बिंदु ${m[1]} जोड़ा गया।`;
    return text;
  }

  speak(text: string, enabled: boolean = true, language: 'en' | 'hi' = 'en') {
    if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const hindi = language === 'hi';
      const utterance = new SpeechSynthesisUtterance(hindi ? this.translateToHindi(text) : text);
      utterance.lang = hindi ? 'hi-IN' : 'en-US';
      const voices = synth.getVoices();
      const prefix = hindi ? 'hi' : 'en';
      const voice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
      if (voice) utterance.voice = voice;
      utterance.rate = hindi ? 0.95 : 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      synth.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis unavailable or blocked', e);
    }
  }

  // Haptic feedback
  vibrate(pattern: number | number[] = 25, enabled: boolean = true) {
    if (!enabled || typeof window === 'undefined' || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors if blocked
    }
  }

  // Audio tone beeps
  playTone(frequency: number = 880, durationMs: number = 100, type: OscillatorType = 'sine') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  // Point locked chime
  pointLocked(enableSound: boolean = true, enableHaptics: boolean = true) {
    if (enableHaptics) this.vibrate(40);
    if (enableSound) this.playTone(880, 120);
  }

  // Measurement complete chime
  measurementComplete(enableSound: boolean = true, enableHaptics: boolean = true) {
    if (enableHaptics) this.vibrate([30, 40, 60]);
    if (enableSound) {
      this.playTone(659.25, 80);
      setTimeout(() => this.playTone(880, 160), 80);
    }
  }

  // Tracking lost alert
  trackingLost(enableSound: boolean = true, enableHaptics: boolean = true) {
    if (enableHaptics) this.vibrate([100, 50, 100]);
    if (enableSound) this.playTone(300, 200, 'sawtooth');
  }
}

export const feedback = new SoundAndSpeechManager();
