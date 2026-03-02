import {
  INTERPOLATION_DELAY_MS,
  type BulletNetState,
  type MatchState,
  type PlayerNetState,
  type PowerUpNetState,
  type ShapeNetState,
  type ZoneNetState,
} from "@tankes/shared";
import type { WorldState } from "../state/ClientWorld";

interface BufferedState {
  serverTime: number;
  state: WorldState;
}

export interface InterpolatedWorld {
  tick: number;
  serverTime: number;
  session: MatchState | null;
  players: PlayerNetState[];
  bullets: BulletNetState[];
  shapes: ShapeNetState[];
  zones: ZoneNetState[];
  powerUps: PowerUpNetState[];
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const normalizeAngle = (angle: number): number => {
  let normalized = angle;
  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  return normalized;
};

const lerpAngle = (a: number, b: number, t: number): number => {
  const delta = normalizeAngle(b - a);
  return normalizeAngle(a + delta * t);
};

export class InterpolationBuffer {
  private readonly history: BufferedState[] = [];
  private serverOffsetMs = 0;

  push(state: WorldState): void {
    if (this.serverOffsetMs === 0) {
      this.serverOffsetMs = Date.now() - state.serverTime;
    } else {
      const sample = Date.now() - state.serverTime;
      this.serverOffsetMs = this.serverOffsetMs * 0.9 + sample * 0.1;
    }

    this.history.push({ serverTime: state.serverTime, state });
    if (this.history.length > 60) {
      this.history.shift();
    }
  }

  getInterpolated(): InterpolatedWorld {
    const firstEntry = this.history[0];
    if (!firstEntry) {
      return { tick: 0, serverTime: 0, session: null, players: [], bullets: [], shapes: [], zones: [], powerUps: [] };
    }

    if (this.history.length === 1) {
      const only = firstEntry.state;
      return {
        tick: only.tick,
        serverTime: only.serverTime,
        session: only.session,
        players: Array.from(only.players.values()),
        bullets: Array.from(only.bullets.values()),
        shapes: Array.from(only.shapes.values()),
        zones: Array.from(only.zones.values()),
        powerUps: Array.from(only.powerUps.values())
      };
    }

    const renderServerTime = Date.now() - this.serverOffsetMs - INTERPOLATION_DELAY_MS;
    let older = firstEntry;
    let newer = this.history[this.history.length - 1] ?? firstEntry;

    for (let index = 0; index < this.history.length - 1; index += 1) {
      const current = this.history[index];
      const next = this.history[index + 1];
      if (!current || !next) {
        continue;
      }
      if (current.serverTime <= renderServerTime && next.serverTime >= renderServerTime) {
        older = current;
        newer = next;
        break;
      }
    }

    const span = Math.max(1, newer.serverTime - older.serverTime);
    const alpha = Math.min(1, Math.max(0, (renderServerTime - older.serverTime) / span));

    const players: PlayerNetState[] = [];
    for (const [id, newPlayer] of newer.state.players) {
      const oldPlayer = older.state.players.get(id);
      if (!oldPlayer) {
        players.push(newPlayer);
        continue;
      }
      players.push({
        ...newPlayer,
        x: lerp(oldPlayer.x, newPlayer.x, alpha),
        y: lerp(oldPlayer.y, newPlayer.y, alpha),
        rotation: lerpAngle(oldPlayer.rotation, newPlayer.rotation, alpha)
      });
    }

    const bullets: BulletNetState[] = [];
    for (const [id, newBullet] of newer.state.bullets) {
      const oldBullet = older.state.bullets.get(id);
      if (!oldBullet) {
        bullets.push(newBullet);
        continue;
      }
      bullets.push({
        ...newBullet,
        x: lerp(oldBullet.x, newBullet.x, alpha),
        y: lerp(oldBullet.y, newBullet.y, alpha)
      });
    }

    const shapes: ShapeNetState[] = [];
    for (const [id, newShape] of newer.state.shapes) {
      const oldShape = older.state.shapes.get(id);
      if (!oldShape) {
        shapes.push(newShape);
        continue;
      }
      shapes.push({
        ...newShape,
        x: lerp(oldShape.x, newShape.x, alpha),
        y: lerp(oldShape.y, newShape.y, alpha),
        rotation: lerpAngle(oldShape.rotation, newShape.rotation, alpha)
      });
    }

    const zones: ZoneNetState[] = Array.from(newer.state.zones.values());
    const powerUps: PowerUpNetState[] = Array.from(newer.state.powerUps.values());

    return {
      tick: newer.state.tick,
      serverTime: renderServerTime,
      session: newer.state.session,
      players,
      bullets,
      shapes,
      zones,
      powerUps
    };
  }
}
