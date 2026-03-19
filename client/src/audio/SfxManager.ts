export interface SfxSettings {
  muted: boolean;
  volume: number;
}

const STORAGE_KEY = "tankes:sfx-settings";
const MIN_AUDIBLE_VOLUME = 0.01;

const clampVolume = (value: number): number => Math.min(1, Math.max(0, value));

const loadSettings = (): SfxSettings => {
  const fallback: SfxSettings = { muted: false, volume: 0.7 };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SfxSettings>;
    return {
      muted: Boolean(parsed.muted),
      volume: clampVolume(typeof parsed.volume === "number" ? parsed.volume : fallback.volume)
    };
  } catch {
    return fallback;
  }
};

const saveSettings = (settings: SfxSettings): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export class SfxManager {
  private readonly settings: SfxSettings;
  private readonly recentByKey = new Map<string, number>();
  private audioContext: AudioContext | null = null;

  constructor() {
    this.settings = loadSettings();
  }

  getSettings(): SfxSettings {
    return { ...this.settings };
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    saveSettings(this.settings);
  }

  setVolume(volume: number): void {
    this.settings.volume = clampVolume(volume);
    saveSettings(this.settings);
  }

  unlock(): void {
    this.ensureContext();
    this.audioContext?.resume().catch(() => {
      return;
    });
  }

  playShot(selfShot: boolean, volumeScale = 1): void {
    const distanceScale = clampVolume(volumeScale);
    if (!selfShot && distanceScale <= MIN_AUDIBLE_VOLUME) {
      return;
    }
    this.playTone({
      key: selfShot ? "shot:self" : "shot:other",
      minIntervalMs: selfShot ? 30 : 70,
      frequency: selfShot ? 620 : 520,
      endFrequency: selfShot ? 430 : 360,
      duration: selfShot ? 0.055 : 0.04,
      gain: (selfShot ? 0.26 : 0.17) * distanceScale,
      wave: selfShot ? "triangle" : "sine"
    });
  }

  playHit(selfHit: boolean, volumeScale = 1): void {
    const distanceScale = clampVolume(volumeScale);
    if (!selfHit && distanceScale <= MIN_AUDIBLE_VOLUME) {
      return;
    }
    this.playTone({
      key: selfHit ? "hit:self" : "hit:other",
      minIntervalMs: 80,
      frequency: selfHit ? 240 : 320,
      endFrequency: selfHit ? 180 : 260,
      duration: 0.08,
      gain: (selfHit ? 0.2 : 0.1) * distanceScale,
      wave: "triangle"
    });
  }

  playDeath(selfDeath: boolean, volumeScale = 1): void {
    const distanceScale = clampVolume(volumeScale);
    if (!selfDeath && distanceScale <= MIN_AUDIBLE_VOLUME) {
      return;
    }
    this.playTone({
      key: selfDeath ? "death:self" : "death:other",
      minIntervalMs: 220,
      frequency: selfDeath ? 200 : 250,
      endFrequency: 90,
      duration: selfDeath ? 0.2 : 0.14,
      gain: (selfDeath ? 0.26 : 0.16) * distanceScale,
      wave: "sawtooth"
    });
  }

  playRespawn(selfRespawn: boolean, volumeScale = 1): void {
    const distanceScale = clampVolume(volumeScale);
    if (!selfRespawn && distanceScale <= MIN_AUDIBLE_VOLUME) {
      return;
    }
    this.playTone({
      key: selfRespawn ? "respawn:self" : "respawn:other",
      minIntervalMs: 220,
      frequency: selfRespawn ? 330 : 300,
      endFrequency: selfRespawn ? 520 : 430,
      duration: 0.16,
      gain: (selfRespawn ? 0.18 : 0.1) * distanceScale,
      wave: "sine"
    });
  }

  playRoundEnded(): void {
    this.playTone({
      key: "round:ended",
      minIntervalMs: 400,
      frequency: 220,
      endFrequency: 140,
      duration: 0.22,
      gain: 0.2,
      wave: "triangle"
    });
  }

  playRoundReset(): void {
    this.playTone({
      key: "round:reset",
      minIntervalMs: 400,
      frequency: 240,
      endFrequency: 420,
      duration: 0.18,
      gain: 0.2,
      wave: "triangle"
    });
  }

  playZoneCapturing(selfCapturing: boolean, captureProgress = 0, volumeScale = 1): void {
    const distanceScale = clampVolume(volumeScale);
    if (!selfCapturing && distanceScale <= MIN_AUDIBLE_VOLUME) {
      return;
    }
    const progress = Math.max(0, Math.min(1, captureProgress));
    const key = selfCapturing ? "zone:capturing:self" : "zone:capturing:other";
    const minIntervalMs = selfCapturing ? 180 : 260;
    if (this.settings.muted || this.settings.volume <= 0 || this.shouldRateLimit(key, minIntervalMs)) {
      return;
    }

    this.ensureContext();
    const context = this.audioContext;
    if (!context || context.state === "suspended") {
      return;
    }

    const now = context.currentTime;
    const baseGain = (selfCapturing ? 0.16 : 0.1) * this.settings.volume * distanceScale;
    const lowStart = selfCapturing ? 250 : 220;
    const lowEnd = selfCapturing ? 430 : 360;
    const highStart = selfCapturing ? 330 : 280;
    const highEnd = selfCapturing ? 650 : 520;
    const riseFactor = 1 + progress * 0.6;

    const pulseA = context.createOscillator();
    const gainA = context.createGain();
    pulseA.type = "triangle";
    pulseA.frequency.setValueAtTime(lowStart * riseFactor, now);
    pulseA.frequency.exponentialRampToValueAtTime(lowEnd * riseFactor, now + 0.09);
    gainA.gain.setValueAtTime(Math.max(0.0001, baseGain), now);
    gainA.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    pulseA.connect(gainA);
    gainA.connect(context.destination);
    pulseA.start(now);
    pulseA.stop(now + 0.09);

    const pulseB = context.createOscillator();
    const gainB = context.createGain();
    pulseB.type = "triangle";
    pulseB.frequency.setValueAtTime(highStart * riseFactor, now + 0.06);
    pulseB.frequency.exponentialRampToValueAtTime(highEnd * riseFactor, now + 0.16);
    gainB.gain.setValueAtTime(Math.max(0.0001, baseGain * 0.9), now + 0.06);
    gainB.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    pulseB.connect(gainB);
    gainB.connect(context.destination);
    pulseB.start(now + 0.06);
    pulseB.stop(now + 0.16);
  }

  playZoneContested(): void {
    this.playTone({
      key: "zone:contested",
      minIntervalMs: 320,
      frequency: 180,
      endFrequency: 230,
      duration: 0.11,
      gain: 0.14,
      wave: "square"
    });
  }

  playZoneCaptured(selfCaptured: boolean, volumeScale = 1): void {
    const distanceScale = clampVolume(volumeScale);
    if (!selfCaptured && distanceScale <= MIN_AUDIBLE_VOLUME) {
      return;
    }
    this.playTone({
      key: selfCaptured ? "zone:captured:self" : "zone:captured:other",
      minIntervalMs: 360,
      frequency: selfCaptured ? 300 : 240,
      endFrequency: selfCaptured ? 520 : 360,
      duration: 0.17,
      gain: (selfCaptured ? 0.24 : 0.16) * distanceScale,
      wave: "sine"
    });
  }

  private ensureContext(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
  }

  private shouldRateLimit(key: string, minIntervalMs: number): boolean {
    const now = performance.now();
    const last = this.recentByKey.get(key) ?? -Infinity;
    if (now - last < minIntervalMs) {
      return true;
    }
    this.recentByKey.set(key, now);
    return false;
  }

  private playTone(config: {
    key: string;
    minIntervalMs: number;
    frequency: number;
    endFrequency: number;
    duration: number;
    gain: number;
    wave: OscillatorType;
  }): void {
    if (this.settings.muted || this.settings.volume <= 0 || this.shouldRateLimit(config.key, config.minIntervalMs)) {
      return;
    }

    this.ensureContext();
    const context = this.audioContext;
    if (!context || context.state === "suspended") {
      return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = config.wave;
    oscillator.frequency.setValueAtTime(config.frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, config.endFrequency),
      context.currentTime + config.duration
    );

    const startGain = Math.max(0.0001, config.gain * this.settings.volume);
    gainNode.gain.setValueAtTime(startGain, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + config.duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + config.duration);
  }
}
