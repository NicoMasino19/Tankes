import {
  BuffType,
  POWER_UP_MAX_ACTIVE,
  POWER_UP_RADIUS,
  POWER_UP_SPAWN_ATTEMPTS,
  POWER_UP_SPAWN_INTERVAL_MS,
  POWER_UP_SPAWN_PLAYER_SAFE_DISTANCE,
  POWER_UP_TTL_MS,
  POWER_UP_TYPE_WEIGHTS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "@tankes/shared";
import type { PlayerEntity, PowerUpEntity, ShapeEntity } from "../domain/entities";

const SAFE_SPAWN_MARGIN = 96;
const POWER_UP_PLAYER_COLLISION_EXTRA = 4;
const POWER_UP_SHAPE_SAFE_DISTANCE = 36;

type BuffTypeValue = (typeof BuffType)[keyof typeof BuffType];

interface PowerUpUpdateContext {
  powerUps: Map<string, PowerUpEntity>;
  players: Iterable<PlayerEntity>;
  shapes: Iterable<ShapeEntity>;
  tick: number;
  nowMs: number;
  isPendingRespawn: (playerId: string) => boolean;
  applyPowerUp: (player: PlayerEntity, buffType: BuffTypeValue, nowMs: number, tick: number) => void;
  removePowerUp: (powerUpId: string) => void;
  onPowerUpAdded: (powerUpId: string) => void;
}

export class PowerUpSystem {
  private nextPowerUpSequence = 0;
  private lastPowerUpSpawnAtMs = Date.now();

  update(context: PowerUpUpdateContext): void {
    const {
      powerUps,
      players,
      shapes,
      tick,
      nowMs,
      isPendingRespawn,
      applyPowerUp,
      removePowerUp,
      onPowerUpAdded
    } = context;

    for (const [powerUpId, powerUp] of powerUps.entries()) {
      if (nowMs >= powerUp.expiresAtMs) {
        removePowerUp(powerUpId);
      }
    }

    if (powerUps.size < POWER_UP_MAX_ACTIVE && nowMs - this.lastPowerUpSpawnAtMs >= POWER_UP_SPAWN_INTERVAL_MS) {
      if (this.spawnPowerUp(powerUps, players, shapes, tick, nowMs, onPowerUpAdded)) {
        this.lastPowerUpSpawnAtMs = nowMs;
      }
    }

    if (powerUps.size === 0) {
      return;
    }

    for (const player of players) {
      if (player.hp <= 0 || isPendingRespawn(player.id)) {
        continue;
      }

      for (const powerUp of powerUps.values()) {
        const dx = player.x - powerUp.x;
        const dy = player.y - powerUp.y;
        const combinedRadius = player.radius + powerUp.radius + POWER_UP_PLAYER_COLLISION_EXTRA;
        if (dx * dx + dy * dy > combinedRadius * combinedRadius) {
          continue;
        }

        applyPowerUp(player, powerUp.type, nowMs, tick);
        removePowerUp(powerUp.id);
      }
    }
  }

  destroyPowerUp(
    powerUps: Map<string, PowerUpEntity>,
    powerUpId: string,
    onRemoved: (powerUpId: string) => void
  ): void {
    if (!powerUps.delete(powerUpId)) {
      return;
    }

    onRemoved(powerUpId);
  }

  resetSpawnClock(nowMs: number): void {
    this.lastPowerUpSpawnAtMs = nowMs;
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

  private spawnPowerUp(
    powerUps: Map<string, PowerUpEntity>,
    players: Iterable<PlayerEntity>,
    shapes: Iterable<ShapeEntity>,
    tick: number,
    nowMs: number,
    onPowerUpAdded: (powerUpId: string) => void
  ): boolean {
    const minX = SAFE_SPAWN_MARGIN;
    const maxX = WORLD_WIDTH - SAFE_SPAWN_MARGIN;
    const minY = SAFE_SPAWN_MARGIN;
    const maxY = WORLD_HEIGHT - SAFE_SPAWN_MARGIN;

    for (let attempt = 0; attempt < POWER_UP_SPAWN_ATTEMPTS; attempt += 1) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      if (this.hasPowerUpSpawnCollision(powerUps.values(), players, shapes, x, y, POWER_UP_RADIUS)) {
        continue;
      }

      const id = `powerup:${this.nextPowerUpSequence}`;
      this.nextPowerUpSequence += 1;
      powerUps.set(id, {
        id,
        type: this.pickPowerUpType(),
        x,
        y,
        radius: POWER_UP_RADIUS,
        expiresAtMs: nowMs + POWER_UP_TTL_MS,
        updatedAtTick: tick
      });
      onPowerUpAdded(id);
      return true;
    }

    return false;
  }

  private hasPowerUpSpawnCollision(
    powerUps: Iterable<PowerUpEntity>,
    players: Iterable<PlayerEntity>,
    shapes: Iterable<ShapeEntity>,
    x: number,
    y: number,
    radius: number
  ): boolean {
    for (const player of players) {
      const dx = player.x - x;
      const dy = player.y - y;
      const minDistance = player.radius + radius + POWER_UP_SPAWN_PLAYER_SAFE_DISTANCE;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const shape of shapes) {
      const dx = shape.x - x;
      const dy = shape.y - y;
      const minDistance = shape.radius + radius + POWER_UP_SHAPE_SAFE_DISTANCE;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const existing of powerUps) {
      const dx = existing.x - x;
      const dy = existing.y - y;
      const minDistance = existing.radius + radius + 40;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    return false;
  }
}
