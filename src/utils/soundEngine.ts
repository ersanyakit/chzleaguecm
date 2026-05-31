type SoundKey = 'chat' | 'crowd' | 'goal' | 'highlight' | 'join' | 'kick' | 'leave';

const SOUND_URLS: Record<SoundKey, string> = {
  chat: new URL('../../assets/sounds/chat.wav', import.meta.url).href,
  crowd: new URL('../../assets/sounds/crowd.ogg', import.meta.url).href,
  goal: new URL('../../assets/sounds/goal.wav', import.meta.url).href,
  highlight: new URL('../../assets/sounds/highlight.wav', import.meta.url).href,
  join: new URL('../../assets/sounds/join.wav', import.meta.url).href,
  kick: new URL('../../assets/sounds/kick.wav', import.meta.url).href,
  leave: new URL('../../assets/sounds/leave.wav', import.meta.url).href
};

const VOLUMES: Record<SoundKey, number> = {
  chat: 0.35,
  crowd: 0.26,
  goal: 0.85,
  highlight: 0.58,
  join: 0.62,
  kick: 0.72,
  leave: 0.58
};

class SoundEngine {
  private isMuted = false;
  private pools = new Map<SoundKey, HTMLAudioElement[]>();
  private crowd: HTMLAudioElement | null = null;
  private crowdRequested = false;

  constructor() {
    if (typeof Audio === 'undefined') return;

    (Object.keys(SOUND_URLS) as SoundKey[]).forEach((key) => {
      if (key === 'crowd') {
        this.crowd = this.createAudio(key);
        this.crowd.loop = true;
        return;
      }

      this.pools.set(key, Array.from({ length: 4 }, () => this.createAudio(key)));
    });
  }

  private createAudio(key: SoundKey) {
    const audio = new Audio(SOUND_URLS[key]);
    audio.preload = 'auto';
    audio.volume = VOLUMES[key];
    return audio;
  }

  private play(key: Exclude<SoundKey, 'crowd'>) {
    if (this.isMuted) return;

    const pool = this.pools.get(key);
    if (!pool) return;

    const audio = pool.find((candidate) => candidate.paused || candidate.ended) ?? pool[0];
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = VOLUMES[key];
      void audio.play().catch(() => undefined);
    } catch {
      // Browser autoplay policies can reject sounds until the next user gesture.
    }
  }

  public resume() {
    if (this.crowdRequested) {
      this.playCrowd();
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopCrowd(false);
      this.pools.forEach((pool) => {
        pool.forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
        });
      });
    } else if (this.crowdRequested) {
      this.playCrowd();
    }
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public getMuteStatus(): boolean {
    return this.isMuted;
  }

  public playCrowd() {
    this.crowdRequested = true;
    if (this.isMuted || !this.crowd) return;

    try {
      this.crowd.volume = VOLUMES.crowd;
      void this.crowd.play().catch(() => undefined);
    } catch {
      // Safe no-op for browsers that block playback.
    }
  }

  public stopCrowd(clearRequest = true) {
    if (clearRequest) {
      this.crowdRequested = false;
    }
    if (!this.crowd) return;

    this.crowd.pause();
    this.crowd.currentTime = 0;
  }

  public playKick() {
    this.play('kick');
  }

  public playWhistle(isDouble: boolean = false) {
    this.play('highlight');
    if (isDouble) {
      window.setTimeout(() => this.play('highlight'), 220);
    }
  }

  public playGoalRoar() {
    this.play('goal');
  }

  public playSwoosh() {
    this.play('chat');
  }

  public playMetalPostClank() {
    this.play('leave');
  }

  public playMatchStart() {
    this.play('join');
  }

  public playMatchEnd() {
    this.play('leave');
  }

  public playCommentaryTick() {
    this.play('chat');
  }
}

export const soundEngine = new SoundEngine();
