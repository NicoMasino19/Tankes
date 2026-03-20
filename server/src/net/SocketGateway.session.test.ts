import { createServer as createNetServer } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  AbilitySlot,
  createNetworkCodec,
  MatchPhase,
  NetworkCodecMode,
  SocketEvents,
  type InputState,
  type JoinAckPayload,
  type MatchState,
  type PlayerNetState,
  type RoundEndedPayload,
  type RoundResetPayload
} from "@tankes/shared";
import { SocketGateway } from "./SocketGateway";

const codec = createNetworkCodec(NetworkCodecMode.MsgPack);

interface ClientProbe {
  socket: Socket;
  playerId: string;
  nickname: string;
  resumeToken: string | undefined;
  inputSequence: number;
  players: Map<string, PlayerNetState>;
  session: MatchState | null;
  roundEndedEvents: RoundEndedPayload[];
  roundResetEvents: RoundResetPayload[];
  abilityOffers: Array<{ slot: string; options: string[] }>;
  abilityCastRejectedReasons: string[];
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getFreePort = async (): Promise<number> => {
  const probeServer = createNetServer();

  return new Promise<number>((resolve, reject) => {
    probeServer.once("error", (error) => {
      reject(error);
    });

    probeServer.listen(0, "127.0.0.1", () => {
      const address = probeServer.address();
      if (!address || typeof address === "string") {
        probeServer.close(() => {
          reject(new Error("failed to obtain free port"));
        });
        return;
      }

      const { port } = address;
      probeServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
};

const withGateway = async (run: (url: string, gateway: SocketGateway) => Promise<void>): Promise<void> => {
  const port = await getFreePort();
  const gateway = new SocketGateway(port);
  gateway.start();

  try {
    await sleep(100);
    await run(`http://127.0.0.1:${port}`, gateway);
  } finally {
    await gateway.stop();
  }
};

const connectClient = async (url: string, nickname: string, resumeToken?: string): Promise<ClientProbe> => {
  const socket = io(url, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 3_000
  });

  const probe: ClientProbe = {
    socket,
    playerId: "",
    nickname,
    resumeToken: undefined,
    inputSequence: 0,
    players: new Map<string, PlayerNetState>(),
    session: null,
    roundEndedEvents: [],
    roundResetEvents: [],
    abilityOffers: [],
    abilityCastRejectedReasons: []
  };

  socket.on(SocketEvents.WorldUpdate, (payload: ArrayBuffer | Uint8Array) => {
    const delta = codec.decodeWorldUpdate(payload);

    for (const player of delta.playersUpsert) {
      probe.players.set(player.id, player);
    }

    for (const removedId of delta.playersRemove) {
      probe.players.delete(removedId);
    }

    if (delta.session) {
      probe.session = delta.session;
    }
  });

  socket.on(SocketEvents.RoundEnded, (payload: RoundEndedPayload) => {
    probe.roundEndedEvents.push(payload);
  });

  socket.on(SocketEvents.RoundReset, (payload: RoundResetPayload) => {
    probe.roundResetEvents.push(payload);
  });

  socket.on(SocketEvents.AbilityOffer, (payload: { slot: string; options: string[] }) => {
    probe.abilityOffers.push(payload);
  });

  socket.on(SocketEvents.AbilityCastRejected, (payload: { reason: string }) => {
    probe.abilityCastRejectedReasons.push(payload.reason);
  });

  const ack = await new Promise<JoinAckPayload>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("join timeout"));
    }, 3_500);

    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });

    socket.once("connect", () => {
      socket.emit(SocketEvents.Join, resumeToken ? { nickname, resumeToken } : { nickname });
    });

    socket.once(SocketEvents.JoinAck, (joinAck: JoinAckPayload) => {
      clearTimeout(timer);
      resolve(joinAck);
    });
  });

  probe.playerId = ack.playerId;
  probe.resumeToken = ack.resumeToken;
  return probe;
};

const disconnectClient = async (client: ClientProbe): Promise<void> => {
  if (!client.socket.connected) {
    client.socket.removeAllListeners();
    return;
  }

  await new Promise<void>((resolve) => {
    client.socket.once("disconnect", () => resolve());
    client.socket.disconnect();
  });

  client.socket.removeAllListeners();
};

const waitFor = async <T>(
  label: string,
  predicate: () => T | null,
  timeoutMs = 6_000,
  pollMs = 25
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const value = predicate();
    if (value) {
      return value;
    }

    await sleep(pollMs);
  }

  throw new Error(`timeout while waiting for ${label}`);
};

const sendInput = (client: ClientProbe, patch: Partial<InputState>): void => {
  const me = client.players.get(client.playerId);
  const nextSequence = client.inputSequence + 1;
  client.inputSequence = nextSequence;

  const input: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false,
    aimX: me?.x ?? 0,
    aimY: me?.y ?? 0,
    sequence: nextSequence,
    ...patch
  };

  client.socket.emit(SocketEvents.Input, input);
};

const forceServerKill = (gateway: SocketGateway, attackerId: string, targetId: string): void => {
  const internals = gateway as unknown as {
    world: {
      getPlayer: (id: string) =>
        | {
            maxHp: number;
            hp: number;
            invulnerableUntilMs: number;
            updatedAtTick: number;
          }
        | undefined;
      handleKill: (
        ownerId: string,
        target: {
          maxHp: number;
          hp: number;
          invulnerableUntilMs: number;
          updatedAtTick: number;
        },
        tick: number,
        nowMs: number
      ) => void;
    };
    tick: number;
  };

  const attacker = internals.world.getPlayer(attackerId);
  const target = internals.world.getPlayer(targetId);

  if (!attacker || !target) {
    throw new Error("cannot force kill without both players");
  }

  target.hp = 1;
  target.invulnerableUntilMs = 0;
  target.updatedAtTick += 1;

  internals.world.handleKill(attackerId, target, internals.tick + 1, Date.now());
};

const forceRoundEndAndImmediateReset = (gateway: SocketGateway, winnerPlayerId: string): void => {
  const internals = gateway as unknown as {
    world: {
      endRound: (winnerPlayerId: string, tick: number, nowMs: number) => void;
      nextRoundStartsAtMs: number | null;
    };
    tick: number;
  };

  internals.world.endRound(winnerPlayerId, internals.tick + 1, Date.now());
  internals.world.nextRoundStartsAtMs = Date.now() - 1;
};

const forceAwardXp = (gateway: SocketGateway, playerId: string, xp: number): void => {
  const internals = gateway as unknown as {
    world: {
      getPlayer: (id: string) =>
        | {
            xp: number;
            level: number;
            upgradePoints: number;
            updatedAtTick: number;
          }
        | undefined;
      awardXp: (
        player: {
          xp: number;
          level: number;
          upgradePoints: number;
          updatedAtTick: number;
        },
        xpGain: number,
        tick: number
      ) => void;
    };
    tick: number;
  };

  const player = internals.world.getPlayer(playerId);
  if (!player) {
    throw new Error("player not found for xp award");
  }

  internals.world.awardXp(player, xp, internals.tick + 1);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SocketGateway session validation", () => {
  it(
    "rejects ability casts before unlock and emits ability offers when level threshold is reached",
    async () => {
      await withGateway(async (url, gateway) => {
        const player = await connectClient(url, "AbilityUser");
        const observer = await connectClient(url, "Observer");

        try {
          await waitFor("initial sessions", () => (player.session && observer.session ? true : null));

          player.socket.emit(SocketEvents.CastAbility, {
            slot: AbilitySlot.Slot1
          });

          await waitFor("cast rejected before unlock", () =>
            player.abilityCastRejectedReasons.includes("not_unlocked") ? true : null
          );

          forceAwardXp(gateway, player.playerId, 100);

          const offer = await waitFor("ability offer at level 2", () => {
            const latest = player.abilityOffers.at(-1);
            if (!latest || latest.slot !== AbilitySlot.RightClick || latest.options.length !== 3) {
              return null;
            }
            return latest;
          });

          player.socket.emit(SocketEvents.ChooseAbility, {
            slot: AbilitySlot.RightClick,
            abilityId: offer.options[0]
          });

          await waitFor("self runtime loadout synced", () => {
            const me = player.players.get(player.playerId);
            const selected = me?.abilityRuntime?.loadout?.[AbilitySlot.RightClick];
            return selected ? true : null;
          });

          await waitFor("observer sees player without detailed runtime", () => {
            const observed = observer.players.get(player.playerId);
            if (!observed) {
              return null;
            }

            return observed.abilityRuntime === undefined ? true : null;
          });
        } finally {
          await disconnectClient(player);
          await disconnectClient(observer);
        }
      });
    },
    25_000
  );

  it(
    "synchronizes kills/deaths and supports reconnect without score corruption during round",
    async () => {
      await withGateway(async (url, gateway) => {
        const attacker = await connectClient(url, "Attacker");
        const target = await connectClient(url, "Target");

        try {
          await waitFor("both clients receive initial session", () =>
            attacker.session && target.session ? true : null
          );

          sendInput(attacker, { shoot: false });
          sendInput(target, { shoot: false });

          forceServerKill(gateway, attacker.playerId, target.playerId);

          const beforeReconnect = await waitFor("mirrored scoreboard after kill", () => {
            if (!attacker.session || !target.session) {
              return null;
            }

            const attackerScoreA = attacker.session.scoreboard.find((entry) => entry.playerId === attacker.playerId);
            const targetScoreA = attacker.session.scoreboard.find((entry) => entry.playerId === target.playerId);
            const attackerScoreB = target.session.scoreboard.find((entry) => entry.playerId === attacker.playerId);
            const targetScoreB = target.session.scoreboard.find((entry) => entry.playerId === target.playerId);

            if (!attackerScoreA || !targetScoreA || !attackerScoreB || !targetScoreB) {
              return null;
            }

            const mirrored =
              attackerScoreA.kills === attackerScoreB.kills &&
              targetScoreA.deaths === targetScoreB.deaths &&
              attackerScoreA.kills >= 1 &&
              targetScoreA.deaths >= 1;

            return mirrored ? attacker.session : null;
          });

          const token = attacker.resumeToken;
          expect(token).toBeTruthy();

          const attackerBeforeReconnect = beforeReconnect.scoreboard.find(
            (entry) => entry.playerId === attacker.playerId
          );
          const targetBeforeReconnect = beforeReconnect.scoreboard.find(
            (entry) => entry.playerId === target.playerId
          );

          await disconnectClient(attacker);

          const resumed = await connectClient(url, attacker.nickname, token);
          try {
            expect(resumed.playerId).toBe(attacker.playerId);

            const resumedSession = await waitFor("session after reconnect", () => resumed.session);
            const attackerAfterReconnect = resumedSession.scoreboard.find(
              (entry) => entry.playerId === resumed.playerId
            );
            const targetAfterReconnect = resumedSession.scoreboard.find(
              (entry) => entry.playerId === target.playerId
            );

            expect(attackerAfterReconnect?.kills).toBe(attackerBeforeReconnect?.kills);
            expect(targetAfterReconnect?.deaths).toBe(targetBeforeReconnect?.deaths);

            const uniquePlayers = new Set(resumedSession.scoreboard.map((entry) => entry.playerId));
            expect(uniquePlayers.size).toBe(resumedSession.scoreboard.length);
          } finally {
            await disconnectClient(resumed);
          }
        } finally {
          await disconnectClient(target);
        }
      });
    },
    25_000
  );

  it(
    "emits reproducible round end and reset cycle with consistent session updates",
    async () => {
      await withGateway(async (url, gateway) => {
        const attacker = await connectClient(url, "RoundA");
        const target = await connectClient(url, "RoundB");

        try {
          await waitFor("both clients receive initial session", () =>
            attacker.session && target.session ? true : null
          );

          sendInput(attacker, { shoot: false });
          sendInput(target, { shoot: false });

          forceRoundEndAndImmediateReset(gateway, attacker.playerId);

          await waitFor("round ended events", () =>
            attacker.roundEndedEvents.length > 0 && target.roundEndedEvents.length > 0 ? true : null
          );

          const endedFromAttacker = attacker.roundEndedEvents.at(-1);
          const endedFromTarget = target.roundEndedEvents.at(-1);
          expect(endedFromAttacker?.winnerPlayerId).toBe(attacker.playerId);
          expect(endedFromTarget?.winnerPlayerId).toBe(attacker.playerId);

          await waitFor("round reset events", () =>
            attacker.roundResetEvents.length > 0 && target.roundResetEvents.length > 0 ? true : null,
          8_000
          );

          const resetSession = await waitFor("in-progress session after reset", () => {
            if (!attacker.session || !target.session) {
              return null;
            }

            const roundAdvanced = attacker.session.round >= 2 && target.session.round >= 2;
            const sameRound = attacker.session.round === target.session.round;
            const inProgress =
              attacker.session.phase === MatchPhase.InProgress && target.session.phase === MatchPhase.InProgress;
            return roundAdvanced && sameRound && inProgress ? attacker.session : null;
          }, 8_000);

          expect(resetSession.round).toBe(2);

          const attackerScore = resetSession.scoreboard.find((entry) => entry.playerId === attacker.playerId);
          const targetScore = resetSession.scoreboard.find((entry) => entry.playerId === target.playerId);
          expect(attackerScore?.kills ?? 1).toBe(0);
          expect(targetScore?.deaths ?? 1).toBe(0);
        } finally {
          await disconnectClient(attacker);
          await disconnectClient(target);
        }
      });
    },
    25_000
  );
});
