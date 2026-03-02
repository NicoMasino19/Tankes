import { afterEach, describe, expect, it, vi } from "vitest";
import { InterpolationBuffer } from "../../client/src/render/InterpolationBuffer";
import type { WorldState } from "../../client/src/state/ClientWorld";
import type { PlayerNetState } from "@tankes/shared";

const makePlayer = (rotation: number): PlayerNetState => ({
  id: "p1",
  name: "Alpha",
  x: 100,
  y: 200,
  rotation,
  hp: 100,
  maxHp: 120,
  invulnerableUntilMs: 0,
  level: 1,
  xp: 0,
  upgradePoints: 0,
  kills: 0,
  deaths: 0,
  stats: {
    movementSpeed: 0,
    bulletSpeed: 0,
    bulletDamage: 0,
    reloadSpeed: 0,
    maxHealth: 0
  },
  updatedAtTick: 1
});

const makeState = (serverTime: number, tick: number, rotation: number): WorldState => ({
  serverTime,
  tick,
  session: null,
  players: new Map([["p1", makePlayer(rotation)]]),
  bullets: new Map(),
  shapes: new Map(),
  zones: new Map(),
  powerUps: new Map()
});

describe("InterpolationBuffer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps interpolated rotation near ±PI across wraparound", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1100);
    nowSpy.mockReturnValueOnce(1200);
    nowSpy.mockReturnValueOnce(1250);

    const buffer = new InterpolationBuffer();

    buffer.push(makeState(1000, 1, 3.1));
    buffer.push(makeState(1100, 2, -3.1));

    const interpolated = buffer.getInterpolated();
    const [player] = interpolated.players;

    expect(player).toBeDefined();
    expect(Math.abs(player!.rotation)).toBeGreaterThan(3);
  });
});