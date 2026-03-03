import {
  MatchPhase,
  MatchWinCondition,
  type MatchConfig,
  type MatchState,
  type PlayerScore,
  type RespawnState,
  type RoundEndedPayload,
  type RoundResetPayload
} from "@tankes/shared";

export class RoundSystem {
  private round = 1;
  private phase: MatchState["phase"] = MatchPhase.InProgress;
  private roundStartedAtMs: number;
  private roundEndedAtMs: number | null = null;
  private roundWinnerPlayerId: string | null = null;
  private nextRoundStartsAtMs: number | null = null;

  constructor(private readonly matchConfig: MatchConfig, nowMs = Date.now()) {
    this.roundStartedAtMs = nowMs;
  }

  isRoundEnded(): boolean {
    return this.phase === MatchPhase.Ended;
  }

  isInProgress(): boolean {
    return this.phase === MatchPhase.InProgress;
  }

  isTimeLimitReached(nowMs: number): boolean {
    return (
      this.phase === MatchPhase.InProgress &&
      this.matchConfig.winCondition === MatchWinCondition.TimeLimit &&
      nowMs - this.roundStartedAtMs >= this.matchConfig.timeLimitMs
    );
  }

  findKillWinner(playerKills: ReadonlyMap<string, number>): string | null {
    if (this.phase !== MatchPhase.InProgress || this.matchConfig.winCondition !== MatchWinCondition.FirstToKills) {
      return null;
    }

    for (const [playerId, kills] of playerKills.entries()) {
      if (kills >= this.matchConfig.objectiveKills) {
        return playerId;
      }
    }

    return null;
  }

  resolveTimeLimitWinnerPlayerId(scoreboard: PlayerScore[]): string | null {
    if (scoreboard.length === 0) {
      return null;
    }

    const leader = scoreboard[0];
    if (!leader) {
      return null;
    }

    const tiedLeaders = scoreboard.filter((entry) => entry.kills === leader.kills);
    if (tiedLeaders.length > 1) {
      return null;
    }

    return leader.playerId;
  }

  endRound(winnerPlayerId: string | null, nowMs: number, scoreboard: PlayerScore[]): RoundEndedPayload | null {
    if (this.phase === MatchPhase.Ended) {
      return null;
    }

    this.phase = MatchPhase.Ended;
    this.roundWinnerPlayerId = winnerPlayerId;
    this.roundEndedAtMs = nowMs;
    this.nextRoundStartsAtMs = nowMs + this.matchConfig.roundEndPauseMs;

    return {
      round: this.round,
      winCondition: this.matchConfig.winCondition,
      objectiveKills: this.matchConfig.objectiveKills,
      timeLimitMs: this.matchConfig.timeLimitMs,
      winnerPlayerId,
      endedAtMs: nowMs,
      nextRoundStartsAtMs: this.nextRoundStartsAtMs,
      scoreboard
    };
  }

  startNextRoundIfDue(nowMs: number): RoundResetPayload | null {
    if (this.phase !== MatchPhase.Ended || !this.nextRoundStartsAtMs || nowMs < this.nextRoundStartsAtMs) {
      return null;
    }

    this.round += 1;
    this.phase = MatchPhase.InProgress;
    this.roundStartedAtMs = nowMs;
    this.roundEndedAtMs = null;
    this.roundWinnerPlayerId = null;
    this.nextRoundStartsAtMs = null;

    return {
      round: this.round,
      winCondition: this.matchConfig.winCondition,
      objectiveKills: this.matchConfig.objectiveKills,
      timeLimitMs: this.matchConfig.timeLimitMs,
      startedAtMs: this.roundStartedAtMs
    };
  }

  toMatchState(
    scoreboard: PlayerScore[],
    updatedAtTick: number,
    lastRoundResult: RoundEndedPayload | null,
    respawns: RespawnState[]
  ): MatchState {
    return {
      round: this.round,
      phase: this.phase,
      winCondition: this.matchConfig.winCondition,
      objectiveKills: this.matchConfig.objectiveKills,
      timeLimitMs: this.matchConfig.timeLimitMs,
      roundStartedAtMs: this.roundStartedAtMs,
      roundEndedAtMs: this.roundEndedAtMs,
      roundWinnerPlayerId: this.roundWinnerPlayerId,
      nextRoundStartsAtMs: this.nextRoundStartsAtMs,
      scoreboard,
      updatedAtTick,
      config: this.matchConfig,
      lastRoundResult,
      respawns
    };
  }
}
