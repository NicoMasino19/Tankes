import { createServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  type BulletNetState,
  createNetworkCodec,
  FIXED_DELTA_SECONDS,
  type MatchConfig,
  MatchWinCondition,
  type MatchState,
  NetworkCodecMode,
  type PlayerNetState,
  type PowerUpNetState,
  type RoundEndedPayload,
  type RoundResetPayload,
  type ShapeNetState,
  type ZoneNetState,
  SERVER_TICK_RATE,
  SNAPSHOT_RATE,
  STAT_KEYS,
  SocketEvents,
  type InputState,
  type JoinPayload,
  type StatKey,
  type UpgradeStatPayload,
  type WorldDeltaSnapshot
} from "@tankes/shared";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import { World } from "../game/World";

interface ReplicationTracker {
  knownPlayers: Map<string, number>;
  knownBullets: Map<string, number>;
  knownShapes: Map<string, number>;
  knownZones: Map<string, number>;
  knownPowerUps: Map<string, number>;
  knownSessionTick: number;
}

interface EventRatePolicy {
  windowMs: number;
  maxEvents: number;
}

interface EventRateState {
  windowStartMs: number;
  eventsInWindow: number;
  violations: number;
}

interface SocketSessionState {
  joined: boolean;
  playerId: string | null;
  nickname: string | null;
  lastUpgradeAtMs: number;
  lastInputSequence: number;
}

interface ActivePlayerSession {
  socketId: string;
  playerId: string;
  nickname: string;
  resumeToken: string;
}

interface PendingReconnectSession {
  playerId: string;
  nickname: string;
  resumeToken: string;
  expiresAtMs: number;
  cleanupTimer: NodeJS.Timeout;
}

interface JoinRequest {
  nickname: string;
  resumeToken?: string;
}

const tickIntervalMs = 1000 / SERVER_TICK_RATE;
const snapshotEveryTicks = Math.max(1, Math.floor(SERVER_TICK_RATE / SNAPSHOT_RATE));

const parsePositiveIntFromEnv = (envKey: string, fallback: number): number => {
  const raw = process.env[envKey];
  if (typeof raw !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parseMatchWinConditionFromEnv = (
  envKey: string,
  fallback: (typeof MatchWinCondition)[keyof typeof MatchWinCondition]
): (typeof MatchWinCondition)[keyof typeof MatchWinCondition] => {
  const raw = process.env[envKey];
  if (raw === MatchWinCondition.FirstToKills || raw === MatchWinCondition.TimeLimit) {
    return raw;
  }

  return fallback;
};

const networkCodecMode =
  process.env.NET_CODEC === NetworkCodecMode.Json ? NetworkCodecMode.Json : NetworkCodecMode.MsgPack;

const RATE_LIMIT_JOIN_WINDOW_MS = parsePositiveIntFromEnv("RATE_LIMIT_JOIN_WINDOW_MS", 10_000);
const RATE_LIMIT_JOIN_MAX_EVENTS = parsePositiveIntFromEnv("RATE_LIMIT_JOIN_MAX_EVENTS", 3);
const RATE_LIMIT_INPUT_WINDOW_MS = parsePositiveIntFromEnv("RATE_LIMIT_INPUT_WINDOW_MS", 1_000);
const RATE_LIMIT_INPUT_MAX_EVENTS = parsePositiveIntFromEnv("RATE_LIMIT_INPUT_MAX_EVENTS", 120);
const RATE_LIMIT_UPGRADE_WINDOW_MS = parsePositiveIntFromEnv("RATE_LIMIT_UPGRADE_WINDOW_MS", 2_000);
const RATE_LIMIT_UPGRADE_MAX_EVENTS = parsePositiveIntFromEnv("RATE_LIMIT_UPGRADE_MAX_EVENTS", 12);

const EVENT_RATE_POLICIES: Record<string, EventRatePolicy> = {
  [SocketEvents.Join]: {
    windowMs: RATE_LIMIT_JOIN_WINDOW_MS,
    maxEvents: RATE_LIMIT_JOIN_MAX_EVENTS
  },
  [SocketEvents.Input]: {
    windowMs: RATE_LIMIT_INPUT_WINDOW_MS,
    maxEvents: RATE_LIMIT_INPUT_MAX_EVENTS
  },
  [SocketEvents.UpgradeStat]: {
    windowMs: RATE_LIMIT_UPGRADE_WINDOW_MS,
    maxEvents: RATE_LIMIT_UPGRADE_MAX_EVENTS
  }
};

const MAX_RATE_VIOLATIONS_BEFORE_DISCONNECT = parsePositiveIntFromEnv(
  "RATE_LIMIT_MAX_VIOLATIONS_BEFORE_DISCONNECT",
  25
);
const RECONNECT_GRACE_MS = parsePositiveIntFromEnv("RECONNECT_GRACE_MS", 7_000);
const MIN_UPGRADE_INTERVAL_MS = parsePositiveIntFromEnv("UPGRADE_MIN_INTERVAL_MS", 120);
const METRICS_REPORT_INTERVAL_MS = 10_000;
const MAX_INPUT_SEQUENCE = 2_147_483_647;
const NICKNAME_ALLOWED = /[^A-Za-z0-9 _-]/g;
const MATCH_OBJECTIVE_KILLS = parsePositiveIntFromEnv("MATCH_OBJECTIVE_KILLS", 14);
const MATCH_TIME_LIMIT_MS = parsePositiveIntFromEnv("MATCH_TIME_LIMIT_MS", 240_000);
const MATCH_ROUND_END_PAUSE_MS = parsePositiveIntFromEnv("MATCH_ROUND_END_PAUSE_MS", 5_000);
const MATCH_RESPAWN_DELAY_MS = parsePositiveIntFromEnv("MATCH_RESPAWN_DELAY_MS", 2_200);
const MATCH_WIN_CONDITION = parseMatchWinConditionFromEnv(
  "MATCH_WIN_CONDITION",
  MatchWinCondition.TimeLimit
);

const SERVER_MATCH_CONFIG: MatchConfig = {
  winCondition: MATCH_WIN_CONDITION,
  objectiveKills: MATCH_OBJECTIVE_KILLS,
  timeLimitMs: MATCH_TIME_LIMIT_MS,
  roundEndPauseMs: MATCH_ROUND_END_PAUSE_MS,
  respawnDelayMs: MATCH_RESPAWN_DELAY_MS
};

const neutralInput: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
  aimX: 0,
  aimY: 0,
  sequence: 0
};

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const calculateP95 = (samples: number[]): number => {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(0.95 * (sorted.length - 1)));
  return sorted[index] ?? 0;
};

const sanitizeNickname = (nickname: unknown): string => {
  if (typeof nickname !== "string") {
    return "Tanker";
  }

  const cleaned = nickname.replace(NICKNAME_ALLOWED, "").trim().slice(0, 16);
  return cleaned || "Tanker";
};

const sanitizeJoinPayload = (payload: unknown): JoinRequest => {
  const base = payload && typeof payload === "object" ? (payload as Partial<JoinPayload>) : {};
  const nickname = sanitizeNickname(base.nickname);

  if (typeof base.resumeToken !== "string") {
    return { nickname };
  }

  const token = base.resumeToken.trim();
  if (!token || token.length > 128) {
    return { nickname };
  }

  return {
    nickname,
    resumeToken: token
  };
};

const sanitizeInputState = (payload: unknown): InputState | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const input = payload as Partial<InputState>;
  if (
    !isBoolean(input.up) ||
    !isBoolean(input.down) ||
    !isBoolean(input.left) ||
    !isBoolean(input.right) ||
    !isBoolean(input.shoot) ||
    !isFiniteNumber(input.aimX) ||
    !isFiniteNumber(input.aimY) ||
    !isFiniteNumber(input.sequence)
  ) {
    return null;
  }

  return {
    up: input.up,
    down: input.down,
    left: input.left,
    right: input.right,
    shoot: input.shoot,
    aimX: clamp(input.aimX, -100_000, 100_000),
    aimY: clamp(input.aimY, -100_000, 100_000),
    sequence: clamp(Math.trunc(input.sequence), 0, MAX_INPUT_SEQUENCE)
  };
};

const sanitizeUpgradePayload = (payload: unknown): UpgradeStatPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const statCandidate = (payload as Partial<UpgradeStatPayload>).stat;
  if (typeof statCandidate !== "string") {
    return null;
  }

  if (!STAT_KEYS.includes(statCandidate as StatKey)) {
    return null;
  }

  return { stat: statCandidate as StatKey };
};

export class SocketGateway {
  private readonly httpServer: HttpServer;
  private readonly world = new World({
    matchConfig: SERVER_MATCH_CONFIG
  });
  private readonly codec = createNetworkCodec(networkCodecMode);
  private readonly replication = new Map<string, ReplicationTracker>();
  private readonly socketSessions = new Map<string, SocketSessionState>();
  private readonly activePlayerSessions = new Map<string, ActivePlayerSession>();
  private readonly pendingReconnectByToken = new Map<string, PendingReconnectSession>();
  private readonly io: Server;
  private tick = 0;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readonly metrics = {
    acceptedInputs: 0,
    acceptedUpgrades: 0,
    rejectedEvents: 0,
    rateLimitedEvents: 0,
    invalidPayloadEvents: 0,
    staleSequenceEvents: 0,
    upgradeSpamEvents: 0,
    disconnectsByRateLimit: 0,
    tickDurationSamplesMs: [] as number[],
    tickDurationSumMs: 0,
    payloadBytesSent: 0,
    payloadMessagesSent: 0,
    sessionDeltaBytesSent: 0,
    sessionDeltaMessagesSent: 0,
    activePlayersSamples: 0,
    activePlayersSum: 0,
    activeBulletsSamples: 0,
    activeBulletsSum: 0,
    collisionsEvaluatedSamples: [] as number[],
    collisionsEvaluatedSum: 0,
    lastReportAtMs: Date.now(),
    rejectedByReason: new Map<string, number>()
  };

  constructor(private readonly port: number) {
    this.httpServer = createServer();
    this.io = new Server(this.httpServer, {
      cors: {
        origin: "*"
      }
    });

    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });

    this.httpServer.on("error", (error: NodeJS.ErrnoException) => {
      process.stderr.write(
        `[server] listen error on port ${this.port}: ${error.code ?? "UNKNOWN"} ${error.message}\n`
      );
    });

    this.httpServer.listen(
      {
        port: this.port,
        host: "::",
        ipv6Only: false
      },
      () => {
        process.stdout.write(`Tankes server listening on :${this.port}\n`);
      }
    );
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }

    this.stopped = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await new Promise<void>((resolve, reject) => {
      this.io.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    if (!this.httpServer.listening) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.runTick();
    }, tickIntervalMs);
  }

  private handleConnection(socket: Socket): void {
    this.socketSessions.set(socket.id, {
      joined: false,
      playerId: null,
      nickname: null,
      lastUpgradeAtMs: 0,
      lastInputSequence: -1
    });

    const rateStateByEvent = new Map<string, EventRateState>();
    const allowEvent = (eventName: string): boolean => {
      const policy = EVENT_RATE_POLICIES[eventName];
      if (!policy) {
        return true;
      }

      const nowMs = Date.now();
      const currentState = rateStateByEvent.get(eventName);
      if (!currentState) {
        rateStateByEvent.set(eventName, {
          windowStartMs: nowMs,
          eventsInWindow: 1,
          violations: 0
        });
        return true;
      }

      const elapsed = nowMs - currentState.windowStartMs;
      if (elapsed >= policy.windowMs) {
        currentState.windowStartMs = nowMs;
        currentState.eventsInWindow = 1;
        currentState.violations = 0;
        return true;
      }

      currentState.eventsInWindow += 1;
      if (currentState.eventsInWindow <= policy.maxEvents) {
        return true;
      }

      currentState.violations += 1;
      if (currentState.violations >= MAX_RATE_VIOLATIONS_BEFORE_DISCONNECT) {
        this.metrics.disconnectsByRateLimit += 1;
        socket.disconnect(true);
      }

      return false;
    };

    this.replication.set(socket.id, {
      knownPlayers: new Map(),
      knownBullets: new Map(),
      knownShapes: new Map(),
      knownZones: new Map(),
      knownPowerUps: new Map(),
      knownSessionTick: -1
    });

    socket.on(SocketEvents.Join, (payload: unknown) => {
      if (!allowEvent(SocketEvents.Join)) {
        this.logRejected(socket.id, SocketEvents.Join, "rate_limited");
        return;
      }

      const session = this.socketSessions.get(socket.id);
      if (!session) {
        return;
      }
      if (session.joined) {
        this.logRejected(socket.id, SocketEvents.Join, "already_joined");
        return;
      }

      const joinRequest = sanitizeJoinPayload(payload);
      const resumed = this.tryResume(joinRequest, socket.id);

      let playerId: string;
      let resumeToken: string;
      let nickname: string;

      if (resumed) {
        playerId = resumed.playerId;
        resumeToken = resumed.resumeToken;
        nickname = resumed.nickname;
      } else {
        playerId = randomUUID();
        resumeToken = randomUUID();
        nickname = joinRequest.nickname;
        this.world.addPlayer(playerId, nickname, this.tick);
        this.activePlayerSessions.set(playerId, {
          socketId: socket.id,
          playerId,
          nickname,
          resumeToken
        });
      }

      session.joined = true;
      session.playerId = playerId;
      session.nickname = nickname;
      session.lastInputSequence = -1;

      const tracker = this.replication.get(socket.id);
      if (tracker) {
        tracker.knownPlayers.clear();
        tracker.knownBullets.clear();
        tracker.knownShapes.clear();
        tracker.knownZones.clear();
        tracker.knownPowerUps.clear();
        tracker.knownSessionTick = -1;
      }

      this.world.setInput(playerId, neutralInput);
      socket.emit(SocketEvents.JoinAck, {
        playerId,
        serverTime: Date.now(),
        resumeToken
      });
    });

    socket.on(SocketEvents.Input, (payload: unknown) => {
      if (!allowEvent(SocketEvents.Input)) {
        this.logRejected(socket.id, SocketEvents.Input, "rate_limited");
        return;
      }

      const session = this.socketSessions.get(socket.id);
      if (!session || !session.joined || !session.playerId) {
        this.logRejected(socket.id, SocketEvents.Input, "before_join");
        return;
      }

      const input = sanitizeInputState(payload);
      if (!input) {
        this.logRejected(socket.id, SocketEvents.Input, "invalid_payload");
        return;
      }

      if (input.sequence < session.lastInputSequence) {
        this.logRejected(socket.id, SocketEvents.Input, "stale_sequence");
        return;
      }

      session.lastInputSequence = input.sequence;
      this.world.setInput(session.playerId, input);

      this.metrics.acceptedInputs += 1;
    });

    socket.on(SocketEvents.UpgradeStat, (payload: unknown) => {
      if (!allowEvent(SocketEvents.UpgradeStat)) {
        this.logRejected(socket.id, SocketEvents.UpgradeStat, "rate_limited");
        return;
      }

      const session = this.socketSessions.get(socket.id);
      if (!session || !session.joined || !session.playerId) {
        this.logRejected(socket.id, SocketEvents.UpgradeStat, "before_join");
        return;
      }

      const nowMs = Date.now();
      if (nowMs - session.lastUpgradeAtMs < MIN_UPGRADE_INTERVAL_MS) {
        this.logRejected(socket.id, SocketEvents.UpgradeStat, "upgrade_spam");
        return;
      }

      const upgradePayload = sanitizeUpgradePayload(payload);
      if (!upgradePayload) {
        this.logRejected(socket.id, SocketEvents.UpgradeStat, "invalid_payload");
        return;
      }

      session.lastUpgradeAtMs = nowMs;
      const upgraded = this.world.upgradeStat(session.playerId, upgradePayload.stat, this.tick);
      if (!upgraded) {
        this.logRejected(socket.id, SocketEvents.UpgradeStat, "rejected_by_world");
        return;
      }

      this.metrics.acceptedUpgrades += 1;
    });

    socket.on("disconnect", () => {
      this.replication.delete(socket.id);
      const session = this.socketSessions.get(socket.id);
      this.socketSessions.delete(socket.id);

      if (!session || !session.joined || !session.playerId || !session.nickname) {
        return;
      }

      this.world.setInput(session.playerId, neutralInput);

      const activeSession = this.activePlayerSessions.get(session.playerId);
      if (!activeSession || activeSession.socketId !== socket.id) {
        return;
      }

      const existingPending = this.pendingReconnectByToken.get(activeSession.resumeToken);
      if (existingPending) {
        clearTimeout(existingPending.cleanupTimer);
      }

      const cleanupTimer = setTimeout(() => {
        const pending = this.pendingReconnectByToken.get(activeSession.resumeToken);
        if (!pending) {
          return;
        }

        this.pendingReconnectByToken.delete(activeSession.resumeToken);
        this.activePlayerSessions.delete(pending.playerId);
        this.world.removePlayer(pending.playerId, this.tick);
      }, RECONNECT_GRACE_MS);

      this.pendingReconnectByToken.set(activeSession.resumeToken, {
        playerId: session.playerId,
        nickname: session.nickname,
        resumeToken: activeSession.resumeToken,
        expiresAtMs: Date.now() + RECONNECT_GRACE_MS,
        cleanupTimer
      });
    });
  }

  private runTick(): void {
    this.tick += 1;
    const nowMs = Date.now();
    const tickStartMs = performance.now();
    const stepMetrics = this.world.step(FIXED_DELTA_SECONDS, this.tick, nowMs);
    const sessionEvents = this.world.consumeSessionEvents();
    const tickDurationMs = performance.now() - tickStartMs;

    this.metrics.tickDurationSamplesMs.push(tickDurationMs);
    this.metrics.tickDurationSumMs += tickDurationMs;
    this.metrics.activePlayersSamples += 1;
    this.metrics.activePlayersSum += stepMetrics.activePlayers;
    this.metrics.activeBulletsSamples += 1;
    this.metrics.activeBulletsSum += stepMetrics.activeBullets;
    this.metrics.collisionsEvaluatedSamples.push(stepMetrics.collisionsEvaluated);
    this.metrics.collisionsEvaluatedSum += stepMetrics.collisionsEvaluated;

    if (this.tick % snapshotEveryTicks === 0) {
      const deltaMetrics = this.broadcastDeltas(nowMs);
      this.metrics.payloadBytesSent += deltaMetrics.payloadBytesSent;
      this.metrics.payloadMessagesSent += deltaMetrics.payloadMessagesSent;
    }

    this.emitSessionEvents(sessionEvents);

    this.reportMetricsIfDue(nowMs);
  }

  private broadcastDeltas(nowMs: number): { payloadBytesSent: number; payloadMessagesSent: number } {
    const removedPlayers = this.world.consumeRemovedPlayers();
    const removedBullets = this.world.consumeRemovedBullets();
    const removedShapes = this.world.consumeRemovedShapes();
    const removedZones = this.world.consumeRemovedZones();
    const removedPowerUps = this.world.consumeRemovedPowerUps();
    const sessionState: MatchState = this.world.getMatchState();
    const playerStateCache = new Map<string, PlayerNetState>();
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
        tick: this.tick,
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

      if (tracker.knownSessionTick < sessionState.updatedAtTick) {
        delta.session = sessionState;
        tracker.knownSessionTick = sessionState.updatedAtTick;
      }

      for (const player of this.world.getPlayers()) {
        const knownTick = tracker.knownPlayers.get(player.id) ?? -1;
        if (knownTick < player.updatedAtTick) {
          let playerNetState = playerStateCache.get(player.id);
          if (!playerNetState) {
            playerNetState = this.world.toPlayerNetState(player);
            playerStateCache.set(player.id, playerNetState);
          }

          delta.playersUpsert.push(playerNetState);
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

    this.metrics.sessionDeltaBytesSent += sessionDeltaBytesSent;
    this.metrics.sessionDeltaMessagesSent += sessionDeltaMessagesSent;

    return {
      payloadBytesSent,
      payloadMessagesSent
    };
  }

  private emitSessionEvents(
    events: Array<
      | {
          type: "round_ended";
          payload: RoundEndedPayload;
        }
      | {
          type: "round_reset";
          payload: RoundResetPayload;
        }
    >
  ): void {
    for (const event of events) {
      if (event.type === "round_ended") {
        this.io.emit(SocketEvents.RoundEnded, event.payload);
      } else {
        this.io.emit(SocketEvents.RoundReset, event.payload);
      }
    }
  }

  private tryResume(joinRequest: JoinRequest, socketId: string): ActivePlayerSession | null {
    if (!joinRequest.resumeToken) {
      return null;
    }

    const pending = this.pendingReconnectByToken.get(joinRequest.resumeToken);
    if (!pending) {
      return null;
    }

    if (pending.expiresAtMs < Date.now()) {
      clearTimeout(pending.cleanupTimer);
      this.pendingReconnectByToken.delete(joinRequest.resumeToken);
      this.world.removePlayer(pending.playerId, this.tick);
      return null;
    }

    if (pending.nickname !== joinRequest.nickname) {
      this.logRejected(socketId, SocketEvents.Join, "resume_nickname_mismatch");
      return null;
    }

    if (!this.world.getPlayer(pending.playerId)) {
      clearTimeout(pending.cleanupTimer);
      this.pendingReconnectByToken.delete(joinRequest.resumeToken);
      return null;
    }

    clearTimeout(pending.cleanupTimer);
    this.pendingReconnectByToken.delete(joinRequest.resumeToken);

    const active: ActivePlayerSession = {
      socketId,
      playerId: pending.playerId,
      nickname: pending.nickname,
      resumeToken: pending.resumeToken
    };

    this.activePlayerSessions.set(pending.playerId, active);
    return active;
  }

  private logRejected(_socketId: string, _eventName: string, reason: string): void {
    this.metrics.rejectedEvents += 1;
    this.metrics.rejectedByReason.set(reason, (this.metrics.rejectedByReason.get(reason) ?? 0) + 1);

    if (reason === "rate_limited") {
      this.metrics.rateLimitedEvents += 1;
    }

    if (reason === "invalid_payload") {
      this.metrics.invalidPayloadEvents += 1;
    }

    if (reason === "stale_sequence") {
      this.metrics.staleSequenceEvents += 1;
    }

    if (reason === "upgrade_spam") {
      this.metrics.upgradeSpamEvents += 1;
    }
  }

  private reportMetricsIfDue(nowMs: number): void {
    if (nowMs - this.metrics.lastReportAtMs < METRICS_REPORT_INTERVAL_MS) {
      return;
    }

    const tickSamples = this.metrics.tickDurationSamplesMs.length;
    const tickDurationAvgMs = tickSamples > 0 ? this.metrics.tickDurationSumMs / tickSamples : 0;
    const tickDurationP95Ms = calculateP95(this.metrics.tickDurationSamplesMs);
    const avgPayloadBytes =
      this.metrics.payloadMessagesSent > 0
        ? this.metrics.payloadBytesSent / this.metrics.payloadMessagesSent
        : 0;
    const avgSessionDeltaBytes =
      this.metrics.sessionDeltaMessagesSent > 0
        ? this.metrics.sessionDeltaBytesSent / this.metrics.sessionDeltaMessagesSent
        : 0;
    const reportWindowSeconds = METRICS_REPORT_INTERVAL_MS / 1000;
    const sessionDeltaFrequencyHz =
      reportWindowSeconds > 0 ? this.metrics.sessionDeltaMessagesSent / reportWindowSeconds : 0;
    const avgActivePlayers =
      this.metrics.activePlayersSamples > 0
        ? this.metrics.activePlayersSum / this.metrics.activePlayersSamples
        : 0;
    const avgActiveBullets =
      this.metrics.activeBulletsSamples > 0
        ? this.metrics.activeBulletsSum / this.metrics.activeBulletsSamples
        : 0;
    const collisionSamples = this.metrics.collisionsEvaluatedSamples.length;
    const collisionsEvaluatedAvg =
      collisionSamples > 0 ? this.metrics.collisionsEvaluatedSum / collisionSamples : 0;
    const collisionsEvaluatedP95 = calculateP95(this.metrics.collisionsEvaluatedSamples);

    const reasons = [...this.metrics.rejectedByReason.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([reason, count]) => `${reason}:${count}`)
      .join(",");

    process.stdout.write(
      `[net:metrics] acceptedInputs=${this.metrics.acceptedInputs} acceptedUpgrades=${this.metrics.acceptedUpgrades} rejectedEvents=${this.metrics.rejectedEvents} rateLimitedEvents=${this.metrics.rateLimitedEvents} invalidPayloadEvents=${this.metrics.invalidPayloadEvents} staleSequenceEvents=${this.metrics.staleSequenceEvents} upgradeSpamEvents=${this.metrics.upgradeSpamEvents} disconnectsByRateLimit=${this.metrics.disconnectsByRateLimit} tickDurationAvgMs=${tickDurationAvgMs.toFixed(3)} tickDurationP95Ms=${tickDurationP95Ms.toFixed(3)} avgPayloadBytes=${avgPayloadBytes.toFixed(1)} sessionDeltaMessages=${this.metrics.sessionDeltaMessagesSent} sessionDeltaBytes=${this.metrics.sessionDeltaBytesSent} avgSessionDeltaBytes=${avgSessionDeltaBytes.toFixed(1)} sessionDeltaHz=${sessionDeltaFrequencyHz.toFixed(2)} avgActivePlayers=${avgActivePlayers.toFixed(2)} avgActiveBullets=${avgActiveBullets.toFixed(2)} collisionsEvaluatedAvg=${collisionsEvaluatedAvg.toFixed(2)} collisionsEvaluatedP95=${collisionsEvaluatedP95.toFixed(2)} rejectedByReason=${reasons || "none"}\n`
    );

    this.metrics.acceptedInputs = 0;
    this.metrics.acceptedUpgrades = 0;
    this.metrics.rejectedEvents = 0;
    this.metrics.rateLimitedEvents = 0;
    this.metrics.invalidPayloadEvents = 0;
    this.metrics.staleSequenceEvents = 0;
    this.metrics.upgradeSpamEvents = 0;
    this.metrics.disconnectsByRateLimit = 0;
    this.metrics.tickDurationSamplesMs.length = 0;
    this.metrics.tickDurationSumMs = 0;
    this.metrics.payloadBytesSent = 0;
    this.metrics.payloadMessagesSent = 0;
    this.metrics.sessionDeltaBytesSent = 0;
    this.metrics.sessionDeltaMessagesSent = 0;
    this.metrics.activePlayersSamples = 0;
    this.metrics.activePlayersSum = 0;
    this.metrics.activeBulletsSamples = 0;
    this.metrics.activeBulletsSum = 0;
    this.metrics.collisionsEvaluatedSamples.length = 0;
    this.metrics.collisionsEvaluatedSum = 0;
    this.metrics.rejectedByReason.clear();
    this.metrics.lastReportAtMs = nowMs;
  }
}





