export interface SfxSettings {
    muted: boolean;
    volume: number;
}
export declare class SfxManager {
    private readonly settings;
    private readonly recentByKey;
    private audioContext;
    constructor();
    getSettings(): SfxSettings;
    setMuted(muted: boolean): void;
    setVolume(volume: number): void;
    unlock(): void;
    playShot(selfShot: boolean, volumeScale?: number): void;
    playHit(selfHit: boolean): void;
    playDeath(selfDeath: boolean): void;
    playRespawn(selfRespawn: boolean): void;
    playRoundEnded(): void;
    playRoundReset(): void;
    playZoneCapturing(selfCapturing: boolean, captureProgress?: number): void;
    playZoneContested(): void;
    playZoneCaptured(selfCaptured: boolean): void;
    private ensureContext;
    private shouldRateLimit;
    private playTone;
}
