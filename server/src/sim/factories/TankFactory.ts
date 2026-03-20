import {
  BASE_BULLET_DAMAGE,
  BASE_BULLET_SPEED,
  BASE_MAX_HEALTH,
  PLAYER_RADIUS,
  BASE_MOVE_SPEED,
  BASE_RELOAD_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  createBaseStats
} from "@tankes/shared";
import type { PlayerEntity } from "../../domain/entities";

const createNeutralInput = () => ({
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
  aimX: 0,
  aimY: 0,
  sequence: 0
});

export class TankFactory {
  create(id: string, name: string, tick: number, spawn?: { x: number; y: number }): PlayerEntity {
    const spawnX = spawn?.x ?? WORLD_WIDTH * (0.2 + Math.random() * 0.6);
    const spawnY = spawn?.y ?? WORLD_HEIGHT * (0.2 + Math.random() * 0.6);

    return {
      id,
      name,
      x: spawnX,
      y: spawnY,
      rotation: 0,
      radius: PLAYER_RADIUS,
      hp: BASE_MAX_HEALTH,
      maxHp: BASE_MAX_HEALTH,
      moveSpeed: BASE_MOVE_SPEED,
      reloadMs: BASE_RELOAD_MS,
      bulletSpeed: BASE_BULLET_SPEED,
      bulletDamage: BASE_BULLET_DAMAGE,
      invulnerableUntilMs: 0,
      xp: 0,
      totalXpEarned: 0,
      level: 1,
      upgradePoints: 0,
      stats: createBaseStats(),
      abilityLoadout: {},
      abilityCooldownEndsAtMs: {},
      pendingAbilityChoice: null,
      activeBuffs: [],
      input: createNeutralInput(),
      lastAcceptedInputSequence: -1,
      lastShotAtMs: 0,
      updatedAtTick: tick
    };
  }
}

