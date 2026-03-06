import type {
  AbilityId,
  AbilitySlot,
  BuffType,
  InputState,
  PendingAbilityChoiceNetState,
  PlayerStats,
  ShapeKind
} from "@tankes/shared";

export interface ActiveBuffStateEntity {
  type: BuffType;
  stacks: number;
  expiresAtMs: number;
}

export interface PlayerEntity {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  radius: number;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  reloadMs: number;
  bulletSpeed: number;
  bulletDamage: number;
  invulnerableUntilMs: number;
  xp: number;
  totalXpEarned: number;
  level: number;
  upgradePoints: number;
  stats: PlayerStats;
  abilityLoadout: Partial<Record<AbilitySlot, AbilityId>>;
  abilityCooldownEndsAtMs: Partial<Record<AbilitySlot, number>>;
  pendingAbilityChoice: PendingAbilityChoiceNetState | null;
  activeBuffs: ActiveBuffStateEntity[];
  input: InputState;
  lastAcceptedInputSequence: number;
  lastShotAtMs: number;
  updatedAtTick: number;
}

export interface BulletEntity {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  expiresAtMs: number;
  active: boolean;
  updatedAtTick: number;
}

export interface ShapeEntity {
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

export interface ControlZoneEntity {
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

export interface PowerUpEntity {
  id: string;
  type: BuffType;
  x: number;
  y: number;
  radius: number;
  expiresAtMs: number;
  updatedAtTick: number;
}
