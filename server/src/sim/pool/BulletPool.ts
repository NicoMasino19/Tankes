import type { BulletEntity } from "../../domain/entities";

export class BulletPool {
  private readonly pool: BulletEntity[] = [];

  acquire(): BulletEntity {
    const bullet = this.pool.pop();
    if (bullet) {
      bullet.active = true;
      return bullet;
    }

    return {
      id: "",
      ownerId: "",
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      damage: 0,
      radius: 0,
      expiresAtMs: 0,
      active: true,
      updatedAtTick: 0
    };
  }

  release(bullet: BulletEntity): void {
    bullet.active = false;
    this.pool.push(bullet);
  }
}
