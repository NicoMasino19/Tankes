import { type AbilityVfxCue, type BulletNetState, type MatchState, type PlayerNetState, type PowerUpNetState, type ShapeNetState, type ZoneNetState, type WorldDeltaSnapshot } from "@tankes/shared";
export interface WorldState {
    tick: number;
    serverTime: number;
    abilityVfxCues: AbilityVfxCue[];
    session: MatchState | null;
    players: Map<string, PlayerNetState>;
    bullets: Map<string, BulletNetState>;
    shapes: Map<string, ShapeNetState>;
    zones: Map<string, ZoneNetState>;
    powerUps: Map<string, PowerUpNetState>;
}
export declare class ClientWorld {
    private readonly players;
    private readonly bullets;
    private readonly shapes;
    private readonly zones;
    private readonly powerUps;
    private lastAbilityVfxCues;
    private session;
    private tick;
    private serverTime;
    private cachedSnapshot;
    applyDelta(delta: WorldDeltaSnapshot): WorldState;
    getSnapshot(): WorldState;
}
