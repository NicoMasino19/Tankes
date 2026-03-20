import type { PlayerStats, StatKey } from "./stats";

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  abilityTriggers?: AbilitySlot[];
  aimX: number;
  aimY: number;
  sequence: number;
}

export const AbilitySlot = {
  RightClick: "right_click",
  Slot1: "slot_1",
  Slot2: "slot_2",
  Ultimate: "slot_3"
} as const;

export type AbilitySlot = (typeof AbilitySlot)[keyof typeof AbilitySlot];

export const AbilityId = {
  DashVectorial: "dash_vectorial",
  EmpPulse: "emp_pulse",
  ReactiveShield: "reactive_shield",
  PiercingBurst: "piercing_burst",
  ProximityMine: "proximity_mine",
  LightTurret: "light_turret",
  TankRepair: "tank_repair",
  TacticalFog: "tactical_fog",
  Overheat: "overheat",
  OrbitalBarrage: "orbital_barrage",
  SiegeMode: "siege_mode",
  HomingMissile: "homing_missile"
} as const;

export type AbilityId = (typeof AbilityId)[keyof typeof AbilityId];

export interface AbilityDefinition {
  id: AbilityId;
  slot: AbilitySlot;
  name: string;
  description: string;
  cooldownMs: number;
}

export const AbilityVfxPhase = {
  Cast: "cast",
  Impact: "impact",
  Pulse: "pulse",
  Expire: "expire"
} as const;

export type AbilityVfxPhase = (typeof AbilityVfxPhase)[keyof typeof AbilityVfxPhase];

export interface AbilityVfxCue {
  id: string;
  abilityId: AbilityId;
  phase: AbilityVfxPhase;
  casterPlayerId: string;
  x: number;
  y: number;
  rotation?: number;
  radius?: number;
  durationMs?: number;
  createdAtMs: number;
  ttlMs: number;
}

export const ABILITY_UNLOCK_LEVELS: Record<AbilitySlot, number> = {
  [AbilitySlot.RightClick]: 2,
  [AbilitySlot.Slot1]: 3,
  [AbilitySlot.Slot2]: 4,
  [AbilitySlot.Ultimate]: 6
};

export const ABILITY_CHOICES_BY_SLOT: Record<AbilitySlot, readonly [AbilityId, AbilityId, AbilityId]> = {
  [AbilitySlot.RightClick]: [AbilityId.DashVectorial, AbilityId.EmpPulse, AbilityId.ReactiveShield],
  [AbilitySlot.Slot1]: [AbilityId.PiercingBurst, AbilityId.ProximityMine, AbilityId.LightTurret],
  [AbilitySlot.Slot2]: [AbilityId.TankRepair, AbilityId.TacticalFog, AbilityId.Overheat],
  [AbilitySlot.Ultimate]: [AbilityId.OrbitalBarrage, AbilityId.SiegeMode, AbilityId.HomingMissile]
};

export const ABILITY_DEFINITIONS: Record<AbilityId, AbilityDefinition> = {
  [AbilityId.DashVectorial]: {
    id: AbilityId.DashVectorial,
    slot: AbilitySlot.RightClick,
    name: "Dash Vectorial",
    description: "Desplazamiento corto en dirección de movimiento.",
    cooldownMs: 9_000
  },
  [AbilityId.EmpPulse]: {
    id: AbilityId.EmpPulse,
    slot: AbilitySlot.RightClick,
    name: "Pulso EMP",
    description: "Pulso corto que ralentiza y aplica debuff temporal.",
    cooldownMs: 11_000
  },
  [AbilityId.ReactiveShield]: {
    id: AbilityId.ReactiveShield,
    slot: AbilitySlot.RightClick,
    name: "Escudo Reactivo",
    description: "Escudo frontal temporal para bloquear proyectiles.",
    cooldownMs: 13_000
  },
  [AbilityId.PiercingBurst]: {
    id: AbilityId.PiercingBurst,
    slot: AbilitySlot.Slot1,
    name: "Ráfaga Perforante",
    description: "Ráfaga lineal con perforación limitada.",
    cooldownMs: 11_000
  },
  [AbilityId.ProximityMine]: {
    id: AbilityId.ProximityMine,
    slot: AbilitySlot.Slot1,
    name: "Mina de Proximidad",
    description: "Planta una bomba que detona cuando un enemigo la pisa y revienta el área.",
    cooldownMs: 12_000
  },
  [AbilityId.LightTurret]: {
    id: AbilityId.LightTurret,
    slot: AbilitySlot.Slot1,
    name: "Torreta Ligera",
    description: "Invoca torreta temporal de daño moderado.",
    cooldownMs: 16_000
  },
  [AbilityId.TankRepair]: {
    id: AbilityId.TankRepair,
    slot: AbilitySlot.Slot2,
    name: "Reparación del Tanque",
    description: "Cura 24% de vida y acelera movimiento brevemente.",
    cooldownMs: 18_000
  },
  [AbilityId.TacticalFog]: {
    id: AbilityId.TacticalFog,
    slot: AbilitySlot.Slot2,
    name: "Niebla Táctica",
    description: "Lanza una granada de humo enorme que ralentiza y te cubre la retirada.",
    cooldownMs: 14_000
  },
  [AbilityId.Overheat]: {
    id: AbilityId.Overheat,
    slot: AbilitySlot.Slot2,
    name: "Sobrecalentamiento",
    description: "Aumenta cadencia temporal con penalización posterior.",
    cooldownMs: 20_000
  },
  [AbilityId.OrbitalBarrage]: {
    id: AbilityId.OrbitalBarrage,
    slot: AbilitySlot.Ultimate,
    name: "Bombardeo Orbital",
    description: "Daño masivo en zona con pulsos secuenciales.",
    cooldownMs: 65_000
  },
  [AbilityId.SiegeMode]: {
    id: AbilityId.SiegeMode,
    slot: AbilitySlot.Ultimate,
    name: "Modo Asedio",
    description: "Ancla el tanque para potenciar alcance y daño.",
    cooldownMs: 60_000
  },
  [AbilityId.HomingMissile]: {
    id: AbilityId.HomingMissile,
    slot: AbilitySlot.Ultimate,
    name: "Misil Teledirigido",
    description: "Misil que busca al enemigo más cercano y explota en área.",
    cooldownMs: 68_000
  }
};

export interface PendingAbilityChoiceNetState {
  slot: AbilitySlot;
  unlockLevel: number;
  options: AbilityId[];
}

export interface AbilityRuntimeNetState {
  loadout: Partial<Record<AbilitySlot, AbilityId>>;
  cooldownEndsAtMs: Partial<Record<AbilitySlot, number>>;
  pendingChoice: PendingAbilityChoiceNetState | null;
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
  abilityRuntime?: AbilityRuntimeNetState;
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

export interface ChooseAbilityPayload {
  slot: AbilitySlot;
  abilityId: AbilityId;
}

export interface CastAbilityPayload {
  slot: AbilitySlot;
}

export type AbilityOfferPayload = PendingAbilityChoiceNetState;

export interface AbilityCastRejectedPayload {
  slot: AbilitySlot;
  reason:
    | "not_unlocked"
    | "not_selected"
    | "cooldown"
    | "dead"
    | "respawning"
    | "invalid_state"
    | "round_ended";
  retryAtMs?: number;
}
export interface PingProbePayload {
  clientSentAtMs: number;
}

export interface PingAckPayload {
  clientSentAtMs: number;
  serverReceivedAtMs: number;
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
