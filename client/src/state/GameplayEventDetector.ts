import type { BulletNetState, PlayerNetState, ZoneNetState } from "@tankes/shared";
import type { WorldState } from "./ClientWorld";

export const GameplayEventType = {
  Shot: "shot",
  Damage: "damage",
  Death: "death",
  Respawn: "respawn",
  Kill: "kill",
  ZoneCapturing: "zone_capturing",
  ZoneContested: "zone_contested",
  ZoneCaptured: "zone_captured"
} as const;

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

const clonePlayers = (players: Map<string, PlayerNetState>): Map<string, PlayerNetState> =>
  new Map(Array.from(players.entries(), ([id, player]) => [id, { ...player, stats: { ...player.stats } }]));

const cloneBullets = (bullets: Map<string, BulletNetState>): Map<string, BulletNetState> =>
  new Map(Array.from(bullets.entries(), ([id, bullet]) => [id, { ...bullet }]));

const cloneZones = (zones: Map<string, ZoneNetState>): Map<string, ZoneNetState> =>
  new Map(Array.from(zones.entries(), ([id, zone]) => [id, { ...zone }]));

export class GameplayEventDetector {
  private previousPlayers = new Map<string, PlayerNetState>();
  private previousBullets = new Map<string, BulletNetState>();
  private previousZones = new Map<string, ZoneNetState>();
  private initialized = false;

  consume(next: WorldState): GameplayEvent[] {
    if (!this.initialized) {
      this.previousPlayers = clonePlayers(next.players);
      this.previousBullets = cloneBullets(next.bullets);
      this.previousZones = cloneZones(next.zones);
      this.initialized = true;
      return [];
    }

    const events: GameplayEvent[] = [];

    for (const [bulletId, bullet] of next.bullets) {
      if (!this.previousBullets.has(bulletId)) {
        const owner = next.players.get(bullet.ownerId);
        events.push({
          type: GameplayEventType.Shot,
          playerId: bullet.ownerId,
          x: bullet.x,
          y: bullet.y,
          ...(owner ? { rotation: owner.rotation } : {})
        });
      }
    }

    const deathsThisTick: Array<{ id: string; x: number; y: number }> = [];

    for (const [playerId, player] of next.players) {
      const previous = this.previousPlayers.get(playerId);
      if (!previous) {
        continue;
      }

      if (player.hp < previous.hp) {
        events.push({
          type: GameplayEventType.Damage,
          playerId,
          amount: previous.hp - player.hp,
          x: player.x,
          y: player.y
        });
      }

      const diedByHealth = previous.hp > 0 && player.hp <= 0;
      const diedByCounter = player.deaths > previous.deaths;
      if (diedByHealth || diedByCounter) {
        events.push({
          type: GameplayEventType.Death,
          playerId,
          x: player.x,
          y: player.y
        });
        deathsThisTick.push({ id: playerId, x: player.x, y: player.y });
      }

      if (previous.hp <= 0 && player.hp > 0) {
        events.push({
          type: GameplayEventType.Respawn,
          playerId,
          x: player.x,
          y: player.y
        });
      }

      if (player.kills > previous.kills) {
        const gained = player.kills - previous.kills;
        for (let count = 0; count < gained; count += 1) {
          const targetId = deathsThisTick[count]?.id;
          events.push({
            type: GameplayEventType.Kill,
            playerId,
            ...(targetId ? { targetId } : {}),
            x: player.x,
            y: player.y
          });
        }
      }
    }

    if (deathsThisTick.length > 0) {
      for (const event of events) {
        if (event.type !== GameplayEventType.Kill || event.targetId) {
          continue;
        }
        const firstDeath = deathsThisTick[0];
        if (!firstDeath) {
          continue;
        }
        event.targetId = firstDeath.id;
        if (event.x === undefined) {
          event.x = firstDeath.x;
        }
        if (event.y === undefined) {
          event.y = firstDeath.y;
        }
      }
    }

    for (const [zoneId, zone] of next.zones) {
      const previousZone = this.previousZones.get(zoneId);
      if (!previousZone) {
        if (zone.capturingPlayerId && !zone.contested) {
          events.push({
            type: GameplayEventType.ZoneCapturing,
            zoneId,
            playerId: zone.capturingPlayerId
          });
        }
        continue;
      }

      if (!previousZone.contested && zone.contested) {
        events.push({
          type: GameplayEventType.ZoneContested,
          zoneId
        });
      }

      const capturingChanged = previousZone.capturingPlayerId !== zone.capturingPlayerId;
      if (capturingChanged && zone.capturingPlayerId) {
        events.push({
          type: GameplayEventType.ZoneCapturing,
          zoneId,
          playerId: zone.capturingPlayerId,
          amount: zone.captureProgress
        });
        continue;
      }

      const captureProgressDelta = zone.captureProgress - previousZone.captureProgress;
      if (
        !zone.contested &&
        zone.capturingPlayerId &&
        zone.capturingPlayerId === previousZone.capturingPlayerId &&
        captureProgressDelta > 0
      ) {
        events.push({
          type: GameplayEventType.ZoneCapturing,
          zoneId,
          playerId: zone.capturingPlayerId,
          amount: zone.captureProgress
        });
      }
    }

    for (const [zoneId, previousZone] of this.previousZones) {
      if (next.zones.has(zoneId)) {
        continue;
      }

      if (previousZone.capturingPlayerId) {
        events.push({
          type: GameplayEventType.ZoneCaptured,
          zoneId,
          playerId: previousZone.capturingPlayerId
        });
      }
    }

    this.previousPlayers = clonePlayers(next.players);
    this.previousBullets = cloneBullets(next.bullets);
    this.previousZones = cloneZones(next.zones);

    return events;
  }
}
