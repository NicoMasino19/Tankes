import type { RespawnState } from "@tankes/shared";

export class RespawnSystem {
  private readonly pendingRespawns = new Map<string, number>();

  schedule(playerId: string, respawnAtMs: number): void {
    this.pendingRespawns.set(playerId, respawnAtMs);
  }

  cancel(playerId: string): void {
    this.pendingRespawns.delete(playerId);
  }

  clear(): void {
    this.pendingRespawns.clear();
  }

  isPending(playerId: string, nowMs: number): boolean {
    const respawnAtMs = this.pendingRespawns.get(playerId);
    if (respawnAtMs === undefined) {
      return false;
    }

    return nowMs < respawnAtMs;
  }

  entries(): IterableIterator<[string, number]> {
    return this.pendingRespawns.entries();
  }

  size(): number {
    return this.pendingRespawns.size;
  }

  buildRespawnState(hasPlayer: (playerId: string) => boolean): RespawnState[] {
    if (this.pendingRespawns.size === 0) {
      return [];
    }

    const respawns: RespawnState[] = [];
    for (const [playerId, respawnAtMs] of this.pendingRespawns.entries()) {
      if (!hasPlayer(playerId)) {
        continue;
      }

      respawns.push({
        playerId,
        respawnAtMs,
        invulnerableUntilMs: null
      });
    }

    return respawns;
  }
}
