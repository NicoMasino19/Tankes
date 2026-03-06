import {
  type AbilityVfxCue,
  type BulletNetState,
  type MatchState,
  type PlayerNetState,
  type PowerUpNetState,
  type ShapeNetState,
  type ZoneNetState,
  type WorldDeltaSnapshot
} from "@tankes/shared";

export interface WorldState {
  tick: number;
  serverTime: number;
  abilityVfxCues: AbilityVfxCue[];
  session: MatchState | null;
  players: Map<string, PlayerNetState>;
  bullets: Map<string, BulletNetState>;
  shapes: Map<string, ShapeNetState>;
  zones: Map<string, ZoneNetState>;
  powerUps: Map<string, PowerUpNetState>;
}

const cloneSession = (session: MatchState | null): MatchState | null => {
  if (!session) {
    return null;
  }

  return {
    ...session,
    scoreboard: session.scoreboard.map((entry) => ({ ...entry })),
    ...(session.config ? { config: { ...session.config } } : {}),
    ...(session.lastRoundResult
      ? {
          lastRoundResult: {
            ...session.lastRoundResult,
            scoreboard: session.lastRoundResult.scoreboard.map((entry) => ({ ...entry }))
          }
        }
      : {}),
    ...(session.respawns ? { respawns: session.respawns.map((entry) => ({ ...entry })) } : {})
  };
};

const cloneMap = <T>(value: Map<string, T>): Map<string, T> =>
  new Map(Array.from(value.entries(), ([key, entry]) => [key, { ...entry }]));

export class ClientWorld {
  private readonly players = new Map<string, PlayerNetState>();
  private readonly bullets = new Map<string, BulletNetState>();
  private readonly shapes = new Map<string, ShapeNetState>();
  private readonly zones = new Map<string, ZoneNetState>();
  private readonly powerUps = new Map<string, PowerUpNetState>();
  private lastAbilityVfxCues: AbilityVfxCue[] = [];
  private session: MatchState | null = null;
  private tick = 0;
  private serverTime = 0;

  applyDelta(delta: WorldDeltaSnapshot): WorldState {
    this.tick = delta.tick;
    this.serverTime = delta.serverTime;
    this.lastAbilityVfxCues = delta.abilityVfxCues ? [...delta.abilityVfxCues] : [];
    if (delta.session) {
      this.session = delta.session;
    }

    for (const player of delta.playersUpsert) {
      this.players.set(player.id, player);
    }
    for (const playerId of delta.playersRemove) {
      this.players.delete(playerId);
    }

    for (const bullet of delta.bulletsUpsert) {
      this.bullets.set(bullet.id, bullet);
    }
    for (const bulletId of delta.bulletsRemove) {
      this.bullets.delete(bulletId);
    }

    for (const shape of delta.shapesUpsert) {
      this.shapes.set(shape.id, shape);
    }
    for (const shapeId of delta.shapesRemove) {
      this.shapes.delete(shapeId);
    }

    for (const zone of delta.zonesUpsert) {
      this.zones.set(zone.id, zone);
    }
    for (const zoneId of delta.zonesRemove) {
      this.zones.delete(zoneId);
    }

    for (const powerUp of delta.powerUpsUpsert) {
      this.powerUps.set(powerUp.id, powerUp);
    }
    for (const powerUpId of delta.powerUpsRemove) {
      this.powerUps.delete(powerUpId);
    }

    return this.getSnapshot();
  }

  getSnapshot(): WorldState {
    return {
      tick: this.tick,
      serverTime: this.serverTime,
      abilityVfxCues: [...this.lastAbilityVfxCues],
      session: cloneSession(this.session),
      players: cloneMap(this.players),
      bullets: cloneMap(this.bullets),
      shapes: cloneMap(this.shapes),
      zones: cloneMap(this.zones),
      powerUps: cloneMap(this.powerUps)
    };
  }
}
