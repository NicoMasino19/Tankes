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
    playHit(selfHit: boolean, volumeScale?: number): void;
    playDeath(selfDeath: boolean, volumeScale?: number): void;
    playRespawn(selfRespawn: boolean, volumeScale?: number): void;
    playRoundEnded(): void;
    playRoundReset(): void;
    playZoneCapturing(selfCapturing: boolean, captureProgress?: number, volumeScale?: number): void;
    playZoneContested(): void;
    playZoneCaptured(selfCaptured: boolean, volumeScale?: number): void;
    private ensureContext;
    private shouldRateLimit;
    private playTone;
}
