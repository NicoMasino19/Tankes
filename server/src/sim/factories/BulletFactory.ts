import {
  BULLET_LIFETIME_MS,
  BULLET_RADIUS
} from "@tankes/shared";
import type { BulletEntity, PlayerEntity } from "../../domain/entities";
import { BulletPool } from "../pool/BulletPool";

export class BulletFactory {
  private sequence = 0;

  constructor(private readonly pool: BulletPool) {}

  create(owner: PlayerEntity, nowMs: number, tick: number): BulletEntity {
    const bullet = this.pool.acquire();
    const offset = owner.radius + 8;

    bullet.id = `${owner.id}:${this.sequence}`;
    bullet.ownerId = owner.id;
    bullet.x = owner.x + Math.cos(owner.rotation) * offset;
    bullet.y = owner.y + Math.sin(owner.rotation) * offset;
    bullet.vx = Math.cos(owner.rotation) * owner.bulletSpeed;
    bullet.vy = Math.sin(owner.rotation) * owner.bulletSpeed;
    bullet.damage = owner.bulletDamage;
    bullet.radius = BULLET_RADIUS;
    bullet.expiresAtMs = nowMs + BULLET_LIFETIME_MS;
    bullet.updatedAtTick = tick;
    bullet.active = true;
    this.sequence += 1;

    return bullet;
  }

  recycle(bullet: BulletEntity): void {
    this.pool.release(bullet);
  }
}
