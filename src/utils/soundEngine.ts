// Procedural Audio Synthesizer using Web Audio API
// High-fidelity sound effects without any external assets, safe from CORS and loading issues!

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    // Lazy initialisation on first user gesture
  }

  private initContext() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.isInitialized = true;
      }
    } catch (e) {
      console.warn("Web Audio API not supported under this context", e);
    }
  }

  public resume() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn("Failed to resume audio context", e));
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.ctx && this.ctx.state === 'running') {
      // Opt-out of actively playing sounds
    }
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public getMuteStatus(): boolean {
    return this.isMuted;
  }

  // 1. Kick ball pop (Topa Vurma)
  public playKick() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      // Fast sweep down from 160Hz to 30Hz representing a solid leather touch impact
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

      gainNode.gain.setValueAtTime(0.44, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {
      // Safe guard
    }
  }

  // 2. High-pitch Referee Whistle (Hakem Düdüğü)
  public playWhistle(isDouble: boolean = false) {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const playSingle = (startTime: number, duration: number) => {
        if (!this.ctx) return;
        // Dual oscillators to simulate realistic vibrato beat frequency
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        
        // Modulator for the vibrating "pea" whistle effect
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        
        const gainNode = this.ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        lfo.type = 'sine';

        // High pitch referee whistle tones
        osc1.frequency.setValueAtTime(1450, startTime);
        osc2.frequency.setValueAtTime(1466, startTime);

        // Pea frequency
        lfo.frequency.setValueAtTime(32, startTime);
        lfoGain.gain.setValueAtTime(15, startTime);

        // Connect LFO to modulate oscillator pitch frequencies
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);

        // Quick attack envelope
        gainNode.gain.setValueAtTime(0.001, startTime);
        gainNode.gain.linearRampToValueAtTime(0.24, startTime + 0.04);
        gainNode.gain.setValueAtTime(0.24, startTime + duration - 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        lfo.start(startTime);
        osc1.start(startTime);
        osc2.start(startTime);

        lfo.stop(startTime + duration);
        osc1.stop(startTime + duration);
        osc2.stop(startTime + duration);
      };

      if (isDouble) {
        // High-energy start/stop double whistle
        playSingle(now, 0.14);
        playSingle(now + 0.22, 0.45);
      } else {
        // Normal direct whistle
        playSingle(now, 0.35);
      }
    } catch (e) {
      // Guard
    }
  }

  // 3. Goal Roar (Stadyum Gol Çığlığı)
  public playGoalRoar() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const duration = 3.0;

      // Create crowd noise using custom synthesised White Noise
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Seed high-quality noise filter
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;

      // High-order Resonant Bandpass filter to sculpt wind/roar into realistic deep crowd swell cheers
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.exponentialRampToValueAtTime(450, now + 0.4);
      filter.frequency.exponentialRampToValueAtTime(220, now + duration);
      filter.Q.setValueAtTime(1.8, now);

      // Attack decay release volume envelope representing goal roar
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.48, now + 0.15); // Instant explosion of joy
      gainNode.gain.exponentialRampToValueAtTime(0.18, now + 1.2); // Prolonged celebration decay
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Low frequency hum/cheer accentuating the massive stadium feel
      const lowOsc = this.ctx.createOscillator();
      const lowGain = this.ctx.createGain();
      lowOsc.type = 'triangle';
      lowOsc.frequency.setValueAtTime(80, now);
      lowOsc.frequency.linearRampToValueAtTime(95, now + 0.5);
      
      lowGain.gain.setValueAtTime(0.35, now);
      lowGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      noiseSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      lowOsc.connect(lowGain);
      lowGain.connect(this.ctx.destination);

      noiseSource.start(now);
      lowOsc.start(now);
      
      noiseSource.stop(now + duration);
      lowOsc.stop(now + duration);
    } catch (e) {
      // Guard
    }
  }

  // 4. Save and Miss swoosh
  public playSwoosh() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.22);

      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);
    } catch (e) {
      // Guard
    }
  }

  // 5. Metal post hit / goal missed clank (Hıssıyat)
  public playMetalPostClank() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      
      // Metallic timbre combine high and mid oscillators
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(512, now);

      gainNode.gain.setValueAtTime(0.26, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } catch (e) {
      // Guard
    }
  }
}

export const soundEngine = new SoundEngine();
