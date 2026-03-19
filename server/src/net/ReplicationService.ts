import {
  type AbilityVfxCue,
  type BulletNetState,
  type MatchState,
  type PlayerNetState,
  type PowerUpNetState,
  type ShapeNetState,
  type ZoneNetState,
  SocketEvents,
  type WorldDeltaSnapshot
} from "@tankes/shared";
import type { Server } from "socket.io";
import type { World } from "../game/World";

export interface ReplicationTracker {
  knownPlayers: Map<string, number>;
  knownBullets: Map<string, number>;
  knownShapes: Map<string, number>;
  knownZones: Map<string, number>;
  knownPowerUps: Map<string, number>;
  knownSessionTick: number;
}

interface SessionView {
  joined: boolean;
  playerId: string | null;
}

interface NetworkCodec {
  encodeWorldUpdate(delta: WorldDeltaSnapshot): Uint8Array | Buffer;
}

export interface BroadcastMetrics {
  payloadBytesSent: number;
  payloadMessagesSent: number;
  sessionDeltaBytesSent: number;
  sessionDeltaMessagesSent: number;
}

export class ReplicationService {
  constructor(
    private readonly world: World,
    private readonly io: Server,
    private readonly codec: NetworkCodec,
    private readonly replication: Map<string, ReplicationTracker>,
    private readonly socketSessions: Map<string, SessionView>
  ) {}

  broadcastDeltas(tick: number, nowMs: number, abilityVfxCues: AbilityVfxCue[]): BroadcastMetrics {
    const removedPlayers = this.world.consumeRemovedPlayers();
    const removedBullets = this.world.consumeRemovedBullets();
    const removedShapes = this.world.consumeRemovedShapes();
    const removedZones = this.world.consumeRemovedZones();
    const removedPowerUps = this.world.consumeRemovedPowerUps();
    const sessionState: MatchState = this.world.getMatchState();
    const playerStateFull = new Map<string, PlayerNetState>();
    const playerStateStripped = new Map<string, PlayerNetState>();
    for (const player of this.world.getPlayers()) {
      const full = this.world.toPlayerNetState(player);
      playerStateFull.set(player.id, full);
      const { abilityRuntime: _, ...stripped } = full;
      playerStateStripped.set(player.id, stripped as PlayerNetState);
    }
    const bulletStateCache = new Map<string, BulletNetState>();
    const shapeStateCache = new Map<string, ShapeNetState>();
    const zoneStateCache = new Map<string, ZoneNetState>();
    const powerUpStateCache = new Map<string, PowerUpNetState>();
    let payloadBytesSent = 0;
    let payloadMessagesSent = 0;
    let sessionDeltaBytesSent = 0;
    let sessionDeltaMessagesSent = 0;

    for (const socket of this.io.sockets.sockets.values()) {
      const session = this.socketSessions.get(socket.id);
      if (!session?.joined) {
        continue;
      }

      const tracker = this.replication.get(socket.id);
      if (!tracker) {
        continue;
      }

      const delta: WorldDeltaSnapshot = {
        tick,
        serverTime: nowMs,
        playersUpsert: [],
        playersRemove: [],
        bulletsUpsert: [],
        bulletsRemove: [],
        shapesUpsert: [],
        shapesRemove: [],
        zonesUpsert: [],
        zonesRemove: [],
        powerUpsUpsert: [],
        powerUpsRemove: []
      };

      if (abilityVfxCues.length > 0 && session.playerId) {
        const viewerId = session.playerId;
        delta.abilityVfxCues = abilityVfxCues.map((cue) => this.toViewerVfxCue(cue, viewerId));
      }

      if (tracker.knownSessionTick < sessionState.updatedAtTick) {
        delta.session = sessionState;
        tracker.knownSessionTick = sessionState.updatedAtTick;
      }

      for (const player of this.world.getPlayers()) {
        const knownTick = tracker.knownPlayers.get(player.id) ?? -1;
        if (knownTick < player.updatedAtTick) {
          const state =
            session.playerId === player.id
              ? playerStateFull.get(player.id)
              : playerStateStripped.get(player.id);
          if (state) {
            delta.playersUpsert.push(state);
          }
          tracker.knownPlayers.set(player.id, player.updatedAtTick);
        }
      }

      for (const bullet of this.world.getBullets()) {
        const knownTick = tracker.knownBullets.get(bullet.id) ?? -1;
        if (knownTick < bullet.updatedAtTick) {
          let bulletNetState = bulletStateCache.get(bullet.id);
          if (!bulletNetState) {
            bulletNetState = this.world.toBulletNetState(bullet);
            bulletStateCache.set(bullet.id, bulletNetState);
          }
          delta.bulletsUpsert.push(bulletNetState);
          tracker.knownBullets.set(bullet.id, bullet.updatedAtTick);
        }
      }

      for (const shape of this.world.getShapes()) {
        const knownTick = tracker.knownShapes.get(shape.id) ?? -1;
        if (knownTick < shape.updatedAtTick) {
          let shapeNetState = shapeStateCache.get(shape.id);
          if (!shapeNetState) {
            shapeNetState = this.world.toShapeNetState(shape);
            shapeStateCache.set(shape.id, shapeNetState);
          }
          delta.shapesUpsert.push(shapeNetState);
          tracker.knownShapes.set(shape.id, shape.updatedAtTick);
        }
      }

      for (const zone of this.world.getZones()) {
        const knownTick = tracker.knownZones.get(zone.id) ?? -1;
        if (knownTick < zone.updatedAtTick) {
          let zoneNetState = zoneStateCache.get(zone.id);
          if (!zoneNetState) {
            zoneNetState = this.world.toZoneNetState(zone);
            zoneStateCache.set(zone.id, zoneNetState);
          }
          delta.zonesUpsert.push(zoneNetState);
          tracker.knownZones.set(zone.id, zone.updatedAtTick);
        }
      }

      for (const powerUp of this.world.getPowerUps()) {
        const knownTick = tracker.knownPowerUps.get(powerUp.id) ?? -1;
        if (knownTick < powerUp.updatedAtTick) {
          let powerUpNetState = powerUpStateCache.get(powerUp.id);
          if (!powerUpNetState) {
            powerUpNetState = this.world.toPowerUpNetState(powerUp);
            powerUpStateCache.set(powerUp.id, powerUpNetState);
          }
          delta.powerUpsUpsert.push(powerUpNetState);
          tracker.knownPowerUps.set(powerUp.id, powerUp.updatedAtTick);
        }
      }

      for (const playerId of removedPlayers) {
        if (tracker.knownPlayers.delete(playerId)) {
          delta.playersRemove.push(playerId);
        }
      }

      for (const bulletId of removedBullets) {
        if (tracker.knownBullets.delete(bulletId)) {
          delta.bulletsRemove.push(bulletId);
        }
      }

      for (const shapeId of removedShapes) {
        if (tracker.knownShapes.delete(shapeId)) {
          delta.shapesRemove.push(shapeId);
        }
      }

      for (const zoneId of removedZones) {
        if (tracker.knownZones.delete(zoneId)) {
          delta.zonesRemove.push(zoneId);
        }
      }

      for (const powerUpId of removedPowerUps) {
        if (tracker.knownPowerUps.delete(powerUpId)) {
          delta.powerUpsRemove.push(powerUpId);
        }
      }

      if (
        (delta.abilityVfxCues?.length ?? 0) > 0 ||
        delta.session ||
        delta.playersUpsert.length > 0 ||
        delta.playersRemove.length > 0 ||
        delta.bulletsUpsert.length > 0 ||
        delta.bulletsRemove.length > 0 ||
        delta.shapesUpsert.length > 0 ||
        delta.shapesRemove.length > 0 ||
        delta.zonesUpsert.length > 0 ||
        delta.zonesRemove.length > 0 ||
        delta.powerUpsUpsert.length > 0 ||
        delta.powerUpsRemove.length > 0
      ) {
        const payload = this.codec.encodeWorldUpdate(delta);
        payloadBytesSent += payload.byteLength;
        payloadMessagesSent += 1;
        if (delta.session) {
          sessionDeltaBytesSent += payload.byteLength;
          sessionDeltaMessagesSent += 1;
        }
        socket.emit(SocketEvents.WorldUpdate, payload);
      }
    }

    return {
      payloadBytesSent,
      payloadMessagesSent,
      sessionDeltaBytesSent,
      sessionDeltaMessagesSent
    };
  }

  private toViewerVfxCue(cue: AbilityVfxCue, viewerPlayerId: string): AbilityVfxCue {
    if (cue.casterPlayerId === viewerPlayerId) {
      return cue;
    }

    const quantize = (value: number, step: number): number => Math.round(value / step) * step;
    const radius = typeof cue.radius === "number" ? quantize(cue.radius, 18) : undefined;
    const durationMs = typeof cue.durationMs === "number" ? quantize(cue.durationMs, 120) : undefined;

    return {
      ...cue,
      x: quantize(cue.x, 16),
      y: quantize(cue.y, 16),
      ...(typeof radius === "number" ? { radius } : {}),
      ...(typeof durationMs === "number" ? { durationMs } : {})
    };
  }
}
