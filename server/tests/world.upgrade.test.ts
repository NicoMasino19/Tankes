import { describe, expect, it } from "vitest";
import { STAT_MAX_LEVEL } from "@tankes/shared";
import { World } from "../src/game/World";

describe("World.upgradeStat", () => {
  it("succeeds when player has points and stat is below max", () => {
    const world = new World();
    const player = world.addPlayer("p1", "Alpha", 1);

    player.upgradePoints = 2;
    player.stats.movementSpeed = 3;

    const upgraded = world.upgradeStat("p1", "movementSpeed", 2);

    expect(upgraded).toBe(true);
    expect(player.stats.movementSpeed).toBe(4);
    expect(player.upgradePoints).toBe(1);
  });

  it("fails when stat is already at STAT_MAX_LEVEL", () => {
    const world = new World();
    const player = world.addPlayer("p1", "Alpha", 1);

    player.upgradePoints = 3;
    player.stats.movementSpeed = STAT_MAX_LEVEL;

    const pointsBefore = player.upgradePoints;
    const statBefore = player.stats.movementSpeed;

    const upgraded = world.upgradeStat("p1", "movementSpeed", 2);

    expect(upgraded).toBe(false);
    expect(player.stats.movementSpeed).toBe(statBefore);
    expect(player.upgradePoints).toBe(pointsBefore);
  });
});