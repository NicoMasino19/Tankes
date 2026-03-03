import type { PlayerScore } from "@tankes/shared";

interface NamedPlayer {
  id: string;
  name: string;
}

export class ScoreboardService {
  private readonly playerKills = new Map<string, number>();
  private readonly playerDeaths = new Map<string, number>();

  registerPlayer(playerId: string): void {
    this.playerKills.set(playerId, 0);
    this.playerDeaths.set(playerId, 0);
  }

  removePlayer(playerId: string): void {
    this.playerKills.delete(playerId);
    this.playerDeaths.delete(playerId);
  }

  recordKill(killerPlayerId: string | null, victimPlayerId: string): void {
    if (killerPlayerId) {
      this.playerKills.set(killerPlayerId, (this.playerKills.get(killerPlayerId) ?? 0) + 1);
    }

    this.playerDeaths.set(victimPlayerId, (this.playerDeaths.get(victimPlayerId) ?? 0) + 1);
  }

  resetPlayer(playerId: string): void {
    this.playerKills.set(playerId, 0);
    this.playerDeaths.set(playerId, 0);
  }

  getKills(playerId: string): number {
    return this.playerKills.get(playerId) ?? 0;
  }

  getDeaths(playerId: string): number {
    return this.playerDeaths.get(playerId) ?? 0;
  }

  getKillMap(): ReadonlyMap<string, number> {
    return this.playerKills;
  }

  buildScoreboard(players: Iterable<NamedPlayer>): PlayerScore[] {
    const scoreboard = [...players].map((player) => ({
      playerId: player.id,
      name: player.name,
      kills: this.getKills(player.id),
      deaths: this.getDeaths(player.id)
    }));

    scoreboard.sort((left, right) => {
      if (right.kills !== left.kills) {
        return right.kills - left.kills;
      }
      if (left.deaths !== right.deaths) {
        return left.deaths - right.deaths;
      }
      return left.name.localeCompare(right.name);
    });

    return scoreboard;
  }
}
