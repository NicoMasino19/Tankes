import {
  ABILITY_CHOICES_BY_SLOT,
  ABILITY_DEFINITIONS,
  ABILITY_UNLOCK_LEVELS,
  AbilityId,
  AbilitySlot,
  AbilityVfxPhase,
  BASE_BULLET_DAMAGE,
  BASE_BULLET_SPEED,
  BASE_MAX_HEALTH,
  BASE_MOVE_SPEED,
  BASE_RELOAD_MS,
  BUFF_DAMAGE_PER_STACK,
  BUFF_MAX_STACKS,
  BUFF_MOVEMENT_PER_STACK,
  BUFF_RELOAD_PER_STACK,
  BuffType,
  CONTROL_ZONE_BASE_CONFIG,
  CONTROL_ZONE_CAPTURE_RATE_PER_SECOND,
  CONTROL_ZONE_MAX_ACTIVE,
  CONTROL_ZONE_SPAWN_ATTEMPTS,
  CONTROL_ZONE_SPAWN_INTERVAL_MS,
  CONTROL_ZONE_SPAWN_MARGIN,
  GRID_CELL_SIZE,
  MatchWinCondition,
  PLAYER_RADIUS,
  POWER_UP_DURATION_MS,
  POWER_UP_MAX_ACTIVE,
  POWER_UP_RADIUS,
  POWER_UP_SPAWN_ATTEMPTS,
  POWER_UP_SPAWN_INTERVAL_MS,
  POWER_UP_SPAWN_PLAYER_SAFE_DISTANCE,
  POWER_UP_TTL_MS,
  POWER_UP_TYPE_WEIGHTS,
  RESPAWN_INVULNERABILITY_MS,
  ShapeKind,
  type AbilityCastRejectedPayload,
  type AbilityOfferPayload,
  type AbilityVfxCue,
  type CastAbilityPayload,
  type MatchConfig,
  MatchPhase,
  type PendingAbilityChoiceNetState,
  type RespawnState,
  STAT_KEYS,
  STAT_MAX_LEVEL,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  createBaseStats,
  type BulletNetState,
  type InputState,
  type MatchState,
  type PlayerNetState,
  type PowerUpNetState,
  type PlayerScore,
  type RoundEndedPayload,
  type RoundResetPayload,
  type ShapeNetState,
  type ZoneNetState,
  type StatKey,
  getXpRequiredForLevel
} from "@tankes/shared";
import type {
  BulletEntity,
  ControlZoneEntity,
  PlayerEntity,
  PowerUpEntity,
  ShapeEntity
} from "../domain/entities";
import { TankFactory } from "../sim/factories/TankFactory";
import { BulletFactory } from "../sim/factories/BulletFactory";
import { BulletPool } from "../sim/pool/BulletPool";
import { UniformGrid } from "../sim/spatial/UniformGrid";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const SAFE_SPAWN_MARGIN = 96;
const SAFE_SPAWN_ATTEMPTS = 24;
const SAFE_SPAWN_MIN_DISTANCE = PLAYER_RADIUS * 4;
const PLAYER_SHAPE_COLLISION_PASSES = 2;
const MAX_ACTIVE_SHAPES = 96;
const SHAPE_SPAWN_MARGIN = 90;
const SHAPE_SPAWN_ATTEMPTS = 64;
const SHAPE_PLAYER_SPAWN_GAP = PLAYER_RADIUS * 2;
const ZONE_XP_ACCURACY_SCALE = 100;
const POWER_UP_PLAYER_COLLISION_EXTRA = 4;
const POWER_UP_SHAPE_SAFE_DISTANCE = 36;
const PVP_STEAL_XP_RATIO = 0.12;
const PVP_STEAL_XP_MIN = 18;
const PVP_STEAL_XP_MAX = 90;
const MOVEMENT_SPEED_PER_LEVEL = 0.06;
const RELOAD_SPEED_PER_LEVEL = 0.06;
const BULLET_SPEED_PER_LEVEL = 0.055;
const BULLET_DAMAGE_PER_LEVEL = 0.06;
const MAX_HEALTH_PER_LEVEL = 0.08;
const DASH_DISTANCE = 180;
const EMP_RADIUS = 200;
const EMP_SLOW_DURATION_MS = 1_000;
const EMP_SLOW_FACTOR = 0.82;
const REACTIVE_SHIELD_DURATION_MS = 1_350;
const PIERCING_BURST_DAMAGE_FACTOR = 0.68;
const PROXIMITY_MINE_TRIGGER_RADIUS = 28;
const PROXIMITY_MINE_EXPLOSION_RADIUS = 160;
const PROXIMITY_MINE_ARMING_MS = 350;
const PROXIMITY_MINE_DURATION_MS = 10_000;
const PROXIMITY_MINE_DAMAGE_FACTOR = 2.4;
const LIGHT_TURRET_RADIUS = 300;
const LIGHT_TURRET_DAMAGE_FACTOR = 0.6;
const LIGHT_TURRET_DURATION_MS = 5_500;
const LIGHT_TURRET_FIRE_INTERVAL_MS = 360;
const TANK_REPAIR_PERCENT = 0.24;
const TANK_REPAIR_SPEED_DURATION_MS = 2_500;
const TACTICAL_FOG_RADIUS = 320;
const TACTICAL_FOG_DURATION_MS = 5_200;
const TACTICAL_FOG_SLOW_REFRESH_MS = 220;
const OVERHEAT_DURATION_MS = 3_500;
const OVERHEAT_PENALTY_DURATION_MS = 1_200;
const ORBITAL_RADIUS = 160;
const ORBITAL_DAMAGE_FACTOR = 0.62;
const SIEGE_DURATION_MS = 4_500;
const SIEGE_DAMAGE_FACTOR = 1.22;
const SIEGE_RELOAD_FACTOR = 0.88;
const HOMING_EXPLOSION_RADIUS = 120;
const HOMING_DAMAGE_FACTOR = 1.8;

type BuffTypeValue = (typeof BuffType)[keyof typeof BuffType];

interface AbilityOfferEvent {
  playerId: string;
  payload: AbilityOfferPayload;
}

export interface AbilityCastResult {
  ok: boolean;
  rejected?: AbilityCastRejectedPayload;
}

interface ProximityMineState {
  x: number;
  y: number;
  armedAtMs: number;
  expiresAtMs: number;
}

interface TacticalFogState {
  x: number;
  y: number;
  radius: number;
  expiresAtMs: number;
}

interface ShapeTemplate {
  kind: (typeof ShapeKind)[keyof typeof ShapeKind];
  sides: number;
  radius: number;
  hp: number;
  xpValue: number;
  weight: number;
}

const SHAPE_TEMPLATES: ShapeTemplate[] = [
  {
    kind: ShapeKind.Square,
    sides: 4,
    radius: 28,
    hp: 48,
    xpValue: 20,
    weight: 62
  },
  {
    kind: ShapeKind.Triangle,
    sides: 3,
    radius: 24,
    hp: 74,
    xpValue: 32,
    weight: 28
  },
  {
    kind: ShapeKind.Hexagon,
    sides: 6,
    radius: 34,
    hp: 140,
    xpValue: 72,
    weight: 10
  }
];

const DEFAULT_MATCH_CONFIG: MatchConfig = {
  winCondition: MatchWinCondition.TimeLimit,
  objectiveKills: 18,
  timeLimitMs: 600_000,
  roundEndPauseMs: 5_000,
  respawnDelayMs: 1_800
};

export interface WorldOptions {
  matchConfig?: Partial<MatchConfig>;
}

export interface WorldTickMetrics {
  activePlayers: number;
  activeBullets: number;
  collisionsEvaluated: number;
}

export type WorldSessionEvent =
  | {
      type: "round_ended";
      payload: RoundEndedPayload;
    }
  | {
      type: "round_reset";
      payload: RoundResetPayload;
    };

export class World {
  private readonly players = new Map<string, PlayerEntity>();
  private readonly bullets = new Map<string, BulletEntity>();
  private readonly shapes = new Map<string, ShapeEntity>();
  private readonly zones = new Map<string, ControlZoneEntity>();
  private readonly powerUps = new Map<string, PowerUpEntity>();
  private readonly removedPlayers = new Set<string>();
  private readonly removedBullets = new Set<string>();
  private readonly removedShapes = new Set<string>();
  private readonly removedZones = new Set<string>();
  private readonly removedPowerUps = new Set<string>();
  private readonly tankFactory = new TankFactory();
  private readonly bulletFactory = new BulletFactory(new BulletPool());
  private readonly spatialGrid = new UniformGrid(GRID_CELL_SIZE);
  private readonly nearbyPlayersBuffer: string[] = [];
  private readonly nearbyShapesBuffer: ShapeEntity[] = [];
  private readonly playerKills = new Map<string, number>();
  private readonly playerDeaths = new Map<string, number>();
  private readonly playerPresenceXpCarry = new Map<string, number>();
  private readonly pendingRespawns = new Map<string, number>();
  private readonly sessionEvents: WorldSessionEvent[] = [];
  private readonly abilityOfferEvents: AbilityOfferEvent[] = [];
  private readonly pendingAbilityVfxCues: AbilityVfxCue[] = [];
  private readonly empSlowUntilMs = new Map<string, number>();
  private readonly reactiveShieldUntilMs = new Map<string, number>();
  private readonly overheatUntilMs = new Map<string, number>();
  private readonly overheatPenaltyUntilMs = new Map<string, number>();
  private readonly siegeUntilMs = new Map<string, number>();
  private readonly repairBoostUntilMs = new Map<string, number>();
  private readonly proximityMineByPlayerId = new Map<string, ProximityMineState>();
  private readonly tacticalFogByPlayerId = new Map<string, TacticalFogState>();
  private readonly turretByPlayerId = new Map<string, { x: number; y: number; expiresAtMs: number; lastFireAtMs: number }>();
  private readonly orbitalByPlayerId = new Map<string, { x: number; y: number; remainingPulses: number; nextPulseAtMs: number }>();
  private readonly matchConfig: MatchConfig;
  private round = 1;
  private roundPhase: MatchState["phase"] = MatchPhase.InProgress;
  private roundStartedAtMs = Date.now();
  private roundEndedAtMs: number | null = null;
  private roundWinnerPlayerId: string | null = null;
  private nextRoundStartsAtMs: number | null = null;
  private lastRoundResult: RoundEndedPayload | null = null;
  private sessionUpdatedAtTick = 0;
  private nextShapeSequence = 0;
  private nextZoneSequence = 0;
  private nextPowerUpSequence = 0;
  private lastZoneSpawnAtMs = 0;
  private lastPowerUpSpawnAtMs = 0;
  private nextAbilityVfxCueSequence = 0;

  constructor(options?: WorldOptions) {
    this.matchConfig = {
      ...DEFAULT_MATCH_CONFIG,
      ...(options?.matchConfig ?? {})
    };

    this.lastZoneSpawnAtMs = -CONTROL_ZONE_SPAWN_INTERVAL_MS;
    this.lastPowerUpSpawnAtMs = Date.now();
  }

  addPlayer(id: string, nickname: string, tick: number): PlayerEntity {
    const safeName = nickname.trim().slice(0, 16) || "Tanker";
    const spawn = this.findSafeSpawn(id);
    const player = this.tankFactory.create(id, safeName, tick, spawn);
    this.recalculateDerivedStats(player, false);
    player.hp = player.maxHp;
    this.players.set(id, player);
    this.playerKills.set(id, 0);
    this.playerDeaths.set(id, 0);
    this.playerPresenceXpCarry.set(id, 0);
    this.removedPlayers.delete(id);
    this.touchSession(tick);
    return player;
  }

  removePlayer(id: string, tick?: number): void {
    if (this.players.delete(id)) {
      this.pendingRespawns.delete(id);
      this.empSlowUntilMs.delete(id);
      this.reactiveShieldUntilMs.delete(id);
      this.overheatUntilMs.delete(id);
      this.overheatPenaltyUntilMs.delete(id);
      this.siegeUntilMs.delete(id);
      this.repairBoostUntilMs.delete(id);
      this.proximityMineByPlayerId.delete(id);
      this.tacticalFogByPlayerId.delete(id);
      this.turretByPlayerId.delete(id);
      this.orbitalByPlayerId.delete(id);
      this.removedPlayers.add(id);
      this.playerKills.delete(id);
      this.playerDeaths.delete(id);
      this.playerPresenceXpCarry.delete(id);

      for (const zone of this.zones.values()) {
        if (zone.ownerPlayerId === id) {
          zone.ownerPlayerId = null;
          zone.updatedAtTick = tick ?? this.sessionUpdatedAtTick + 1;
        }
        if (zone.capturingPlayerId === id) {
          zone.capturingPlayerId = null;
          zone.captureProgress = 0;
          zone.updatedAtTick = tick ?? this.sessionUpdatedAtTick + 1;
        }
      }

      this.touchSession(tick ?? this.sessionUpdatedAtTick + 1);
    }
  }

  setInput(id: string, input: InputState, options?: { ignoreSequence?: boolean }): boolean {
    const player = this.players.get(id);
    if (!player) {
      return false;
    }

    if (!options?.ignoreSequence && input.sequence <= player.lastAcceptedInputSequence) {
      return false;
    }

    player.input = input;

    if (!options?.ignoreSequence || input.sequence > player.lastAcceptedInputSequence) {
      player.lastAcceptedInputSequence = input.sequence;
    }

    return true;
  }

  upgradeStat(id: string, stat: StatKey, tick: number): boolean {
    const player = this.players.get(id);
    if (!player || player.upgradePoints <= 0 || !STAT_KEYS.includes(stat)) {
      return false;
    }

    if (player.stats[stat] >= STAT_MAX_LEVEL) {
      return false;
    }

    player.stats[stat] += 1;
    player.upgradePoints -= 1;

    this.recalculateDerivedStats(player, stat === "maxHealth");

    player.updatedAtTick = tick;
    return true;
  }

  step(dtSeconds: number, tick: number, nowMs: number): WorldTickMetrics {
    this.processRoundResetIfDue(tick, nowMs);

    if (this.isRoundEnded()) {
      return {
        activePlayers: this.players.size,
        activeBullets: this.bullets.size,
        collisionsEvaluated: 0
      };
    }

    this.processPendingRespawns(tick, nowMs);
    this.updateBuffExpirations(tick, nowMs);
    this.updateAbilityRuntime(tick, nowMs);
    this.ensureShapePopulation(tick);
    this.updateControlZones(dtSeconds, tick, nowMs);
    this.updatePowerUps(dtSeconds, tick, nowMs);
    this.evaluateRoundEnd(tick, nowMs);

    if (this.isRoundEnded()) {
      return {
        activePlayers: this.players.size,
        activeBullets: this.bullets.size,
        collisionsEvaluated: 0
      };
    }

    this.updatePlayers(dtSeconds, tick, nowMs);
    this.updateShooting(tick, nowMs);
    this.updateBullets(dtSeconds, tick, nowMs);
    const collisionsEvaluated = this.resolveCollisions(tick, nowMs);

    let activeBullets = 0;
    for (const bullet of this.bullets.values()) {
      if (bullet.active) {
        activeBullets += 1;
      }
    }

    return {
      activePlayers: this.players.size,
      activeBullets,
      collisionsEvaluated
    };
  }

  toPlayerNetState(player: PlayerEntity): PlayerNetState {
    return {
      id: player.id,
      name: player.name,
      x: player.x,
      y: player.y,
      rotation: player.rotation,
      hp: player.hp,
      maxHp: player.maxHp,
      invulnerableUntilMs: player.invulnerableUntilMs,
      level: player.level,
      xp: player.xp,
      upgradePoints: player.upgradePoints,
      kills: this.playerKills.get(player.id) ?? 0,
      deaths: this.playerDeaths.get(player.id) ?? 0,
      stats: player.stats,
      activeBuffs: player.activeBuffs,
      abilityRuntime: {
        loadout: { ...player.abilityLoadout },
        cooldownEndsAtMs: { ...player.abilityCooldownEndsAtMs },
        pendingChoice: player.pendingAbilityChoice
      },
      updatedAtTick: player.updatedAtTick
    };
  }

  getMatchState(): MatchState {
    return {
      round: this.round,
      phase: this.roundPhase,
      winCondition: this.matchConfig.winCondition,
      objectiveKills: this.matchConfig.objectiveKills,
      timeLimitMs: this.matchConfig.timeLimitMs,
      roundStartedAtMs: this.roundStartedAtMs,
      roundEndedAtMs: this.roundEndedAtMs,
      roundWinnerPlayerId: this.roundWinnerPlayerId,
      nextRoundStartsAtMs: this.nextRoundStartsAtMs,
      scoreboard: this.buildScoreboard(),
      updatedAtTick: this.sessionUpdatedAtTick,
      config: this.matchConfig,
      lastRoundResult: this.lastRoundResult,
      respawns: this.buildRespawnState()
    };
  }

  getSessionNetState(): MatchState {
    return this.getMatchState();
  }

  consumeSessionEvents(): WorldSessionEvent[] {
    const events = [...this.sessionEvents];
    this.sessionEvents.length = 0;
    return events;
  }

  consumeAbilityOfferEvents(): AbilityOfferEvent[] {
    const events = [...this.abilityOfferEvents];
    this.abilityOfferEvents.length = 0;
    return events;
  }

  consumeAbilityVfxCues(): AbilityVfxCue[] {
    const cues = [...this.pendingAbilityVfxCues];
    this.pendingAbilityVfxCues.length = 0;
    return cues;
  }

  chooseAbility(playerId: string, slot: AbilitySlot, abilityId: AbilityId, tick: number): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.pendingAbilityChoice) {
      return false;
    }

    const pending = player.pendingAbilityChoice;
    if (pending.slot !== slot) {
      return false;
    }

    if (!pending.options.includes(abilityId)) {
      return false;
    }

    player.abilityLoadout[slot] = abilityId;
    player.pendingAbilityChoice = null;
    this.enqueueAbilityChoiceIfNeeded(player);
    player.updatedAtTick = tick;
    return true;
  }

  castAbility(playerId: string, payload: CastAbilityPayload, tick: number, nowMs: number): AbilityCastResult {
    return this.executeAbilityCast(playerId, payload.slot, tick, nowMs);
  }

  toBulletNetState(bullet: BulletEntity): BulletNetState {
    return {
      id: bullet.id,
      ownerId: bullet.ownerId,
      x: bullet.x,
      y: bullet.y,
      vx: bullet.vx,
      vy: bullet.vy,
      radius: bullet.radius,
      updatedAtTick: bullet.updatedAtTick
    };
  }

  toShapeNetState(shape: ShapeEntity): ShapeNetState {
    return {
      id: shape.id,
      kind: shape.kind,
      sides: shape.sides,
      x: shape.x,
      y: shape.y,
      rotation: shape.rotation,
      radius: shape.radius,
      hp: shape.hp,
      maxHp: shape.maxHp,
      xpValue: shape.xpValue,
      updatedAtTick: shape.updatedAtTick
    };
  }

  toZoneNetState(zone: ControlZoneEntity): ZoneNetState {
    return {
      id: zone.id,
      x: zone.x,
      y: zone.y,
      radius: zone.radius,
      ownerPlayerId: zone.ownerPlayerId,
      capturingPlayerId: zone.capturingPlayerId,
      captureProgress: zone.captureProgress,
      contested: zone.contested,
      xpPerSecond: zone.xpPerSecond,
      captureBonusXp: zone.captureBonusXp,
      updatedAtTick: zone.updatedAtTick
    };
  }

  toPowerUpNetState(powerUp: PowerUpEntity): PowerUpNetState {
    return {
      id: powerUp.id,
      type: powerUp.type,
      x: powerUp.x,
      y: powerUp.y,
      radius: powerUp.radius,
      expiresAtMs: powerUp.expiresAtMs,
      updatedAtTick: powerUp.updatedAtTick
    };
  }

  getPlayers(): IterableIterator<PlayerEntity> {
    return this.players.values();
  }

  getBullets(): IterableIterator<BulletEntity> {
    return this.bullets.values();
  }

  getShapes(): IterableIterator<ShapeEntity> {
    return this.shapes.values();
  }

  getZones(): IterableIterator<ControlZoneEntity> {
    return this.zones.values();
  }

  getPowerUps(): IterableIterator<PowerUpEntity> {
    return this.powerUps.values();
  }

  consumeRemovedPlayers(): string[] {
    const list = [...this.removedPlayers];
    this.removedPlayers.clear();
    return list;
  }

  consumeRemovedBullets(): string[] {
    const list = [...this.removedBullets];
    this.removedBullets.clear();
    return list;
  }

  consumeRemovedShapes(): string[] {
    const list = [...this.removedShapes];
    this.removedShapes.clear();
    return list;
  }

  consumeRemovedZones(): string[] {
    const list = [...this.removedZones];
    this.removedZones.clear();
    return list;
  }

  consumeRemovedPowerUps(): string[] {
    const list = [...this.removedPowerUps];
    this.removedPowerUps.clear();
    return list;
  }

  getPlayer(id: string): PlayerEntity | undefined {
    return this.players.get(id);
  }

  private updatePlayers(dtSeconds: number, tick: number, nowMs: number): void {
    for (const player of this.players.values()) {
      if (player.hp <= 0 || this.isPendingRespawn(player.id, nowMs)) {
        continue;
      }

      const axisX = (player.input.right ? 1 : 0) - (player.input.left ? 1 : 0);
      const axisY = (player.input.down ? 1 : 0) - (player.input.up ? 1 : 0);
      const axisLength = Math.hypot(axisX, axisY) || 1;
      const effectiveMoveSpeed = player.moveSpeed * this.getMovementMultiplier(player.id, nowMs);
      const nextX = player.x + (axisX / axisLength) * effectiveMoveSpeed * dtSeconds;
      const nextY = player.y + (axisY / axisLength) * effectiveMoveSpeed * dtSeconds;
      const clampedX = clamp(nextX, player.radius, WORLD_WIDTH - player.radius);
      const clampedY = clamp(nextY, player.radius, WORLD_HEIGHT - player.radius);
      const nextRotation = Math.atan2(player.input.aimY - player.y, player.input.aimX - player.x);

      if (
        Math.abs(clampedX - player.x) > 0.0001 ||
        Math.abs(clampedY - player.y) > 0.0001 ||
        Math.abs(nextRotation - player.rotation) > 0.0001
      ) {
        player.x = clampedX;
        player.y = clampedY;
        this.resolvePlayerShapeOverlaps(player);
        player.rotation = Number.isFinite(nextRotation) ? nextRotation : player.rotation;
        player.updatedAtTick = tick;
      }
    }
  }

  private updateShooting(tick: number, nowMs: number): void {
    for (const player of this.players.values()) {
      if (player.hp <= 0 || this.isPendingRespawn(player.id, nowMs)) {
        continue;
      }

      if (!player.input.shoot) {
        continue;
      }

      const effectiveReloadMs = player.reloadMs * this.getReloadMultiplier(player.id, nowMs);
      if (nowMs - player.lastShotAtMs < effectiveReloadMs) {
        continue;
      }

      const bullet = this.bulletFactory.create(player, nowMs, tick);
      bullet.damage *= this.getBulletDamageMultiplier(player.id, nowMs);
      this.bullets.set(bullet.id, bullet);
      player.lastShotAtMs = nowMs;
    }
  }

  private updateBullets(dtSeconds: number, tick: number, nowMs: number): void {
    for (const bullet of this.bullets.values()) {
      if (!bullet.active) {
        continue;
      }

      bullet.x += bullet.vx * dtSeconds;
      bullet.y += bullet.vy * dtSeconds;
      bullet.updatedAtTick = tick;

      const outOfWorld =
        bullet.x < -64 ||
        bullet.y < -64 ||
        bullet.x > WORLD_WIDTH + 64 ||
        bullet.y > WORLD_HEIGHT + 64;

      if (outOfWorld || nowMs >= bullet.expiresAtMs) {
        this.destroyBullet(bullet.id);
      }
    }
  }

  private updateAbilityRuntime(tick: number, nowMs: number): void {
    for (const player of this.players.values()) {
      this.cleanupExpiredAbilityStates(player.id, nowMs);

      const mine = this.proximityMineByPlayerId.get(player.id);
      if (mine && mine.expiresAtMs <= nowMs) {
        this.emitAbilityVfxCue({
          abilityId: AbilityId.ProximityMine,
          phase: AbilityVfxPhase.Expire,
          casterPlayerId: player.id,
          x: mine.x,
          y: mine.y,
          radius: PROXIMITY_MINE_EXPLOSION_RADIUS,
          durationMs: 220,
          ttlMs: 420
        }, nowMs);
        this.proximityMineByPlayerId.delete(player.id);
        player.updatedAtTick = tick;
      } else if (mine && mine.armedAtMs <= nowMs) {
        let triggered = false;
        for (const target of this.players.values()) {
          if (target.id === player.id || target.hp <= 0 || this.isPendingRespawn(target.id, nowMs)) {
            continue;
          }
          const combinedTriggerRadius = target.radius + PROXIMITY_MINE_TRIGGER_RADIUS;
          const dx = target.x - mine.x;
          const dy = target.y - mine.y;
          if (dx * dx + dy * dy > combinedTriggerRadius * combinedTriggerRadius) {
            continue;
          }

          this.emitAbilityVfxCue({
            abilityId: AbilityId.ProximityMine,
            phase: AbilityVfxPhase.Impact,
            casterPlayerId: player.id,
            x: mine.x,
            y: mine.y,
            radius: PROXIMITY_MINE_EXPLOSION_RADIUS,
            durationMs: 360,
            ttlMs: 760
          }, nowMs);
          this.applyAreaDamage(
            player.id,
            mine.x,
            mine.y,
            PROXIMITY_MINE_EXPLOSION_RADIUS,
            player.bulletDamage * PROXIMITY_MINE_DAMAGE_FACTOR,
            tick,
            nowMs
          );
          this.proximityMineByPlayerId.delete(player.id);
          player.updatedAtTick = tick;
          triggered = true;
          break;
        }

        if (triggered) {
          continue;
        }
      }

      const fog = this.tacticalFogByPlayerId.get(player.id);
      if (fog && fog.expiresAtMs <= nowMs) {
        this.emitAbilityVfxCue({
          abilityId: AbilityId.TacticalFog,
          phase: AbilityVfxPhase.Expire,
          casterPlayerId: player.id,
          x: fog.x,
          y: fog.y,
          radius: fog.radius,
          durationMs: 260,
          ttlMs: 520
        }, nowMs);
        this.tacticalFogByPlayerId.delete(player.id);
        player.updatedAtTick = tick;
      } else if (fog) {
        const radiusSq = fog.radius * fog.radius;
        for (const target of this.players.values()) {
          if (target.id === player.id || target.hp <= 0 || this.isPendingRespawn(target.id, nowMs)) {
            continue;
          }
          const dx = target.x - fog.x;
          const dy = target.y - fog.y;
          if (dx * dx + dy * dy > radiusSq) {
            continue;
          }
          this.empSlowUntilMs.set(
            target.id,
            Math.max(this.empSlowUntilMs.get(target.id) ?? 0, nowMs + TACTICAL_FOG_SLOW_REFRESH_MS)
          );
        }
      }

      const turret = this.turretByPlayerId.get(player.id);
      if (turret && turret.expiresAtMs > nowMs && nowMs - turret.lastFireAtMs >= LIGHT_TURRET_FIRE_INTERVAL_MS) {
        const target = this.findNearestEnemy(player.id, turret.x, turret.y, LIGHT_TURRET_RADIUS, nowMs);
        if (target) {
          turret.lastFireAtMs = nowMs;
          this.emitAbilityVfxCue({
            abilityId: AbilityId.LightTurret,
            phase: AbilityVfxPhase.Pulse,
            casterPlayerId: player.id,
            x: turret.x,
            y: turret.y,
            rotation: Math.atan2(target.y - turret.y, target.x - turret.x),
            radius: Math.hypot(target.x - turret.x, target.y - turret.y),
            durationMs: 140,
            ttlMs: 420
          }, nowMs);
          target.hp = clamp(target.hp - player.bulletDamage * LIGHT_TURRET_DAMAGE_FACTOR, 0, target.maxHp);
          target.updatedAtTick = tick;
          if (target.hp <= 0) {
            this.handleKill(player.id, target, tick, nowMs);
          }
        }
      }

      if (turret && turret.expiresAtMs <= nowMs) {
        this.emitAbilityVfxCue({
          abilityId: AbilityId.LightTurret,
          phase: AbilityVfxPhase.Expire,
          casterPlayerId: player.id,
          x: turret.x,
          y: turret.y,
          radius: 24,
          durationMs: 180,
          ttlMs: 420
        }, nowMs);
        this.turretByPlayerId.delete(player.id);
        player.updatedAtTick = tick;
      }

      const orbital = this.orbitalByPlayerId.get(player.id);
      if (orbital && orbital.remainingPulses > 0 && nowMs >= orbital.nextPulseAtMs) {
        this.emitAbilityVfxCue({
          abilityId: AbilityId.OrbitalBarrage,
          phase: AbilityVfxPhase.Pulse,
          casterPlayerId: player.id,
          x: orbital.x,
          y: orbital.y,
          radius: ORBITAL_RADIUS,
          durationMs: 260,
          ttlMs: 620
        }, nowMs);
        this.applyAreaDamage(
          player.id,
          orbital.x,
          orbital.y,
          ORBITAL_RADIUS,
          player.bulletDamage * ORBITAL_DAMAGE_FACTOR,
          tick,
          nowMs
        );
        orbital.remainingPulses -= 1;
        orbital.nextPulseAtMs += 300;
        if (orbital.remainingPulses <= 0) {
          this.orbitalByPlayerId.delete(player.id);
        }
        player.updatedAtTick = tick;
      }
    }
  }

  private executeAbilityCast(playerId: string, slot: AbilitySlot, tick: number, nowMs: number): AbilityCastResult {
    const player = this.players.get(playerId);
    if (!player) {
      return {
        ok: false,
        rejected: { slot, reason: "invalid_state" }
      };
    }

    if (this.isRoundEnded()) {
      return {
        ok: false,
        rejected: { slot, reason: "round_ended" }
      };
    }

    if (player.hp <= 0) {
      return {
        ok: false,
        rejected: { slot, reason: "dead" }
      };
    }

    if (this.isPendingRespawn(player.id, nowMs)) {
      return {
        ok: false,
        rejected: { slot, reason: "respawning" }
      };
    }

    const unlockLevel = ABILITY_UNLOCK_LEVELS[slot];
    if (!unlockLevel || player.level < unlockLevel) {
      return {
        ok: false,
        rejected: { slot, reason: "not_unlocked" }
      };
    }

    const abilityId = player.abilityLoadout[slot];
    if (!abilityId) {
      return {
        ok: false,
        rejected: { slot, reason: "not_selected" }
      };
    }

    const cooldownEndsAtMs = player.abilityCooldownEndsAtMs[slot] ?? 0;
    if (nowMs < cooldownEndsAtMs) {
      return {
        ok: false,
        rejected: {
          slot,
          reason: "cooldown",
          retryAtMs: cooldownEndsAtMs
        }
      };
    }

    this.applyAbilityEffect(player, abilityId, tick, nowMs);
    const cooldownMs = ABILITY_DEFINITIONS[abilityId].cooldownMs;
    player.abilityCooldownEndsAtMs[slot] = nowMs + cooldownMs;
    player.updatedAtTick = tick;
    return { ok: true };
  }

  private applyAbilityEffect(player: PlayerEntity, abilityId: AbilityId, tick: number, nowMs: number): void {
    switch (abilityId) {
      case AbilityId.DashVectorial: {
        const axisX = (player.input.right ? 1 : 0) - (player.input.left ? 1 : 0);
        const axisY = (player.input.down ? 1 : 0) - (player.input.up ? 1 : 0);
        const fallbackX = Math.cos(player.rotation);
        const fallbackY = Math.sin(player.rotation);
        const length = Math.hypot(axisX, axisY) || Math.hypot(fallbackX, fallbackY) || 1;
        player.x = clamp(player.x + (axisX || fallbackX) / length * DASH_DISTANCE, player.radius, WORLD_WIDTH - player.radius);
        player.y = clamp(player.y + (axisY || fallbackY) / length * DASH_DISTANCE, player.radius, WORLD_HEIGHT - player.radius);
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.x,
          y: player.y,
          rotation: Math.atan2(axisY || fallbackY, axisX || fallbackX),
          durationMs: 240,
          ttlMs: 450
        }, nowMs);
        player.updatedAtTick = tick;
        break;
      }
      case AbilityId.EmpPulse: {
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Pulse,
          casterPlayerId: player.id,
          x: player.x,
          y: player.y,
          radius: EMP_RADIUS,
          durationMs: EMP_SLOW_DURATION_MS,
          ttlMs: 900
        }, nowMs);
        for (const target of this.players.values()) {
          if (target.id === player.id || target.hp <= 0 || this.isPendingRespawn(target.id, nowMs)) {
            continue;
          }
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          if (dx * dx + dy * dy > EMP_RADIUS * EMP_RADIUS) {
            continue;
          }
          this.empSlowUntilMs.set(target.id, nowMs + EMP_SLOW_DURATION_MS);
          target.updatedAtTick = tick;
        }
        break;
      }
      case AbilityId.ReactiveShield: {
        this.reactiveShieldUntilMs.set(player.id, nowMs + REACTIVE_SHIELD_DURATION_MS);
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.x,
          y: player.y,
          radius: player.radius + 10,
          durationMs: REACTIVE_SHIELD_DURATION_MS,
          ttlMs: REACTIVE_SHIELD_DURATION_MS + 250
        }, nowMs);
        break;
      }
      case AbilityId.PiercingBurst: {
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.x,
          y: player.y,
          rotation: player.rotation,
          radius: 140,
          durationMs: 160,
          ttlMs: 420
        }, nowMs);
        for (const angleOffset of [-0.08, 0, 0.08]) {
          const angle = player.rotation + angleOffset;
          const bullet = this.bulletFactory.create(player, nowMs, tick);
          bullet.vx = Math.cos(angle) * player.bulletSpeed;
          bullet.vy = Math.sin(angle) * player.bulletSpeed;
          bullet.damage = player.bulletDamage * PIERCING_BURST_DAMAGE_FACTOR;
          this.bullets.set(bullet.id, bullet);
        }
        break;
      }
      case AbilityId.ProximityMine: {
        const previousMine = this.proximityMineByPlayerId.get(player.id);
        if (previousMine) {
          this.emitAbilityVfxCue({
            abilityId,
            phase: AbilityVfxPhase.Expire,
            casterPlayerId: player.id,
            x: previousMine.x,
            y: previousMine.y,
            radius: PROXIMITY_MINE_EXPLOSION_RADIUS,
            durationMs: 220,
            ttlMs: 420
          }, nowMs);
        }
        this.proximityMineByPlayerId.set(player.id, {
          x: player.input.aimX,
          y: player.input.aimY,
          armedAtMs: nowMs + PROXIMITY_MINE_ARMING_MS,
          expiresAtMs: nowMs + PROXIMITY_MINE_DURATION_MS
        });
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.input.aimX,
          y: player.input.aimY,
          radius: PROXIMITY_MINE_EXPLOSION_RADIUS,
          durationMs: PROXIMITY_MINE_DURATION_MS,
          ttlMs: PROXIMITY_MINE_DURATION_MS + 900
        }, nowMs);
        break;
      }
      case AbilityId.LightTurret: {
        this.turretByPlayerId.set(player.id, {
          x: player.x,
          y: player.y,
          expiresAtMs: nowMs + LIGHT_TURRET_DURATION_MS,
          lastFireAtMs: 0
        });
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.x,
          y: player.y,
          radius: 24,
          durationMs: LIGHT_TURRET_DURATION_MS,
          ttlMs: LIGHT_TURRET_DURATION_MS + 450
        }, nowMs);
        break;
      }
      case AbilityId.TankRepair: {
        player.hp = clamp(player.hp + player.maxHp * TANK_REPAIR_PERCENT, 0, player.maxHp);
        this.repairBoostUntilMs.set(player.id, nowMs + TANK_REPAIR_SPEED_DURATION_MS);
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.x,
          y: player.y,
          radius: player.radius + 18,
          durationMs: 420,
          ttlMs: 760
        }, nowMs);
        player.updatedAtTick = tick;
        break;
      }
      case AbilityId.TacticalFog: {
        const previousFog = this.tacticalFogByPlayerId.get(player.id);
        if (previousFog) {
          this.emitAbilityVfxCue({
            abilityId,
            phase: AbilityVfxPhase.Expire,
            casterPlayerId: player.id,
            x: previousFog.x,
            y: previousFog.y,
            radius: previousFog.radius,
            durationMs: 260,
            ttlMs: 520
          }, nowMs);
        }
        this.tacticalFogByPlayerId.set(player.id, {
          x: player.input.aimX,
          y: player.input.aimY,
          radius: TACTICAL_FOG_RADIUS,
          expiresAtMs: nowMs + TACTICAL_FOG_DURATION_MS
        });
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.input.aimX,
          y: player.input.aimY,
          radius: TACTICAL_FOG_RADIUS,
          durationMs: TACTICAL_FOG_DURATION_MS,
          ttlMs: TACTICAL_FOG_DURATION_MS + 650
        }, nowMs);
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Pulse,
          casterPlayerId: player.id,
          x: player.input.aimX,
          y: player.input.aimY,
          radius: TACTICAL_FOG_RADIUS,
          durationMs: 900,
          ttlMs: 1_250
        }, nowMs);
        break;
      }
      case AbilityId.Overheat: {
        this.overheatUntilMs.set(player.id, nowMs + OVERHEAT_DURATION_MS);
        this.overheatPenaltyUntilMs.set(player.id, nowMs + OVERHEAT_DURATION_MS + OVERHEAT_PENALTY_DURATION_MS);
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.x,
          y: player.y,
          radius: player.radius + 16,
          durationMs: OVERHEAT_DURATION_MS,
          ttlMs: OVERHEAT_DURATION_MS + OVERHEAT_PENALTY_DURATION_MS + 550
        }, nowMs);
        break;
      }
      case AbilityId.OrbitalBarrage: {
        this.orbitalByPlayerId.set(player.id, {
          x: player.input.aimX,
          y: player.input.aimY,
          remainingPulses: 3,
          nextPulseAtMs: nowMs + 350
        });
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.input.aimX,
          y: player.input.aimY,
          radius: ORBITAL_RADIUS,
          durationMs: 1_050,
          ttlMs: 1_450
        }, nowMs);
        break;
      }
      case AbilityId.SiegeMode: {
        this.siegeUntilMs.set(player.id, nowMs + SIEGE_DURATION_MS);
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.x,
          y: player.y,
          radius: player.radius + 22,
          durationMs: SIEGE_DURATION_MS,
          ttlMs: SIEGE_DURATION_MS + 420
        }, nowMs);
        break;
      }
      case AbilityId.HomingMissile: {
        const target = this.findNearestEnemy(player.id, player.x, player.y, WORLD_WIDTH + WORLD_HEIGHT, nowMs);
        this.emitAbilityVfxCue({
          abilityId,
          phase: AbilityVfxPhase.Cast,
          casterPlayerId: player.id,
          x: player.x,
          y: player.y,
          rotation: target ? Math.atan2(target.y - player.y, target.x - player.x) : player.rotation,
          radius: target ? Math.hypot(target.x - player.x, target.y - player.y) : 180,
          durationMs: 260,
          ttlMs: 520
        }, nowMs);
        if (target) {
          this.emitAbilityVfxCue({
            abilityId,
            phase: AbilityVfxPhase.Impact,
            casterPlayerId: player.id,
            x: target.x,
            y: target.y,
            radius: HOMING_EXPLOSION_RADIUS,
            durationMs: 320,
            ttlMs: 720
          }, nowMs);
          this.applyAreaDamage(
            player.id,
            target.x,
            target.y,
            HOMING_EXPLOSION_RADIUS,
            player.bulletDamage * HOMING_DAMAGE_FACTOR,
            tick,
            nowMs
          );
        }
        break;
      }
    }
  }

  private cleanupExpiredAbilityStates(playerId: string, nowMs: number): void {
    if ((this.empSlowUntilMs.get(playerId) ?? 0) <= nowMs) {
      this.empSlowUntilMs.delete(playerId);
    }
    const previousShieldUntilMs = this.reactiveShieldUntilMs.get(playerId) ?? 0;
    if (previousShieldUntilMs <= nowMs && previousShieldUntilMs > 0) {
      const owner = this.players.get(playerId);
      if (owner) {
        this.emitAbilityVfxCue({
          abilityId: AbilityId.ReactiveShield,
          phase: AbilityVfxPhase.Expire,
          casterPlayerId: playerId,
          x: owner.x,
          y: owner.y,
          radius: owner.radius + 10,
          ttlMs: 220
        }, nowMs);
      }
      this.reactiveShieldUntilMs.delete(playerId);
    }
    const previousOverheatUntilMs = this.overheatUntilMs.get(playerId) ?? 0;
    if (previousOverheatUntilMs <= nowMs && previousOverheatUntilMs > 0) {
      const owner = this.players.get(playerId);
      if (owner) {
        this.emitAbilityVfxCue({
          abilityId: AbilityId.Overheat,
          phase: AbilityVfxPhase.Expire,
          casterPlayerId: playerId,
          x: owner.x,
          y: owner.y,
          radius: owner.radius + 16,
          durationMs: OVERHEAT_PENALTY_DURATION_MS,
          ttlMs: OVERHEAT_PENALTY_DURATION_MS + 380
        }, nowMs);
      }
      this.overheatUntilMs.delete(playerId);
    }
    if ((this.overheatPenaltyUntilMs.get(playerId) ?? 0) <= nowMs) {
      this.overheatPenaltyUntilMs.delete(playerId);
    }
    const previousSiegeUntilMs = this.siegeUntilMs.get(playerId) ?? 0;
    if (previousSiegeUntilMs <= nowMs && previousSiegeUntilMs > 0) {
      const owner = this.players.get(playerId);
      if (owner) {
        this.emitAbilityVfxCue({
          abilityId: AbilityId.SiegeMode,
          phase: AbilityVfxPhase.Expire,
          casterPlayerId: playerId,
          x: owner.x,
          y: owner.y,
          radius: owner.radius + 22,
          ttlMs: 320
        }, nowMs);
      }
      this.siegeUntilMs.delete(playerId);
    }
    if ((this.repairBoostUntilMs.get(playerId) ?? 0) <= nowMs) {
      this.repairBoostUntilMs.delete(playerId);
    }
  }

  private getMovementMultiplier(playerId: string, nowMs: number): number {
    let multiplier = 1;
    if ((this.empSlowUntilMs.get(playerId) ?? 0) > nowMs) {
      multiplier *= EMP_SLOW_FACTOR;
    }
    if ((this.repairBoostUntilMs.get(playerId) ?? 0) > nowMs) {
      multiplier *= 1.12;
    }
    if ((this.overheatPenaltyUntilMs.get(playerId) ?? 0) > nowMs && (this.overheatUntilMs.get(playerId) ?? 0) <= nowMs) {
      multiplier *= 0.8;
    }
    return multiplier;
  }

  private getReloadMultiplier(playerId: string, nowMs: number): number {
    let multiplier = 1;
    if ((this.overheatUntilMs.get(playerId) ?? 0) > nowMs) {
      multiplier *= 0.75;
    }
    if ((this.siegeUntilMs.get(playerId) ?? 0) > nowMs) {
      multiplier *= SIEGE_RELOAD_FACTOR;
    }
    return multiplier;
  }

  private getBulletDamageMultiplier(playerId: string, nowMs: number): number {
    if ((this.siegeUntilMs.get(playerId) ?? 0) > nowMs) {
      return SIEGE_DAMAGE_FACTOR;
    }
    return 1;
  }

  private findNearestEnemy(
    ownerId: string,
    x: number,
    y: number,
    maxDistance: number,
    nowMs: number
  ): PlayerEntity | null {
    let nearest: PlayerEntity | null = null;
    let nearestDistanceSq = maxDistance * maxDistance;
    for (const candidate of this.players.values()) {
      if (candidate.id === ownerId || candidate.hp <= 0 || this.isPendingRespawn(candidate.id, nowMs)) {
        continue;
      }
      const dx = candidate.x - x;
      const dy = candidate.y - y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= nearestDistanceSq) {
        continue;
      }
      nearest = candidate;
      nearestDistanceSq = distanceSq;
    }
    return nearest;
  }

  private applyAreaDamage(
    ownerId: string,
    x: number,
    y: number,
    radius: number,
    damage: number,
    tick: number,
    nowMs: number
  ): void {
    const radiusSq = radius * radius;
    for (const target of this.players.values()) {
      if (target.id === ownerId || target.hp <= 0 || this.isPendingRespawn(target.id, nowMs)) {
        continue;
      }

      const dx = target.x - x;
      const dy = target.y - y;
      if (dx * dx + dy * dy > radiusSq) {
        continue;
      }

      target.hp = clamp(target.hp - damage, 0, target.maxHp);
      target.updatedAtTick = tick;
      if (target.hp <= 0) {
        this.handleKill(ownerId, target, tick, nowMs);
      }
    }

    for (const shape of this.shapes.values()) {
      const dx = shape.x - x;
      const dy = shape.y - y;
      if (dx * dx + dy * dy > radiusSq) {
        continue;
      }
      shape.hp = clamp(shape.hp - damage, 0, shape.maxHp);
      shape.updatedAtTick = tick;
      if (shape.hp <= 0) {
        const owner = this.players.get(ownerId);
        if (owner) {
          this.awardXp(owner, shape.xpValue, tick);
        }
        this.destroyShape(shape.id);
      }
    }
  }

  private emitAbilityVfxCue(
    cue: Omit<AbilityVfxCue, "id" | "createdAtMs">,
    nowMs: number
  ): void {
    this.pendingAbilityVfxCues.push({
      ...cue,
      id: `avfx:${this.nextAbilityVfxCueSequence}`,
      createdAtMs: nowMs
    });
    this.nextAbilityVfxCueSequence += 1;
  }

  private resolveCollisions(tick: number, nowMs: number): number {
    let collisionsEvaluated = 0;
    this.spatialGrid.clear();
    for (const player of this.players.values()) {
      this.spatialGrid.insert(player.id, player.x, player.y);
    }

    for (const bullet of this.bullets.values()) {
      if (this.roundPhase === MatchPhase.Ended) {
        return collisionsEvaluated;
      }

      if (!bullet.active) {
        continue;
      }

      this.nearbyPlayersBuffer.length = 0;
      this.spatialGrid.queryNearbyInto(bullet.x, bullet.y, this.nearbyPlayersBuffer);

      for (const playerId of this.nearbyPlayersBuffer) {
        if (playerId === bullet.ownerId) {
          continue;
        }

        const target = this.players.get(playerId);
        if (!target) {
          continue;
        }

        if (target.hp <= 0 || this.isPendingRespawn(target.id, nowMs)) {
          continue;
        }

        if (nowMs < target.invulnerableUntilMs) {
          continue;
        }

        if ((this.reactiveShieldUntilMs.get(target.id) ?? 0) > nowMs) {
          this.destroyBullet(bullet.id);
          break;
        }

        collisionsEvaluated += 1;
        const dx = target.x - bullet.x;
        const dy = target.y - bullet.y;
        const combinedRadius = target.radius + bullet.radius;
        if (dx * dx + dy * dy > combinedRadius * combinedRadius) {
          continue;
        }

        target.hp = clamp(target.hp - bullet.damage, 0, target.maxHp);
        target.updatedAtTick = tick;
        this.destroyBullet(bullet.id);

        if (target.hp <= 0) {
          this.handleKill(bullet.ownerId, target, tick, nowMs);
        }
        break;
      }

      if (!bullet.active) {
        continue;
      }

      this.nearbyShapesBuffer.length = 0;
      this.collectNearbyShapes(bullet.x, bullet.y, this.nearbyShapesBuffer);

      for (const shape of this.nearbyShapesBuffer) {
        collisionsEvaluated += 1;
        const dx = shape.x - bullet.x;
        const dy = shape.y - bullet.y;
        const combinedRadius = shape.radius + bullet.radius;
        if (dx * dx + dy * dy > combinedRadius * combinedRadius) {
          continue;
        }

        shape.hp = clamp(shape.hp - bullet.damage, 0, shape.maxHp);
        shape.updatedAtTick = tick;
        this.destroyBullet(bullet.id);

        if (shape.hp <= 0) {
          const owner = this.players.get(bullet.ownerId);
          if (owner) {
            this.awardXp(owner, shape.xpValue, tick);
          }
          this.destroyShape(shape.id);
        }
        break;
      }
    }

    return collisionsEvaluated;
  }

  private handleKill(ownerId: string, target: PlayerEntity, tick: number, nowMs: number): void {
    const owner = this.players.get(ownerId);
    if (owner) {
      const stolenXp = clamp(
        Math.floor(target.totalXpEarned * PVP_STEAL_XP_RATIO),
        PVP_STEAL_XP_MIN,
        PVP_STEAL_XP_MAX
      );
      this.awardXp(owner, stolenXp, tick);
      this.playerKills.set(owner.id, (this.playerKills.get(owner.id) ?? 0) + 1);
    }

    this.playerDeaths.set(target.id, (this.playerDeaths.get(target.id) ?? 0) + 1);
  this.clearPlayerPlacedAbilityStates(target.id, nowMs);
    target.hp = 0;
    target.lastShotAtMs = 0;
    target.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      shoot: false,
      aimX: target.x,
      aimY: target.y,
      sequence: target.input.sequence
    };
    target.updatedAtTick = tick;
    this.pendingRespawns.set(target.id, nowMs + this.matchConfig.respawnDelayMs);

    this.evaluateRoundEnd(tick, nowMs);
    this.touchSession(tick);
  }

  private clearPlayerPlacedAbilityStates(playerId: string, nowMs: number): void {
    const mine = this.proximityMineByPlayerId.get(playerId);
    if (mine) {
      this.emitAbilityVfxCue({
        abilityId: AbilityId.ProximityMine,
        phase: AbilityVfxPhase.Expire,
        casterPlayerId: playerId,
        x: mine.x,
        y: mine.y,
        radius: PROXIMITY_MINE_EXPLOSION_RADIUS,
        durationMs: 220,
        ttlMs: 420
      }, nowMs);
      this.proximityMineByPlayerId.delete(playerId);
    }

    const fog = this.tacticalFogByPlayerId.get(playerId);
    if (fog) {
      this.emitAbilityVfxCue({
        abilityId: AbilityId.TacticalFog,
        phase: AbilityVfxPhase.Expire,
        casterPlayerId: playerId,
        x: fog.x,
        y: fog.y,
        radius: fog.radius,
        durationMs: 260,
        ttlMs: 520
      }, nowMs);
      this.tacticalFogByPlayerId.delete(playerId);
    }
  }

  private applyLevelUps(player: PlayerEntity): void {
    let requiredXp = this.getXpRequired(player.level);
    while (player.xp >= requiredXp) {
      player.xp -= requiredXp;
      player.level += 1;
      player.upgradePoints += 1;
      this.enqueueAbilityChoiceIfNeeded(player);
      requiredXp = this.getXpRequired(player.level);
    }
  }

  private enqueueAbilityChoiceIfNeeded(player: PlayerEntity): void {
    if (player.pendingAbilityChoice) {
      return;
    }

    const unlockOrder: AbilitySlot[] = [
      AbilitySlot.RightClick,
      AbilitySlot.Slot1,
      AbilitySlot.Slot2,
      AbilitySlot.Ultimate
    ];

    for (const slot of unlockOrder) {
      const unlockLevel = ABILITY_UNLOCK_LEVELS[slot];
      if (player.level < unlockLevel || player.abilityLoadout[slot]) {
        continue;
      }

      const pendingChoice: PendingAbilityChoiceNetState = {
        slot,
        unlockLevel,
        options: [...ABILITY_CHOICES_BY_SLOT[slot]]
      };
      player.pendingAbilityChoice = pendingChoice;
      this.abilityOfferEvents.push({
        playerId: player.id,
        payload: pendingChoice
      });
      return;
    }
  }

  private getXpRequired(level: number): number {
    return getXpRequiredForLevel(level);
  }

  private awardXp(player: PlayerEntity, xpGain: number, tick: number): void {
    if (xpGain <= 0) {
      return;
    }

    player.xp += xpGain;
    player.totalXpEarned += xpGain;
    this.applyLevelUps(player);
    player.updatedAtTick = tick;
  }

  private awardPresenceXp(player: PlayerEntity, xpPerSecond: number, dtSeconds: number, tick: number): void {
    if (xpPerSecond <= 0 || dtSeconds <= 0) {
      return;
    }

    const previousCarry = this.playerPresenceXpCarry.get(player.id) ?? 0;
    const scaledGain = xpPerSecond * dtSeconds * ZONE_XP_ACCURACY_SCALE;
    const totalScaled = previousCarry + scaledGain;
    const wholeXp = Math.floor(totalScaled / ZONE_XP_ACCURACY_SCALE);
    this.playerPresenceXpCarry.set(player.id, totalScaled - wholeXp * ZONE_XP_ACCURACY_SCALE);

    if (wholeXp > 0) {
      this.awardXp(player, wholeXp, tick);
    }
  }

  private updateControlZones(dtSeconds: number, tick: number, nowMs: number): void {
    if (this.zones.size < CONTROL_ZONE_MAX_ACTIVE && nowMs - this.lastZoneSpawnAtMs >= CONTROL_ZONE_SPAWN_INTERVAL_MS) {
      if (this.spawnControlZone(tick)) {
        this.lastZoneSpawnAtMs = nowMs;
      }
    }

    const capturedZoneIds: string[] = [];

    for (const zone of this.zones.values()) {
      const contenders: PlayerEntity[] = [];
      for (const player of this.players.values()) {
        if (player.hp <= 0 || this.isPendingRespawn(player.id, nowMs)) {
          continue;
        }

        const dx = player.x - zone.x;
        const dy = player.y - zone.y;
        if (dx * dx + dy * dy <= zone.radius * zone.radius) {
          contenders.push(player);
          this.awardPresenceXp(player, zone.xpPerSecond, dtSeconds, tick);
        }
      }

      const contenderIds = [...new Set(contenders.map((player) => player.id))];
      const previousOwner = zone.ownerPlayerId;
      const previousCapturePlayer = zone.capturingPlayerId;
      const previousProgress = zone.captureProgress;
      const previousContested = zone.contested;

      zone.contested = contenderIds.length > 1;

      if (contenderIds.length === 1) {
        const contenderId = contenderIds[0] ?? null;
        if (!contenderId) {
          continue;
        }

        if (zone.ownerPlayerId === contenderId) {
          zone.capturingPlayerId = null;
          zone.captureProgress = 0;
        } else {
          if (zone.capturingPlayerId !== contenderId) {
            zone.capturingPlayerId = contenderId;
            zone.captureProgress = 0;
          }

          zone.captureProgress = clamp(zone.captureProgress + CONTROL_ZONE_CAPTURE_RATE_PER_SECOND * dtSeconds, 0, 1);
          if (zone.captureProgress >= 1) {
            zone.ownerPlayerId = contenderId;
            zone.capturingPlayerId = null;
            zone.captureProgress = 0;

            const owner = this.players.get(contenderId);
            if (owner) {
              this.awardXp(owner, zone.captureBonusXp, tick);
            }

            capturedZoneIds.push(zone.id);
          }
        }
      } else if (contenderIds.length === 0) {
        zone.contested = false;
      }

      if (
        previousOwner !== zone.ownerPlayerId ||
        previousCapturePlayer !== zone.capturingPlayerId ||
        Math.abs(previousProgress - zone.captureProgress) > 0.0001 ||
        previousContested !== zone.contested
      ) {
        zone.updatedAtTick = tick;
      }
    }

    for (const zoneId of capturedZoneIds) {
      this.destroyZone(zoneId);
    }
  }

  private spawnControlZone(tick: number): boolean {
    const minX = CONTROL_ZONE_SPAWN_MARGIN;
    const maxX = WORLD_WIDTH - CONTROL_ZONE_SPAWN_MARGIN;
    const minY = CONTROL_ZONE_SPAWN_MARGIN;
    const maxY = WORLD_HEIGHT - CONTROL_ZONE_SPAWN_MARGIN;

    for (let attempt = 0; attempt < CONTROL_ZONE_SPAWN_ATTEMPTS; attempt += 1) {
      const x = minX + Math.random() * Math.max(1, maxX - minX);
      const y = minY + Math.random() * Math.max(1, maxY - minY);

      if (this.hasZoneSpawnCollision(x, y, CONTROL_ZONE_BASE_CONFIG.radius)) {
        continue;
      }

      const id = `zone:${this.nextZoneSequence}`;
      this.nextZoneSequence += 1;
      this.zones.set(id, {
        id,
        x,
        y,
        radius: CONTROL_ZONE_BASE_CONFIG.radius,
        ownerPlayerId: null,
        capturingPlayerId: null,
        captureProgress: 0,
        contested: false,
        xpPerSecond: CONTROL_ZONE_BASE_CONFIG.xpPerSecond,
        captureBonusXp: CONTROL_ZONE_BASE_CONFIG.captureBonusXp,
        updatedAtTick: tick
      });
      this.removedZones.delete(id);
      return true;
    }

    const fallbackId = `zone:${this.nextZoneSequence}`;
    this.nextZoneSequence += 1;
    this.zones.set(fallbackId, {
      id: fallbackId,
      x: WORLD_WIDTH * 0.5,
      y: WORLD_HEIGHT * 0.5,
      radius: CONTROL_ZONE_BASE_CONFIG.radius,
      ownerPlayerId: null,
      capturingPlayerId: null,
      captureProgress: 0,
      contested: false,
      xpPerSecond: CONTROL_ZONE_BASE_CONFIG.xpPerSecond,
      captureBonusXp: CONTROL_ZONE_BASE_CONFIG.captureBonusXp,
      updatedAtTick: tick
    });
    this.removedZones.delete(fallbackId);
    return true;
  }

  private hasZoneSpawnCollision(x: number, y: number, radius: number): boolean {
    for (const player of this.players.values()) {
      const dx = player.x - x;
      const dy = player.y - y;
      const minDistance = player.radius + radius + 70;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const shape of this.shapes.values()) {
      const dx = shape.x - x;
      const dy = shape.y - y;
      const minDistance = shape.radius + radius + 40;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const powerUp of this.powerUps.values()) {
      const dx = powerUp.x - x;
      const dy = powerUp.y - y;
      const minDistance = powerUp.radius + radius + 40;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    return false;
  }

  private destroyZone(id: string): void {
    if (!this.zones.delete(id)) {
      return;
    }

    this.removedZones.add(id);
  }

  private updatePowerUps(_dtSeconds: number, tick: number, nowMs: number): void {
    for (const [powerUpId, powerUp] of this.powerUps.entries()) {
      if (nowMs >= powerUp.expiresAtMs) {
        this.destroyPowerUp(powerUpId);
      }
    }

    if (this.powerUps.size < POWER_UP_MAX_ACTIVE && nowMs - this.lastPowerUpSpawnAtMs >= POWER_UP_SPAWN_INTERVAL_MS) {
      if (this.spawnPowerUp(tick, nowMs)) {
        this.lastPowerUpSpawnAtMs = nowMs;
      }
    }

    if (this.powerUps.size === 0) {
      return;
    }

    for (const player of this.players.values()) {
      if (player.hp <= 0 || this.isPendingRespawn(player.id, nowMs)) {
        continue;
      }

      for (const powerUp of this.powerUps.values()) {
        const dx = player.x - powerUp.x;
        const dy = player.y - powerUp.y;
        const combinedRadius = player.radius + powerUp.radius + POWER_UP_PLAYER_COLLISION_EXTRA;
        if (dx * dx + dy * dy > combinedRadius * combinedRadius) {
          continue;
        }

        this.applyPowerUp(player, powerUp.type, nowMs, tick);
        this.destroyPowerUp(powerUp.id);
      }
    }
  }

  private pickPowerUpType(): BuffTypeValue {
    const entries = [
      [BuffType.Damage, POWER_UP_TYPE_WEIGHTS.damage],
      [BuffType.Reload, POWER_UP_TYPE_WEIGHTS.reload],
      [BuffType.Movement, POWER_UP_TYPE_WEIGHTS.movement]
    ] as const;

    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * totalWeight;
    for (const [type, weight] of entries) {
      roll -= weight;
      if (roll <= 0) {
        return type;
      }
    }

    return BuffType.Damage;
  }

  private spawnPowerUp(tick: number, nowMs: number): boolean {
    const minX = SAFE_SPAWN_MARGIN;
    const maxX = WORLD_WIDTH - SAFE_SPAWN_MARGIN;
    const minY = SAFE_SPAWN_MARGIN;
    const maxY = WORLD_HEIGHT - SAFE_SPAWN_MARGIN;

    for (let attempt = 0; attempt < POWER_UP_SPAWN_ATTEMPTS; attempt += 1) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      if (this.hasPowerUpSpawnCollision(x, y, POWER_UP_RADIUS)) {
        continue;
      }

      const id = `powerup:${this.nextPowerUpSequence}`;
      this.nextPowerUpSequence += 1;
      this.powerUps.set(id, {
        id,
        type: this.pickPowerUpType(),
        x,
        y,
        radius: POWER_UP_RADIUS,
        expiresAtMs: nowMs + POWER_UP_TTL_MS,
        updatedAtTick: tick
      });
      this.removedPowerUps.delete(id);
      return true;
    }

    return false;
  }

  private hasPowerUpSpawnCollision(x: number, y: number, radius: number): boolean {
    for (const player of this.players.values()) {
      const dx = player.x - x;
      const dy = player.y - y;
      const minDistance = player.radius + radius + POWER_UP_SPAWN_PLAYER_SAFE_DISTANCE;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const shape of this.shapes.values()) {
      const dx = shape.x - x;
      const dy = shape.y - y;
      const minDistance = shape.radius + radius + POWER_UP_SHAPE_SAFE_DISTANCE;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const existing of this.powerUps.values()) {
      const dx = existing.x - x;
      const dy = existing.y - y;
      const minDistance = existing.radius + radius + 40;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    return false;
  }

  private destroyPowerUp(id: string): void {
    if (!this.powerUps.delete(id)) {
      return;
    }

    this.removedPowerUps.add(id);
  }

  private applyPowerUp(player: PlayerEntity, buffType: BuffTypeValue, nowMs: number, tick: number): void {
    const activeBuff = player.activeBuffs.find((buff) => buff.type === buffType);
    if (activeBuff) {
      activeBuff.stacks = Math.min(BUFF_MAX_STACKS, activeBuff.stacks + 1);
      activeBuff.expiresAtMs = nowMs + POWER_UP_DURATION_MS;
    } else {
      player.activeBuffs.push({
        type: buffType,
        stacks: 1,
        expiresAtMs: nowMs + POWER_UP_DURATION_MS
      });
    }

    this.recalculateDerivedStats(player, false);
    player.updatedAtTick = tick;
  }

  private updateBuffExpirations(tick: number, nowMs: number): void {
    for (const player of this.players.values()) {
      const activeCount = player.activeBuffs.length;
      if (activeCount === 0) {
        continue;
      }

      player.activeBuffs = player.activeBuffs.filter((buff) => buff.expiresAtMs > nowMs);
      if (player.activeBuffs.length !== activeCount) {
        this.recalculateDerivedStats(player, false);
        player.updatedAtTick = tick;
      }
    }
  }

  private ensureShapePopulation(tick: number): void {
    while (this.shapes.size < MAX_ACTIVE_SHAPES) {
      const spawned = this.spawnShape(tick);
      if (!spawned) {
        break;
      }
    }
  }

  private spawnShape(tick: number): boolean {
    const template = this.pickShapeTemplate();
    if (!template) {
      return false;
    }

    const minX = SHAPE_SPAWN_MARGIN + template.radius;
    const maxX = WORLD_WIDTH - SHAPE_SPAWN_MARGIN - template.radius;
    const minY = SHAPE_SPAWN_MARGIN + template.radius;
    const maxY = WORLD_HEIGHT - SHAPE_SPAWN_MARGIN - template.radius;

    for (let attempt = 0; attempt < SHAPE_SPAWN_ATTEMPTS; attempt += 1) {
      const x = minX + Math.random() * Math.max(1, maxX - minX);
      const y = minY + Math.random() * Math.max(1, maxY - minY);

      if (this.hasShapeSpawnCollision(x, y, template.radius)) {
        continue;
      }

      const id = `shape:${this.nextShapeSequence}`;
      this.nextShapeSequence += 1;
      this.shapes.set(id, {
        id,
        kind: template.kind,
        sides: template.sides,
        x,
        y,
        rotation: Math.random() * Math.PI * 2,
        radius: template.radius,
        hp: template.hp,
        maxHp: template.hp,
        xpValue: template.xpValue,
        updatedAtTick: tick
      });
      this.removedShapes.delete(id);
      return true;
    }

    return false;
  }

  private pickShapeTemplate(): ShapeTemplate | null {
    const totalWeight = SHAPE_TEMPLATES.reduce((sum, template) => sum + template.weight, 0);
    if (totalWeight <= 0) {
      return SHAPE_TEMPLATES[0] ?? null;
    }

    let roll = Math.random() * totalWeight;
    for (const template of SHAPE_TEMPLATES) {
      roll -= template.weight;
      if (roll <= 0) {
        return template;
      }
    }

    return SHAPE_TEMPLATES[SHAPE_TEMPLATES.length - 1] ?? null;
  }

  private destroyShape(id: string): void {
    if (!this.shapes.delete(id)) {
      return;
    }
    this.removedShapes.add(id);
  }

  private hasShapeSpawnCollision(x: number, y: number, radius: number): boolean {
    for (const player of this.players.values()) {
      const dx = player.x - x;
      const dy = player.y - y;
      const minDistance = player.radius + radius + SHAPE_PLAYER_SPAWN_GAP;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const shape of this.shapes.values()) {
      const dx = shape.x - x;
      const dy = shape.y - y;
      const minDistance = shape.radius + radius + 12;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    return false;
  }

  private collectNearbyShapes(x: number, y: number, out: ShapeEntity[]): void {
    const maxRadius = 48;
    for (const shape of this.shapes.values()) {
      if (Math.abs(shape.x - x) > shape.radius + maxRadius || Math.abs(shape.y - y) > shape.radius + maxRadius) {
        continue;
      }
      out.push(shape);
    }
  }

  private resolvePlayerShapeOverlaps(player: PlayerEntity): void {
    for (let pass = 0; pass < PLAYER_SHAPE_COLLISION_PASSES; pass += 1) {
      let moved = false;
      for (const shape of this.shapes.values()) {
        const dx = player.x - shape.x;
        const dy = player.y - shape.y;
        const combinedRadius = player.radius + shape.radius;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq >= combinedRadius * combinedRadius) {
          continue;
        }

        const distance = Math.sqrt(Math.max(distanceSq, 0.0001));
        const overlap = combinedRadius - distance;
        player.x += (dx / distance) * overlap;
        player.y += (dy / distance) * overlap;
        player.x = clamp(player.x, player.radius, WORLD_WIDTH - player.radius);
        player.y = clamp(player.y, player.radius, WORLD_HEIGHT - player.radius);
        moved = true;
      }

      if (!moved) {
        break;
      }
    }
  }

  private resetAndRespawnPlayer(player: PlayerEntity, tick: number, nowMs: number): void {
    const spawn = this.findSafeSpawn(player.id);
    player.x = spawn.x;
    player.y = spawn.y;
    player.rotation = 0;
    player.level = 1;
    player.xp = 0;
    player.totalXpEarned = 0;
    player.upgradePoints = 0;
    player.stats = createBaseStats();
    player.abilityLoadout = {};
    player.abilityCooldownEndsAtMs = {};
    player.pendingAbilityChoice = null;
    player.activeBuffs = [];
    this.empSlowUntilMs.delete(player.id);
    this.reactiveShieldUntilMs.delete(player.id);
    this.overheatUntilMs.delete(player.id);
    this.overheatPenaltyUntilMs.delete(player.id);
    this.siegeUntilMs.delete(player.id);
    this.repairBoostUntilMs.delete(player.id);
    this.proximityMineByPlayerId.delete(player.id);
    this.tacticalFogByPlayerId.delete(player.id);
    this.turretByPlayerId.delete(player.id);
    this.orbitalByPlayerId.delete(player.id);
    this.playerPresenceXpCarry.set(player.id, 0);
    this.recalculateDerivedStats(player, false);
    player.hp = player.maxHp;
    player.lastShotAtMs = 0;
    player.invulnerableUntilMs = nowMs + RESPAWN_INVULNERABILITY_MS;
    player.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      shoot: false,
      aimX: player.x,
      aimY: player.y,
      sequence: player.input.sequence
    };
    player.updatedAtTick = tick;
    this.pendingRespawns.delete(player.id);
  }

  private processPendingRespawns(tick: number, nowMs: number): void {
    if (this.pendingRespawns.size === 0) {
      return;
    }

    let changed = false;
    for (const [playerId, respawnAtMs] of this.pendingRespawns.entries()) {
      if (nowMs < respawnAtMs) {
        continue;
      }

      const player = this.players.get(playerId);
      if (!player) {
        this.pendingRespawns.delete(playerId);
        continue;
      }

      this.resetAndRespawnPlayer(player, tick, nowMs);
      changed = true;
    }

    if (changed) {
      this.touchSession(tick);
    }
  }

  private isPendingRespawn(playerId: string, nowMs: number): boolean {
    const respawnAtMs = this.pendingRespawns.get(playerId);
    if (respawnAtMs === undefined) {
      return false;
    }

    return nowMs < respawnAtMs;
  }

  private isRoundEnded(): boolean {
    return this.roundPhase === MatchPhase.Ended;
  }

  private evaluateRoundEnd(tick: number, nowMs: number): void {
    if (this.roundPhase !== MatchPhase.InProgress) {
      return;
    }

    if (this.matchConfig.winCondition === MatchWinCondition.TimeLimit) {
      if (nowMs - this.roundStartedAtMs >= this.matchConfig.timeLimitMs) {
        this.endRound(this.resolveTimeLimitWinnerPlayerId(), tick, nowMs);
      }
      return;
    }

    for (const [playerId, kills] of this.playerKills.entries()) {
      if (kills >= this.matchConfig.objectiveKills) {
        this.endRound(playerId, tick, nowMs);
        return;
      }
    }
  }

  private resolveTimeLimitWinnerPlayerId(): string | null {
    const scoreboard = this.buildScoreboard();
    if (scoreboard.length === 0) {
      return null;
    }

    const leader = scoreboard[0];
    if (!leader) {
      return null;
    }

    const tiedLeaders = scoreboard.filter((entry) => entry.kills === leader.kills);
    if (tiedLeaders.length > 1) {
      return null;
    }

    return leader.playerId;
  }

  private recalculateDerivedStats(player: PlayerEntity, preserveHealthGain: boolean): void {
    const previousMaxHp = player.maxHp;

    const damageBuffStacks = this.getBuffStacks(player, BuffType.Damage);
    const reloadBuffStacks = this.getBuffStacks(player, BuffType.Reload);
    const movementBuffStacks = this.getBuffStacks(player, BuffType.Movement);

    player.moveSpeed =
      BASE_MOVE_SPEED *
      (1 + player.stats.movementSpeed * MOVEMENT_SPEED_PER_LEVEL) *
      (1 + movementBuffStacks * BUFF_MOVEMENT_PER_STACK);
    player.reloadMs =
      BASE_RELOAD_MS /
      (1 + player.stats.reloadSpeed * RELOAD_SPEED_PER_LEVEL) /
      (1 + reloadBuffStacks * BUFF_RELOAD_PER_STACK);
    player.bulletSpeed = BASE_BULLET_SPEED * (1 + player.stats.bulletSpeed * BULLET_SPEED_PER_LEVEL);
    player.bulletDamage =
      BASE_BULLET_DAMAGE *
      (1 + player.stats.bulletDamage * BULLET_DAMAGE_PER_LEVEL) *
      (1 + damageBuffStacks * BUFF_DAMAGE_PER_STACK);
    player.maxHp = BASE_MAX_HEALTH * (1 + player.stats.maxHealth * MAX_HEALTH_PER_LEVEL);

    if (preserveHealthGain) {
      player.hp += player.maxHp - previousMaxHp;
      player.hp = clamp(player.hp, 1, player.maxHp);
      return;
    }

    player.hp = clamp(player.hp, 0, player.maxHp);
  }

  private getBuffStacks(player: PlayerEntity, buffType: BuffTypeValue): number {
    const buff = player.activeBuffs.find((entry) => entry.type === buffType);
    return buff?.stacks ?? 0;
  }

  private findSafeSpawn(excludedPlayerId: string): { x: number; y: number } {
    const minX = SAFE_SPAWN_MARGIN;
    const maxX = WORLD_WIDTH - SAFE_SPAWN_MARGIN;
    const minY = SAFE_SPAWN_MARGIN;
    const maxY = WORLD_HEIGHT - SAFE_SPAWN_MARGIN;

    for (let attempt = 0; attempt < SAFE_SPAWN_ATTEMPTS; attempt += 1) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      if (!this.hasSpawnCollision(excludedPlayerId, x, y)) {
        return { x, y };
      }
    }

    return {
      x: WORLD_WIDTH * 0.5,
      y: WORLD_HEIGHT * 0.5
    };
  }

  private hasSpawnCollision(excludedPlayerId: string, x: number, y: number): boolean {
    for (const other of this.players.values()) {
      if (other.id === excludedPlayerId) {
        continue;
      }

      const dx = other.x - x;
      const dy = other.y - y;
      const minDistance = SAFE_SPAWN_MIN_DISTANCE + other.radius;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const shape of this.shapes.values()) {
      const dx = shape.x - x;
      const dy = shape.y - y;
      const minDistance = shape.radius + PLAYER_RADIUS;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    return false;
  }

  private destroyBullet(id: string): void {
    const bullet = this.bullets.get(id);
    if (!bullet) {
      return;
    }
    this.bullets.delete(id);
    this.removedBullets.add(id);
    this.bulletFactory.recycle(bullet);
  }

  private destroyAllBullets(): void {
    for (const bulletId of this.bullets.keys()) {
      this.destroyBullet(bulletId);
    }
  }

  private destroyAllPowerUps(): void {
    for (const powerUpId of this.powerUps.keys()) {
      this.destroyPowerUp(powerUpId);
    }
  }

  private destroyAllZones(): void {
    for (const zoneId of this.zones.keys()) {
      this.destroyZone(zoneId);
    }
  }

  private endRound(winnerPlayerId: string | null, tick: number, nowMs: number): void {
    if (this.roundPhase === MatchPhase.Ended) {
      return;
    }

    this.roundPhase = MatchPhase.Ended;
    this.roundWinnerPlayerId = winnerPlayerId;
    this.roundEndedAtMs = nowMs;
    const nextRoundStartsAtMs = nowMs + this.matchConfig.roundEndPauseMs;
    this.nextRoundStartsAtMs = nextRoundStartsAtMs;
    this.destroyAllBullets();
    this.destroyAllZones();
    this.destroyAllPowerUps();

    for (const player of this.players.values()) {
      player.input = {
        up: false,
        down: false,
        left: false,
        right: false,
        shoot: false,
        aimX: player.x,
        aimY: player.y,
        sequence: player.input.sequence
      };
      player.updatedAtTick = tick;
    }

    const roundResult: RoundEndedPayload = {
      round: this.round,
      winCondition: this.matchConfig.winCondition,
      objectiveKills: this.matchConfig.objectiveKills,
      timeLimitMs: this.matchConfig.timeLimitMs,
      winnerPlayerId,
      endedAtMs: nowMs,
      nextRoundStartsAtMs,
      scoreboard: this.buildScoreboard()
    };
    this.lastRoundResult = roundResult;

    this.touchSession(tick);
    this.sessionEvents.push({
      type: "round_ended",
      payload: roundResult
    });
  }

  private processRoundResetIfDue(tick: number, nowMs: number): void {
    if (this.roundPhase !== MatchPhase.Ended || !this.nextRoundStartsAtMs || nowMs < this.nextRoundStartsAtMs) {
      return;
    }

    this.round += 1;
    this.roundPhase = MatchPhase.InProgress;
    this.roundStartedAtMs = nowMs;
    this.roundEndedAtMs = null;
    this.roundWinnerPlayerId = null;
    this.nextRoundStartsAtMs = null;
    this.pendingRespawns.clear();
    this.destroyAllBullets();
    this.destroyAllZones();
    this.destroyAllPowerUps();
    this.lastZoneSpawnAtMs = nowMs - CONTROL_ZONE_SPAWN_INTERVAL_MS;
    this.lastPowerUpSpawnAtMs = nowMs;

    for (const player of this.players.values()) {
      this.playerKills.set(player.id, 0);
      this.playerDeaths.set(player.id, 0);
      this.resetAndRespawnPlayer(player, tick, nowMs);
    }

    this.touchSession(tick);
    this.sessionEvents.push({
      type: "round_reset",
      payload: {
        round: this.round,
        winCondition: this.matchConfig.winCondition,
        objectiveKills: this.matchConfig.objectiveKills,
        timeLimitMs: this.matchConfig.timeLimitMs,
        startedAtMs: this.roundStartedAtMs
      }
    });
  }

  private buildRespawnState(): RespawnState[] {
    if (this.pendingRespawns.size === 0) {
      return [];
    }

    const respawns: RespawnState[] = [];
    for (const [playerId, respawnAtMs] of this.pendingRespawns.entries()) {
      const player = this.players.get(playerId);
      if (!player) {
        continue;
      }

      respawns.push({
        playerId,
        respawnAtMs,
        invulnerableUntilMs: null
      });
    }

    return respawns;
  }

  private buildScoreboard(): PlayerScore[] {
    const scoreboard = [...this.players.values()].map((player) => ({
      playerId: player.id,
      name: player.name,
      kills: this.playerKills.get(player.id) ?? 0,
      deaths: this.playerDeaths.get(player.id) ?? 0
    }));

    scoreboard.sort((left, right) => {
      if (right.kills !== left.kills) {
        return right.kills - left.kills;
      }
      if (left.deaths !== right.deaths) {
        return left.deaths - right.deaths;
      }
      return left.name.localeCompare(right.name);
    });

    return scoreboard;
  }

  private touchSession(tick: number): void {
    this.sessionUpdatedAtTick = Math.max(this.sessionUpdatedAtTick, tick);
  }
}


