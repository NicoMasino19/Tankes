import { describe, expect, it } from "vitest";
import {
  BuffType,
  MatchPhase,
  MatchWinCondition,
  PLAYER_RADIUS,
  RESPAWN_INVULNERABILITY_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "@tankes/shared";
import { World } from "./World";

const toArray = <T>(iter: IterableIterator<T>): T[] => [...iter];

describe("World", () => {
  it("normalizes diagonal movement by dt so distance equals moveSpeed for dt=1", () => {
    const world = new World();
    const player = world.addPlayer("p1", "P1", 0);

    player.x = 1000;
    player.y = 1000;
    player.input.up = true;
    player.input.right = true;
    player.input.aimX = player.x + 200;
    player.input.aimY = player.y - 200;

    const startX = player.x;
    const startY = player.y;
    const expectedDistance = player.moveSpeed;

    world.step(1, 1, 0);

    const distanceMoved = Math.hypot(player.x - startX, player.y - startY);
    expect(distanceMoved).toBeCloseTo(expectedDistance, 6);
  });

  it("clamps player movement to world bounds", () => {
    const world = new World();
    const player = world.addPlayer("p1", "P1", 0);

    player.x = PLAYER_RADIUS;
    player.y = PLAYER_RADIUS;
    player.input.left = true;
    player.input.up = true;
    player.input.aimX = player.x;
    player.input.aimY = player.y;

    world.step(1, 1, 0);

    expect(player.x).toBe(PLAYER_RADIUS);
    expect(player.y).toBe(PLAYER_RADIUS);

    player.x = WORLD_WIDTH - PLAYER_RADIUS;
    player.y = WORLD_HEIGHT - PLAYER_RADIUS;
    player.input.left = false;
    player.input.up = false;
    player.input.right = true;
    player.input.down = true;

    world.step(1, 2, 0);

    expect(player.x).toBe(WORLD_WIDTH - PLAYER_RADIUS);
    expect(player.y).toBe(WORLD_HEIGHT - PLAYER_RADIUS);
  });

  it("enforces shooting cooldown and prevents rapid shots", () => {
    const world = new World();
    const shooter = world.addPlayer("p1", "Shooter", 0);

    shooter.x = 1000;
    shooter.y = 1000;
    shooter.input.shoot = true;
    shooter.input.aimX = shooter.x + 100;
    shooter.input.aimY = shooter.y;

    world.step(0, 1, shooter.reloadMs);
    expect(toArray(world.getBullets())).toHaveLength(1);

    world.step(0, 2, shooter.reloadMs + shooter.reloadMs - 1);
    expect(toArray(world.getBullets())).toHaveLength(1);

    world.step(0, 3, shooter.reloadMs * 2);
    expect(toArray(world.getBullets())).toHaveLength(2);
  });

  it("does not damage bullet owner on own-bullet collision", () => {
    const world = new World();
    const owner = world.addPlayer("p1", "Owner", 0);

    owner.x = 1200;
    owner.y = 1200;
    owner.input.shoot = true;
    owner.input.aimX = owner.x + 100;
    owner.input.aimY = owner.y;

    world.step(0, 1, owner.reloadMs);

    const bullet = toArray(world.getBullets())[0];
    expect(bullet).toBeDefined();
    bullet!.x = owner.x;
    bullet!.y = owner.y;

    const hpBefore = owner.hp;
    world.step(0, 2, owner.reloadMs + 1);

    expect(owner.hp).toBe(hpBefore);
    expect(toArray(world.getBullets())).toHaveLength(1);
  });

  it("applies respawn invulnerability and blocks damage until expiry", () => {
    const world = new World({
      matchConfig: {
        objectiveKills: 99,
        respawnDelayMs: 1
      }
    });
    const attacker = world.addPlayer("p1", "Attacker", 0);
    const target = world.addPlayer("p2", "Target", 0);

    attacker.x = 500;
    attacker.y = 500;
    attacker.input.shoot = true;
    attacker.input.aimX = attacker.x + 100;
    attacker.input.aimY = attacker.y;

    target.x = 700;
    target.y = 500;

    world.step(0, 1, attacker.reloadMs);

    const firstBullet = toArray(world.getBullets()).find((b) => b.ownerId === attacker.id);
    expect(firstBullet).toBeDefined();
    firstBullet!.x = target.x;
    firstBullet!.y = target.y;
    firstBullet!.damage = target.maxHp;

    const killTime = attacker.reloadMs + 1;
    world.step(0, 2, killTime);

    expect(target.hp).toBe(0);

    world.step(0, 3, killTime + 1);

    expect(target.hp).toBe(target.maxHp);
    expect(target.invulnerableUntilMs).toBe(killTime + 1 + RESPAWN_INVULNERABILITY_MS);

    target.x = 800;
    target.y = 800;

    const secondShotTime = attacker.reloadMs * 2 + 1;
    world.step(0, 4, secondShotTime);

    const secondBullet = toArray(world.getBullets()).find((b) => b.ownerId === attacker.id);
    expect(secondBullet).toBeDefined();
    secondBullet!.x = target.x;
    secondBullet!.y = target.y;
    secondBullet!.damage = 10;

    const hpBeforeBlockedHit = target.hp;
    attacker.input.shoot = false;
    world.step(0, 5, target.invulnerableUntilMs - 1);
    expect(target.hp).toBe(hpBeforeBlockedHit);

    world.step(0, 6, target.invulnerableUntilMs);
    expect(target.hp).toBeLessThan(hpBeforeBlockedHit);
  });

  it("rejects stat upgrades when player has no upgrade points", () => {
    const world = new World();
    const player = world.addPlayer("p1", "P1", 0);

    player.upgradePoints = 0;
    const initialMovementSpeedStat = player.stats.movementSpeed;

    const upgraded = world.upgradeStat(player.id, "movementSpeed", 1);

    expect(upgraded).toBe(false);
    expect(player.upgradePoints).toBe(0);
    expect(player.stats.movementSpeed).toBe(initialMovementSpeedStat);
  });

  it("spawns farmable shapes and grants xp when destroyed", () => {
    const world = new World();
    const shooter = world.addPlayer("p1", "Farmer", 0);

    shooter.x = 500;
    shooter.y = 500;
    shooter.input.aimX = shooter.x + 200;
    shooter.input.aimY = shooter.y;

    world.step(0, 1, shooter.reloadMs);

    const initialShapes = toArray(world.getShapes());
    expect(initialShapes.length).toBeGreaterThan(0);

    const targetShape = initialShapes[0];
    expect(targetShape).toBeDefined();

    targetShape!.x = shooter.x + 60;
    targetShape!.y = shooter.y;
    targetShape!.hp = 1;
    targetShape!.updatedAtTick = 1;

    shooter.input.shoot = true;
    world.step(0, 2, shooter.reloadMs * 2 + 1);

    const idsAfter = toArray(world.getShapes()).map((shape) => shape.id);
    expect(idsAfter).not.toContain(targetShape!.id);
    expect(shooter.totalXpEarned).toBe(targetShape!.xpValue);
    expect(shooter.xp).toBe(targetShape!.xpValue);
  });

  it("blocks tank movement against shapes", () => {
    const world = new World();
    const player = world.addPlayer("p1", "BlockTest", 0);

    world.step(0, 1, 0);
    const shape = toArray(world.getShapes())[0];
    expect(shape).toBeDefined();

    player.x = 800;
    player.y = 800;
    shape!.x = player.x + player.radius + shape!.radius - 4;
    shape!.y = player.y;
    shape!.updatedAtTick = 1;

    player.input.right = true;
    player.input.left = false;
    player.input.up = false;
    player.input.down = false;
    player.input.aimX = player.x + 100;
    player.input.aimY = player.y;

    world.step(1, 2, 1);

    const dx = player.x - shape!.x;
    const dy = player.y - shape!.y;
    const minDistance = player.radius + shape!.radius;
    expect(dx * dx + dy * dy).toBeGreaterThanOrEqual((minDistance - 0.01) * (minDistance - 0.01));
  });

  it("awards 25 percent of victim total xp on player kill", () => {
    const world = new World({
      matchConfig: {
        objectiveKills: 99,
        respawnDelayMs: 1
      }
    });

    const attacker = world.addPlayer("p1", "Attacker", 0);
    const target = world.addPlayer("p2", "Target", 0);

    attacker.x = 1400;
    attacker.y = 1400;
    attacker.input.shoot = true;
    attacker.input.aimX = attacker.x + 120;
    attacker.input.aimY = attacker.y;

    target.x = 1520;
    target.y = 1400;
    target.invulnerableUntilMs = 0;
    target.totalXpEarned = 200;

    world.step(0, 1, attacker.reloadMs);
    const lethal = toArray(world.getBullets()).find((bullet) => bullet.ownerId === attacker.id);
    expect(lethal).toBeDefined();
    lethal!.x = target.x;
    lethal!.y = target.y;
    lethal!.damage = target.maxHp;

    world.step(0, 2, attacker.reloadMs + 1);

    expect(attacker.totalXpEarned).toBe(50);
    expect(attacker.xp).toBe(50);
  });

  it("grants zone presence xp then despawns the zone when captured", () => {
    const world = new World({
      matchConfig: {
        objectiveKills: 99,
        respawnDelayMs: 5_000
      }
    });

    const player = world.addPlayer("p1", "Captor", 0);
    world.step(0, 1, 10_000);

    const zone = toArray(world.getZones())[0];
    expect(zone).toBeDefined();
    const zoneId = zone!.id;
    const captureBonus = zone!.captureBonusXp;

    player.x = zone!.x;
    player.y = zone!.y;
    player.input.aimX = player.x + 50;
    player.input.aimY = player.y;

    for (let step = 2; step <= 11; step += 1) {
      world.step(1, step, step * 1000 + 10_000);
    }

    const activeZoneIds = toArray(world.getZones()).map((entry) => entry.id);
    expect(activeZoneIds).not.toContain(zoneId);
    expect(player.totalXpEarned).toBeGreaterThan(captureBonus);
  });

  it("freezes zone capture progress while contested", () => {
    const world = new World();
    const p1 = world.addPlayer("p1", "Alpha", 0);
    const p2 = world.addPlayer("p2", "Bravo", 0);
    world.step(0, 1, 10_000);

    const zone = toArray(world.getZones())[0];
    expect(zone).toBeDefined();

    p1.x = zone!.x;
    p1.y = zone!.y;
    world.step(1, 2, 11_000);
    const progressBeforeContest = zone!.captureProgress;
    expect(progressBeforeContest).toBeGreaterThan(0);

    p2.x = zone!.x + 20;
    p2.y = zone!.y;
    world.step(1, 3, 12_000);

    expect(zone!.contested).toBe(true);
    expect(zone!.captureProgress).toBeCloseTo(progressBeforeContest, 6);
  });

  it("stacks repeated power-up buffs and refreshes expiration", () => {
    const world = new World();
    const player = world.addPlayer("p1", "Stacker", 0);

    const internals = world as unknown as {
      powerUps: Map<string, { id: string; type: string; x: number; y: number; radius: number; expiresAtMs: number; updatedAtTick: number }>;
    };

    player.x = 1000;
    player.y = 1000;

    internals.powerUps.set("pu:1", {
      id: "pu:1",
      type: BuffType.Damage,
      x: player.x,
      y: player.y,
      radius: 20,
      expiresAtMs: 20_000,
      updatedAtTick: 1
    });

    world.step(0, 1, 1_000);
    const firstBuff = player.activeBuffs.find((buff) => buff.type === BuffType.Damage);
    expect(firstBuff).toBeDefined();
    const firstExpiry = firstBuff!.expiresAtMs;

    internals.powerUps.set("pu:2", {
      id: "pu:2",
      type: BuffType.Damage,
      x: player.x,
      y: player.y,
      radius: 20,
      expiresAtMs: 25_000,
      updatedAtTick: 2
    });

    world.step(0, 2, 2_000);
    const stacked = player.activeBuffs.find((buff) => buff.type === BuffType.Damage);
    expect(stacked).toBeDefined();
    expect(stacked!.stacks).toBe(2);
    expect(stacked!.expiresAtMs).toBeGreaterThan(firstExpiry);
  });

  it("ends round on first-to-kills and freezes damage/score during end transition", () => {
    const world = new World({
      matchConfig: {
        winCondition: MatchWinCondition.FirstToKills,
        objectiveKills: 1,
        roundEndPauseMs: 5_000,
        respawnDelayMs: 3_000
      }
    });

    const attacker = world.addPlayer("p1", "Attacker", 0);
    const target = world.addPlayer("p2", "Target", 0);

    attacker.x = 1000;
    attacker.y = 1000;
    target.x = 1200;
    target.y = 1000;
    target.invulnerableUntilMs = 0;

    attacker.input.shoot = true;
    attacker.input.aimX = target.x;
    attacker.input.aimY = target.y;

    world.step(0, 1, attacker.reloadMs);
    const lethalBullet = toArray(world.getBullets())[0];
    expect(lethalBullet).toBeDefined();
    lethalBullet!.x = target.x;
    lethalBullet!.y = target.y;
    lethalBullet!.damage = target.maxHp;

    world.step(0, 2, attacker.reloadMs + 1);

    const endedState = world.getMatchState();
    expect(endedState.phase).toBe(MatchPhase.Ended);
    expect(endedState.roundWinnerPlayerId).toBe(attacker.id);
    const attackerScore = endedState.scoreboard.find((entry) => entry.playerId === attacker.id);
    const targetScore = endedState.scoreboard.find((entry) => entry.playerId === target.id);
    expect(attackerScore?.kills).toBe(1);
    expect(targetScore?.deaths).toBe(1);

    attacker.input.shoot = true;
    world.step(0, 3, attacker.reloadMs * 2);

    const frozenState = world.getMatchState();
    expect(frozenState.phase).toBe(MatchPhase.Ended);
    expect(frozenState.scoreboard.find((entry) => entry.playerId === attacker.id)?.kills).toBe(1);
    expect(frozenState.scoreboard.find((entry) => entry.playerId === target.id)?.deaths).toBe(1);
    expect(toArray(world.getBullets())).toHaveLength(0);
  });

  it("ends round by time limit and returns draw on tied kills", () => {
    const world = new World({
      matchConfig: {
        winCondition: MatchWinCondition.TimeLimit,
        objectiveKills: 99,
        timeLimitMs: 1_000,
        roundEndPauseMs: 5_000,
        respawnDelayMs: 3_000
      }
    });

    world.addPlayer("p1", "P1", 0);
    world.addPlayer("p2", "P2", 0);

    const startedAtMs = world.getMatchState().roundStartedAtMs;

    world.step(0, 1, startedAtMs + 999);
    expect(world.getMatchState().phase).toBe(MatchPhase.InProgress);

    world.step(0, 2, startedAtMs + 1_000);
    const state = world.getMatchState();
    expect(state.phase).toBe(MatchPhase.Ended);
    expect(state.roundWinnerPlayerId).toBeNull();
  });

  it("applies respawn countdown before respawn and keeps invulnerability window after respawn", () => {
    const respawnDelayMs = 3_000;
    const world = new World({
      matchConfig: {
        winCondition: MatchWinCondition.FirstToKills,
        objectiveKills: 99,
        respawnDelayMs,
        roundEndPauseMs: 5_000
      }
    });

    const attacker = world.addPlayer("p1", "Attacker", 0);
    const target = world.addPlayer("p2", "Target", 0);

    attacker.x = 1000;
    attacker.y = 1000;
    target.x = 1200;
    target.y = 1000;
    target.invulnerableUntilMs = 0;

    attacker.input.shoot = true;
    attacker.input.aimX = target.x;
    attacker.input.aimY = target.y;

    world.step(0, 1, attacker.reloadMs);
    const lethalBullet = toArray(world.getBullets())[0];
    expect(lethalBullet).toBeDefined();
    lethalBullet!.x = target.x;
    lethalBullet!.y = target.y;
    lethalBullet!.damage = target.maxHp;

    const killTime = attacker.reloadMs + 1;
    world.step(0, 2, killTime);
    expect(target.hp).toBe(0);
    expect(world.getMatchState().respawns?.some((entry) => entry.playerId === target.id)).toBe(true);

    world.step(0, 3, killTime + respawnDelayMs - 1);
    expect(target.hp).toBe(0);

    world.step(0, 4, killTime + respawnDelayMs);
    expect(target.hp).toBe(target.maxHp);
    expect(target.invulnerableUntilMs).toBe(killTime + respawnDelayMs + RESPAWN_INVULNERABILITY_MS);

    attacker.input.shoot = true;
    attacker.input.aimX = target.x;
    attacker.input.aimY = target.y;
    world.step(0, 5, attacker.reloadMs * 2 + killTime + respawnDelayMs);
    const postRespawnBullet = toArray(world.getBullets()).find((bullet) => bullet.ownerId === attacker.id);
    expect(postRespawnBullet).toBeDefined();
    postRespawnBullet!.x = target.x;
    postRespawnBullet!.y = target.y;
    postRespawnBullet!.damage = 10;

    const hpBeforeBlockedDamage = target.hp;
    attacker.input.shoot = false;
    world.step(0, 6, target.invulnerableUntilMs - 1);
    expect(target.hp).toBe(hpBeforeBlockedDamage);

    world.step(0, 7, target.invulnerableUntilMs);
    expect(target.hp).toBeLessThan(hpBeforeBlockedDamage);
  });
});
