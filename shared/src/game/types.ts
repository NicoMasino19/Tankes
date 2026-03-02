import type { PlayerStats, StatKey } from "./stats";

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  aimX: number;
  aimY: number;
  sequence: number;
}

export interface PlayerNetState {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  hp: number;
  maxHp: number;
  invulnerableUntilMs: number;
  level: number;
  xp: number;
  upgradePoints: number;
  kills: number;
  deaths: number;
  stats: PlayerStats;
  activeBuffs?: ActiveBuffNetState[];
  updatedAtTick: number;
}

export const MatchPhase = {
  InProgress: "in_progress",
  Ended: "ended"
} as const;

export type MatchPhase = (typeof MatchPhase)[keyof typeof MatchPhase];

export const MatchWinCondition = {
  FirstToKills: "first_to_kills",
  TimeLimit: "time_limit"
} as const;

export type MatchWinCondition = (typeof MatchWinCondition)[keyof typeof MatchWinCondition];

export interface MatchConfig {
  winCondition: MatchWinCondition;
  objectiveKills: number;
  timeLimitMs: number;
  roundEndPauseMs: number;
  respawnDelayMs: number;
}

export interface PlayerScore {
  playerId: string;
  name: string;
  kills: number;
  deaths: number;
}

export interface RespawnState {
  playerId: string;
  respawnAtMs: number | null;
  invulnerableUntilMs: number | null;
}

export interface RoundResult {
  round: number;
  winCondition: MatchWinCondition;
  objectiveKills: number;
  timeLimitMs: number;
  winnerPlayerId: string | null;
  endedAtMs: number;
  nextRoundStartsAtMs: number;
  scoreboard: PlayerScore[];
}

export interface MatchState {
  round: number;
  phase: MatchPhase;
  winCondition: MatchWinCondition;
  objectiveKills: number;
  timeLimitMs: number;
  roundStartedAtMs: number;
  roundEndedAtMs: number | null;
  roundWinnerPlayerId: string | null;
  nextRoundStartsAtMs: number | null;
  scoreboard: PlayerScore[];
  updatedAtTick: number;
  config?: MatchConfig;
  lastRoundResult?: RoundResult | null;
  respawns?: RespawnState[];
}

export const RoundPhase = MatchPhase;

export type RoundPhase = MatchPhase;

export type SessionPlayerScoreNetState = PlayerScore;

export type SessionNetState = MatchState;

export interface BulletNetState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  updatedAtTick: number;
}

export const ShapeKind = {
  Square: "square",
  Triangle: "triangle",
  Hexagon: "hexagon"
} as const;

export type ShapeKind = (typeof ShapeKind)[keyof typeof ShapeKind];

export interface ShapeNetState {
  id: string;
  kind: ShapeKind;
  sides: number;
  x: number;
  y: number;
  rotation: number;
  radius: number;
  hp: number;
  maxHp: number;
  xpValue: number;
  updatedAtTick: number;
}

export const BuffType = {
  Damage: "damage",
  Reload: "reload",
  Movement: "movement"
} as const;

export type BuffType = (typeof BuffType)[keyof typeof BuffType];

export interface ActiveBuffNetState {
  type: BuffType;
  stacks: number;
  expiresAtMs: number;
}

export interface ZoneNetState {
  id: string;
  x: number;
  y: number;
  radius: number;
  ownerPlayerId: string | null;
  capturingPlayerId: string | null;
  captureProgress: number;
  contested: boolean;
  xpPerSecond: number;
  captureBonusXp: number;
  updatedAtTick: number;
}

export interface PowerUpNetState {
  id: string;
  type: BuffType;
  x: number;
  y: number;
  radius: number;
  expiresAtMs: number;
  updatedAtTick: number;
}

export interface JoinPayload {
  nickname: string;
  resumeToken?: string;
}

export interface JoinAckPayload {
  playerId: string;
  serverTime: number;
  resumeToken?: string;
}

export interface UpgradeStatPayload {
  stat: StatKey;
}

export type RoundEndedPayload = RoundResult;

export interface RoundResetPayload {
  round: number;
  winCondition: MatchWinCondition;
  objectiveKills: number;
  timeLimitMs: number;
  startedAtMs: number;
}

export type { PlayerStats, StatKey };
