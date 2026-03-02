import type { WorldState } from "./ClientWorld";
export declare const GameplayEventType: {
    readonly Shot: "shot";
    readonly Damage: "damage";
    readonly Death: "death";
    readonly Respawn: "respawn";
    readonly Kill: "kill";
    readonly ZoneCapturing: "zone_capturing";
    readonly ZoneContested: "zone_contested";
    readonly ZoneCaptured: "zone_captured";
};
export type GameplayEventType = (typeof GameplayEventType)[keyof typeof GameplayEventType];
export interface GameplayEvent {
    type: GameplayEventType;
    playerId?: string;
    sourceId?: string;
    targetId?: string;
    zoneId?: string;
    amount?: number;
    x?: number;
    y?: number;
    rotation?: number;
}
export declare class GameplayEventDetector {
    private previousPlayers;
    private previousBullets;
    private previousZones;
    private initialized;
    consume(next: WorldState): GameplayEvent[];
}
