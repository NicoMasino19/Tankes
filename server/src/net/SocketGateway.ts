import { createServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  type AbilityVfxCue,
  type AbilityOfferPayload,
  createNetworkCodec,
  FIXED_DELTA_SECONDS,
  type MatchConfig,
  MatchWinCondition,
  NetworkCodecMode,
  type PingAckPayload,
  type RoundEndedPayload,
  type RoundResetPayload,
  SERVER_TICK_RATE,
  SNAPSHOT_RATE,
  SocketEvents,
  type InputState,
} from "@tankes/shared";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import { World } from "../game/World";
import {
  type JoinRequest,
  sanitizeJoinPayload,
  sanitizeInputState,
  sanitizeUpgradePayload,
  sanitizeCastAbilityPayload,
  sanitizeChooseAbilityPayload,
  sanitizePingPayload
} from "./payloadValidation";
import { ReplicationService, type ReplicationTracker } from "./ReplicationService";

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
const RATE_LIMIT_ABILITY_CAST_WINDOW_MS = parsePositiveIntFromEnv("RATE_LIMIT_ABILITY_CAST_WINDOW_MS", 2_000);
const RATE_LIMIT_ABILITY_CAST_MAX_EVENTS = parsePositiveIntFromEnv("RATE_LIMIT_ABILITY_CAST_MAX_EVENTS", 36);
const RATE_LIMIT_ABILITY_CHOOSE_WINDOW_MS = parsePositiveIntFromEnv("RATE_LIMIT_ABILITY_CHOOSE_WINDOW_MS", 2_000);
const RATE_LIMIT_ABILITY_CHOOSE_MAX_EVENTS = parsePositiveIntFromEnv("RATE_LIMIT_ABILITY_CHOOSE_MAX_EVENTS", 12);
const RATE_LIMIT_PING_WINDOW_MS = parsePositiveIntFromEnv("RATE_LIMIT_PING_WINDOW_MS", 2_000);
const RATE_LIMIT_PING_MAX_EVENTS = parsePositiveIntFromEnv("RATE_LIMIT_PING_MAX_EVENTS", 10);

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

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
  },
  [SocketEvents.CastAbility]: {
    windowMs: RATE_LIMIT_ABILITY_CAST_WINDOW_MS,
    maxEvents: RATE_LIMIT_ABILITY_CAST_MAX_EVENTS
  },
  [SocketEvents.ChooseAbility]: {
    windowMs: RATE_LIMIT_ABILITY_CHOOSE_WINDOW_MS,
    maxEvents: RATE_LIMIT_ABILITY_CHOOSE_MAX_EVENTS
  },
  [SocketEvents.Ping]: {
    windowMs: RATE_LIMIT_PING_WINDOW_MS,
    maxEvents: RATE_LIMIT_PING_MAX_EVENTS
  }
};

const MAX_RATE_VIOLATIONS_BEFORE_DISCONNECT = parsePositiveIntFromEnv(
  "RATE_LIMIT_MAX_VIOLATIONS_BEFORE_DISCONNECT",
  25
);
const RECONNECT_GRACE_MS = parsePositiveIntFromEnv("RECONNECT_GRACE_MS", 7_000);
const MIN_UPGRADE_INTERVAL_MS = parsePositiveIntFromEnv("UPGRADE_MIN_INTERVAL_MS", 120);
const METRICS_REPORT_INTERVAL_MS = 10_000;
const MAX_PENDING_ABILITY_VFX_CUES = 512;
const MATCH_OBJECTIVE_KILLS = parsePositiveIntFromEnv("MATCH_OBJECTIVE_KILLS", 18);
const MATCH_TIME_LIMIT_MS = parsePositiveIntFromEnv("MATCH_TIME_LIMIT_MS", 600_000);
const MATCH_ROUND_END_PAUSE_MS = parsePositiveIntFromEnv("MATCH_ROUND_END_PAUSE_MS", 5_000);
const MATCH_RESPAWN_DELAY_MS = parsePositiveIntFromEnv("MATCH_RESPAWN_DELAY_MS", 1_800);
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

const calculateP95 = (samples: number[]): number => {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(0.95 * (sorted.length - 1)));
  return sorted[index] ?? 0;
};

export class SocketGateway {
  private readonly httpServer: HttpServer;
  private readonly world = new World({
    matchConfig: SERVER_MATCH_CONFIG
  });
  private readonly codec = createNetworkCodec(networkCodecMode);
  private readonly replication = new Map<string, ReplicationTracker>();
  private readonly socketSessions = new Map<string, SocketSessionState>();
  private readonly replicationService: ReplicationService;
  private readonly activePlayerSessions = new Map<string, ActivePlayerSession>();
  private readonly pendingReconnectByToken = new Map<string, PendingReconnectSession>();
  private readonly pendingAbilityVfxCues: AbilityVfxCue[] = [];
  private readonly io: Server;
  private tick = 0;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readonly metrics = {
    acceptedInputs: 0,
    acceptedUpgrades: 0,
    acceptedAbilityCasts: 0,
    acceptedAbilityChoices: 0,
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
    this.httpServer = createServer((request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        });
        response.end("ok");
        return;
      }

      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end("not found");
    });
    this.io = new Server(this.httpServer, {
      cors: {
        origin: CORS_ORIGIN
      }
    });

    this.replicationService = new ReplicationService(
      this.world,
      this.io,
      this.codec,
      this.replication,
      this.socketSessions
    );

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

  private handleSocketError(socket: Socket, eventName: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[net:error] socket=${socket.id} event=${eventName} error=${message}\n`
    );
    try {
      socket.disconnect(true);
    } catch {
      // Swallow disconnect errors
    }
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
      try {
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

        const player = this.world.getPlayer(playerId);
        if (player?.pendingAbilityChoice) {
          socket.emit(SocketEvents.AbilityOffer, player.pendingAbilityChoice);
        }
      } catch (error) {
        this.handleSocketError(socket, SocketEvents.Join, error);
      }
    });

    socket.on(SocketEvents.Input, (payload: unknown) => {
      try {
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
      } catch (error) {
        this.handleSocketError(socket, SocketEvents.Input, error);
      }
    });

    socket.on(SocketEvents.UpgradeStat, (payload: unknown) => {
      try {
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
      } catch (error) {
        this.handleSocketError(socket, SocketEvents.UpgradeStat, error);
      }
    });

    socket.on(SocketEvents.ChooseAbility, (payload: unknown) => {
      try {
        if (!allowEvent(SocketEvents.ChooseAbility)) {
          this.logRejected(socket.id, SocketEvents.ChooseAbility, "rate_limited");
          return;
        }

        const session = this.socketSessions.get(socket.id);
        if (!session || !session.joined || !session.playerId) {
          this.logRejected(socket.id, SocketEvents.ChooseAbility, "before_join");
          return;
        }

        const choosePayload = sanitizeChooseAbilityPayload(payload);
        if (!choosePayload) {
          this.logRejected(socket.id, SocketEvents.ChooseAbility, "invalid_payload");
          return;
        }

        const accepted = this.world.chooseAbility(
          session.playerId,
          choosePayload.slot,
          choosePayload.abilityId,
          this.tick
        );
        if (!accepted) {
          this.logRejected(socket.id, SocketEvents.ChooseAbility, "rejected_by_world");
          return;
        }

        this.metrics.acceptedAbilityChoices += 1;
      } catch (error) {
        this.handleSocketError(socket, SocketEvents.ChooseAbility, error);
      }
    });

    socket.on(SocketEvents.CastAbility, (payload: unknown) => {
      try {
        if (!allowEvent(SocketEvents.CastAbility)) {
          this.logRejected(socket.id, SocketEvents.CastAbility, "rate_limited");
          return;
        }

        const session = this.socketSessions.get(socket.id);
        if (!session || !session.joined || !session.playerId) {
          this.logRejected(socket.id, SocketEvents.CastAbility, "before_join");
          return;
        }

        const castPayload = sanitizeCastAbilityPayload(payload);
        if (!castPayload) {
          this.logRejected(socket.id, SocketEvents.CastAbility, "invalid_payload");
          return;
        }

        const result = this.world.castAbility(session.playerId, castPayload, this.tick, Date.now());
        if (!result.ok) {
          this.logRejected(socket.id, SocketEvents.CastAbility, "rejected_by_world");
          if (result.rejected) {
            socket.emit(SocketEvents.AbilityCastRejected, result.rejected);
          }
          return;
        }

        this.metrics.acceptedAbilityCasts += 1;
      } catch (error) {
        this.handleSocketError(socket, SocketEvents.CastAbility, error);
      }
    });

    socket.on(SocketEvents.Ping, (payload: unknown) => {
      if (!allowEvent(SocketEvents.Ping)) {
        this.logRejected(socket.id, SocketEvents.Ping, "rate_limited");
        return;
      }

      try {
        const pingProbe = sanitizePingPayload(payload);
        if (!pingProbe) {
          this.logRejected(socket.id, SocketEvents.Ping, "invalid_payload");
          return;
        }

        const pingAck: PingAckPayload = {
          clientSentAtMs: pingProbe.clientSentAtMs,
          serverReceivedAtMs: Date.now()
        };
        socket.emit(SocketEvents.PingAck, pingAck);
      } catch (error) {
        this.handleSocketError(socket, SocketEvents.Ping, error);
      }
    });

    socket.on("disconnect", () => {
      try {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(
          `[net:error] socket=${socket.id} event=disconnect error=${message}\n`
        );
      }
    });
  }

  private runTick(): void {
    this.tick += 1;
    const nowMs = Date.now();
    const tickStartMs = performance.now();
    const stepMetrics = this.world.step(FIXED_DELTA_SECONDS, this.tick, nowMs);
    const sessionEvents = this.world.consumeSessionEvents();
    const abilityOffers = this.world.consumeAbilityOfferEvents();
    const tickAbilityVfxCues = this.world.consumeAbilityVfxCues();
    if (tickAbilityVfxCues.length > 0) {
      this.pendingAbilityVfxCues.push(...tickAbilityVfxCues);
      if (this.pendingAbilityVfxCues.length > MAX_PENDING_ABILITY_VFX_CUES) {
        this.pendingAbilityVfxCues.splice(0, this.pendingAbilityVfxCues.length - MAX_PENDING_ABILITY_VFX_CUES);
      }
    }
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
      const cuesForSnapshot = [...this.pendingAbilityVfxCues];
      this.pendingAbilityVfxCues.length = 0;
      const deltaMetrics = this.replicationService.broadcastDeltas(this.tick, nowMs, cuesForSnapshot);
      this.metrics.payloadBytesSent += deltaMetrics.payloadBytesSent;
      this.metrics.payloadMessagesSent += deltaMetrics.payloadMessagesSent;
      this.metrics.sessionDeltaBytesSent += deltaMetrics.sessionDeltaBytesSent;
      this.metrics.sessionDeltaMessagesSent += deltaMetrics.sessionDeltaMessagesSent;
    }

    this.emitSessionEvents(sessionEvents);
    this.emitAbilityOffers(abilityOffers);

    this.reportMetricsIfDue(nowMs);
  }

  private emitAbilityOffers(events: Array<{ playerId: string; payload: AbilityOfferPayload }>): void {
    for (const event of events) {
      const active = this.activePlayerSessions.get(event.playerId);
      if (!active) {
        continue;
      }
      const socket = this.io.sockets.sockets.get(active.socketId);
      socket?.emit(SocketEvents.AbilityOffer, event.payload);
    }
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





