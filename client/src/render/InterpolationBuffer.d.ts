import { type AbilityVfxCue, type BulletNetState, type MatchState, type PlayerNetState, type PowerUpNetState, type ShapeNetState, type ZoneNetState } from "@tankes/shared";
import type { WorldState } from "../state/ClientWorld";
export interface InterpolatedWorld {
    tick: number;
    serverTime: number;
    abilityVfxCues: AbilityVfxCue[];
    session: MatchState | null;
    players: PlayerNetState[];
    bullets: BulletNetState[];
    shapes: ShapeNetState[];
    zones: ZoneNetState[];
    powerUps: PowerUpNetState[];
}
export declare class InterpolationBuffer {
    private readonly ring;
    private head;
    private count;
    private serverOffsetMs;
    push(state: WorldState): void;
    private at;
    getInterpolated(): InterpolatedWorld;
}
