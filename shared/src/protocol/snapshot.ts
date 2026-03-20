import type {
  AbilityVfxCue,
  BulletNetState,
  MatchState,
  PlayerNetState,
  PowerUpNetState,
  ShapeNetState,
  ZoneNetState
} from "../game/types";

export type SessionDelta = MatchState;

export interface WorldDeltaSnapshot {
  tick: number;
  serverTime: number;
  abilityVfxCues?: AbilityVfxCue[];
  session?: SessionDelta;
  playersUpsert: PlayerNetState[];
  playersRemove: string[];
  bulletsUpsert: BulletNetState[];
  bulletsRemove: string[];
  shapesUpsert: ShapeNetState[];
  shapesRemove: string[];
  zonesUpsert: ZoneNetState[];
  zonesRemove: string[];
  powerUpsUpsert: PowerUpNetState[];
  powerUpsRemove: string[];
}
