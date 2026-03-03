import {
  CONTROL_ZONE_BASE_CONFIG,
  CONTROL_ZONE_CAPTURE_RATE_PER_SECOND,
  CONTROL_ZONE_MAX_ACTIVE,
  CONTROL_ZONE_SPAWN_ATTEMPTS,
  CONTROL_ZONE_SPAWN_INTERVAL_MS,
  CONTROL_ZONE_SPAWN_MARGIN,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "@tankes/shared";
import type { ControlZoneEntity, PlayerEntity, PowerUpEntity, ShapeEntity } from "../domain/entities";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

interface ZoneUpdateContext {
  zones: Map<string, ControlZoneEntity>;
  players: Iterable<PlayerEntity>;
  shapes: Iterable<ShapeEntity>;
  powerUps: Iterable<PowerUpEntity>;
  dtSeconds: number;
  tick: number;
  nowMs: number;
  isPendingRespawn: (playerId: string) => boolean;
  awardPresenceXp: (player: PlayerEntity, xpPerSecond: number, dtSeconds: number, tick: number) => void;
  awardXp: (player: PlayerEntity, xpGain: number, tick: number) => void;
  getPlayer: (playerId: string) => PlayerEntity | undefined;
  removeZone: (zoneId: string) => void;
  onZoneAdded: (zoneId: string) => void;
}

export class ZoneSystem {
  private nextZoneSequence = 0;
  private lastZoneSpawnAtMs = -CONTROL_ZONE_SPAWN_INTERVAL_MS;

  update(context: ZoneUpdateContext): void {
    const {
      zones,
      players,
      shapes,
      powerUps,
      dtSeconds,
      tick,
      nowMs,
      isPendingRespawn,
      awardPresenceXp,
      awardXp,
      getPlayer,
      removeZone,
      onZoneAdded
    } = context;

    if (zones.size < CONTROL_ZONE_MAX_ACTIVE && nowMs - this.lastZoneSpawnAtMs >= CONTROL_ZONE_SPAWN_INTERVAL_MS) {
      if (this.spawnControlZone(zones, players, shapes, powerUps, tick, onZoneAdded)) {
        this.lastZoneSpawnAtMs = nowMs;
      }
    }

    const capturedZoneIds: string[] = [];

    for (const zone of zones.values()) {
      const contenders: PlayerEntity[] = [];
      for (const player of players) {
        if (player.hp <= 0 || isPendingRespawn(player.id)) {
          continue;
        }

        const dx = player.x - zone.x;
        const dy = player.y - zone.y;
        if (dx * dx + dy * dy <= zone.radius * zone.radius) {
          contenders.push(player);
          awardPresenceXp(player, zone.xpPerSecond, dtSeconds, tick);
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

            const owner = getPlayer(contenderId);
            if (owner) {
              awardXp(owner, zone.captureBonusXp, tick);
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
      removeZone(zoneId);
    }
  }

  destroyZone(zones: Map<string, ControlZoneEntity>, zoneId: string, onRemoved: (zoneId: string) => void): void {
    if (!zones.delete(zoneId)) {
      return;
    }

    onRemoved(zoneId);
  }

  resetSpawnClock(nowMs: number): void {
    this.lastZoneSpawnAtMs = nowMs - CONTROL_ZONE_SPAWN_INTERVAL_MS;
  }

  private spawnControlZone(
    zones: Map<string, ControlZoneEntity>,
    players: Iterable<PlayerEntity>,
    shapes: Iterable<ShapeEntity>,
    powerUps: Iterable<PowerUpEntity>,
    tick: number,
    onZoneAdded: (zoneId: string) => void
  ): boolean {
    const minX = CONTROL_ZONE_SPAWN_MARGIN;
    const maxX = WORLD_WIDTH - CONTROL_ZONE_SPAWN_MARGIN;
    const minY = CONTROL_ZONE_SPAWN_MARGIN;
    const maxY = WORLD_HEIGHT - CONTROL_ZONE_SPAWN_MARGIN;

    for (let attempt = 0; attempt < CONTROL_ZONE_SPAWN_ATTEMPTS; attempt += 1) {
      const x = minX + Math.random() * Math.max(1, maxX - minX);
      const y = minY + Math.random() * Math.max(1, maxY - minY);

      if (this.hasZoneSpawnCollision(players, shapes, powerUps, x, y, CONTROL_ZONE_BASE_CONFIG.radius)) {
        continue;
      }

      const id = `zone:${this.nextZoneSequence}`;
      this.nextZoneSequence += 1;
      zones.set(id, {
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
      onZoneAdded(id);
      return true;
    }

    const fallbackId = `zone:${this.nextZoneSequence}`;
    this.nextZoneSequence += 1;
    zones.set(fallbackId, {
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
    onZoneAdded(fallbackId);
    return true;
  }

  private hasZoneSpawnCollision(
    players: Iterable<PlayerEntity>,
    shapes: Iterable<ShapeEntity>,
    powerUps: Iterable<PowerUpEntity>,
    x: number,
    y: number,
    radius: number
  ): boolean {
    for (const player of players) {
      const dx = player.x - x;
      const dy = player.y - y;
      const minDistance = player.radius + radius + 70;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const shape of shapes) {
      const dx = shape.x - x;
      const dy = shape.y - y;
      const minDistance = shape.radius + radius + 40;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    for (const powerUp of powerUps) {
      const dx = powerUp.x - x;
      const dy = powerUp.y - y;
      const minDistance = powerUp.radius + radius + 40;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }

    return false;
  }
}
