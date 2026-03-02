import {
  MatchPhase,
  MatchWinCondition,
  STAT_KEYS,
  STAT_MAX_LEVEL,
  type MatchState,
  type PlayerScore,
  type PlayerNetState,
  type StatKey
} from "@tankes/shared";

const formatSeconds = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export interface HudAudioState {
  muted: boolean;
  volume: number;
}

interface StatsHudAudioOptions {
  initialState: HudAudioState;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
}

export class StatsHud {
  readonly element: HTMLDivElement;

  private readonly roundPanel: HTMLDivElement;
  private readonly statsPanel: HTMLDivElement;
  private readonly playerPanel: HTMLDivElement;

  private readonly phaseText: HTMLDivElement;
  private readonly objectiveText: HTMLDivElement;
  private readonly timerText: HTMLDivElement;
  private readonly scoreboardList: HTMLDivElement;

  private readonly levelText: HTMLDivElement;
  private readonly pointsText: HTMLDivElement;

  private readonly playerNameText: HTMLDivElement;
  private readonly playerMetaText: HTMLDivElement;
  private readonly xpLabelText: HTMLDivElement;
  private readonly buffsText: HTMLDivElement;
  private readonly xpBarFill: HTMLDivElement;

  private readonly scoreboardText: HTMLDivElement;
  private readonly resultOverlay: HTMLDivElement;
  private readonly respawnOverlay: HTMLDivElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly volumeInput: HTMLInputElement;

  private readonly rows = new Map<StatKey, HTMLButtonElement>();

  private wireUpgradeInteraction(row: HTMLButtonElement, onActivate: () => void): void {
    row.style.touchAction = "manipulation";

    row.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || row.disabled) {
        return;
      }
      event.preventDefault();
      onActivate();
    });

    row.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !row.disabled) {
        event.preventDefault();
        onActivate();
      }
    });

    row.addEventListener("click", (event) => {
      event.preventDefault();
    });
  }

  private applyDisabledStyle(row: HTMLButtonElement, disabled: boolean, upgradeReady: boolean): void {
    row.disabled = disabled;
    row.classList.toggle("opacity-50", disabled);
    row.classList.toggle("hover:border-cyan-500", !disabled);
    row.classList.toggle("border-cyan-500", upgradeReady);
    row.classList.toggle("bg-slate-800", upgradeReady);
    row.classList.toggle("text-cyan-100", upgradeReady);
  }

  constructor(onUpgrade: (stat: StatKey) => void, audioOptions: StatsHudAudioOptions) {
    this.element = document.createElement("div");
    this.element.className = "pointer-events-none absolute inset-0 z-10 text-sm";

    this.roundPanel = document.createElement("div");
    this.roundPanel.className =
      "pointer-events-auto absolute right-4 top-4 z-10 w-72 rounded-xl border border-slate-800 bg-slate-900/95 p-4 shadow-xl";

    this.statsPanel = document.createElement("div");
    this.statsPanel.className =
      "pointer-events-auto absolute bottom-4 left-4 z-10 w-72 rounded-xl border border-slate-800 bg-slate-900/95 p-4 shadow-xl";

    this.playerPanel = document.createElement("div");
    this.playerPanel.className =
      "pointer-events-none absolute bottom-4 left-1/2 z-10 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-slate-800 bg-slate-900/95 px-4 py-3 shadow-xl";

    const title = document.createElement("h2");
    title.className = "text-base font-semibold text-slate-100";
    title.textContent = "Round";

    this.phaseText = document.createElement("div");
    this.phaseText.className = "mt-1 text-slate-200";

    this.objectiveText = document.createElement("div");
    this.objectiveText.className = "mt-1 text-slate-300";

    this.timerText = document.createElement("div");
    this.timerText.className = "mt-1 text-slate-400";

    const scoreboardTitle = document.createElement("h3");
    scoreboardTitle.className = "mt-3 text-xs font-semibold uppercase tracking-wide text-slate-300";
    scoreboardTitle.textContent = "Top 10";

    this.scoreboardList = document.createElement("div");
    this.scoreboardList.className =
      "mt-2 max-h-60 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2 text-xs text-slate-300";

    const statsTitle = document.createElement("h3");
    statsTitle.className = "text-base font-semibold text-slate-100";
    statsTitle.textContent = "Upgrades";

    this.levelText = document.createElement("div");
    this.levelText.className = "mt-2 text-slate-300";

    this.pointsText = document.createElement("div");
    this.pointsText.className = "mb-3 text-slate-400";

    const audioTitle = document.createElement("h3");
    audioTitle.className = "mt-3 text-xs font-semibold uppercase tracking-wide text-slate-300";
    audioTitle.textContent = "Audio";

    const audioRow = document.createElement("div");
    audioRow.className = "mt-2 mb-2 flex items-center gap-2";

    this.muteButton = document.createElement("button");
    this.muteButton.className =
      "rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-medium text-slate-200 hover:border-cyan-500";
    this.muteButton.addEventListener("click", () => audioOptions.onToggleMute());

    this.volumeInput = document.createElement("input");
    this.volumeInput.type = "range";
    this.volumeInput.min = "0";
    this.volumeInput.max = "100";
    this.volumeInput.step = "1";
    this.volumeInput.className = "w-full accent-cyan-400";
    this.volumeInput.addEventListener("input", () => {
      const nextVolume = Number(this.volumeInput.value) / 100;
      audioOptions.onVolumeChange(nextVolume);
    });

    audioRow.append(this.muteButton, this.volumeInput);

    this.playerNameText = document.createElement("div");
    this.playerNameText.className = "text-center text-3xl font-black leading-none text-slate-100";

    this.playerMetaText = document.createElement("div");
    this.playerMetaText.className = "mt-1 text-center text-sm font-semibold text-cyan-200";

    this.xpLabelText = document.createElement("div");
    this.xpLabelText.className = "mt-2 text-center text-xs text-slate-300";

    this.buffsText = document.createElement("div");
    this.buffsText.className = "mt-1 text-center text-xs text-amber-200";

    const xpBarTrack = document.createElement("div");
    xpBarTrack.className = "mt-1 h-5 w-full rounded-full border border-slate-700 bg-slate-950";

    this.xpBarFill = document.createElement("div");
    this.xpBarFill.className = "h-full rounded-full bg-cyan-400 transition-[width] duration-150";
    this.xpBarFill.style.width = "0%";
    xpBarTrack.append(this.xpBarFill);

    this.resultOverlay = document.createElement("div");
    this.resultOverlay.className =
      "pointer-events-none absolute inset-x-4 top-20 z-20 hidden rounded-md border border-slate-700 bg-slate-950/95 px-3 py-2 text-center text-xs text-slate-100";

    this.respawnOverlay = document.createElement("div");
    this.respawnOverlay.className =
      "pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 rounded-md border border-cyan-700 bg-slate-950/95 px-4 py-2 text-sm font-semibold text-cyan-200";

    this.roundPanel.append(
      title,
      this.phaseText,
      this.objectiveText,
      this.timerText,
      scoreboardTitle,
      this.scoreboardList
    );

    this.statsPanel.append(
      statsTitle,
      this.levelText,
      this.pointsText,
      audioTitle,
      audioRow
    );

    for (const key of STAT_KEYS) {
      const row = document.createElement("button");
      row.className =
        "mb-2 flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left hover:border-cyan-500";
      this.wireUpgradeInteraction(row, () => onUpgrade(key));
      this.rows.set(key, row);
      this.statsPanel.append(row);
    }

    this.scoreboardText = document.createElement("div");
    this.scoreboardText.className = "hidden";

    this.playerPanel.append(this.playerNameText, this.playerMetaText, this.xpLabelText, this.buffsText, xpBarTrack);

    this.element.append(
      this.roundPanel,
      this.statsPanel,
      this.playerPanel,
      this.resultOverlay,
      this.respawnOverlay,
      this.scoreboardText
    );

    this.setAudioState(audioOptions.initialState);
  }

  setAudioState(state: HudAudioState): void {
    this.muteButton.textContent = state.muted ? "Unmute" : "Mute";
    this.volumeInput.value = Math.round(state.volume * 100).toString();
    this.volumeInput.disabled = state.muted;
    this.volumeInput.classList.toggle("opacity-60", state.muted);
  }

  private renderTopScores(scores: PlayerScore[]): string {
    const lines = scores.slice(0, 10).map((entry, index) => {
      return `${index + 1}. ${entry.name} · K:${entry.kills} D:${entry.deaths}`;
    });
    return lines.length > 0 ? lines.join("<br>") : "Waiting for players...";
  }

  private buildRoundObjective(session: MatchState): string {
    if (session.winCondition === MatchWinCondition.TimeLimit) {
      return `Objective: survive ${formatSeconds(session.timeLimitMs)} and lead in kills`;
    }
    const leader = session.scoreboard[0];
    const leaderText = leader ? `${leader.name} ${leader.kills}/${session.objectiveKills}` : "--";
    return `Objective: first to ${session.objectiveKills} kills · Leader: ${leaderText}`;
  }

  private updateTimer(session: MatchState, serverTime: number): void {
    if (session.phase === MatchPhase.Ended && session.nextRoundStartsAtMs) {
      const remaining = session.nextRoundStartsAtMs - serverTime;
      this.timerText.textContent = `Next round in ${formatSeconds(remaining)}`;
      this.timerText.classList.remove("hidden");
      return;
    }

    if (session.winCondition !== MatchWinCondition.TimeLimit) {
      this.timerText.textContent = "";
      this.timerText.classList.add("hidden");
      return;
    }

    const remaining = session.timeLimitMs - (serverTime - session.roundStartedAtMs);
    this.timerText.textContent = `Time left: ${formatSeconds(remaining)}`;
    this.timerText.classList.remove("hidden");
  }

  private updateResultOverlay(session: MatchState): void {
    if (session.phase !== MatchPhase.Ended) {
      this.resultOverlay.classList.add("hidden");
      this.resultOverlay.innerHTML = "";
      return;
    }

    const result = session.lastRoundResult;
    const winnerId = result?.winnerPlayerId ?? session.roundWinnerPlayerId;
    const winner = session.scoreboard.find((entry) => entry.playerId === winnerId)?.name ?? "--";
    const top = (result?.scoreboard ?? session.scoreboard).slice(0, 3);
    const lines = top.map((entry, index) => `${index + 1}. ${entry.name} K:${entry.kills} D:${entry.deaths}`);
    this.resultOverlay.innerHTML = `Winner: ${winner}<br>${lines.length > 0 ? lines.join("<br>") : "Top 3: --"}`;
    this.resultOverlay.classList.remove("hidden");
  }

  private updateRespawnOverlay(
    selfPlayer: PlayerNetState | undefined,
    session: MatchState | null,
    serverTime: number,
    selfId: string | null
  ): void {
    if (!selfPlayer || !session || session.phase === MatchPhase.Ended || selfPlayer.hp > 0 || !selfId) {
      this.respawnOverlay.classList.add("hidden");
      this.respawnOverlay.textContent = "";
      return;
    }

    const respawn = session.respawns?.find((entry) => entry.playerId === selfId);
    if (!respawn?.respawnAtMs) {
      this.respawnOverlay.textContent = "Respawning...";
      this.respawnOverlay.classList.remove("hidden");
      return;
    }

    const remaining = Math.ceil(Math.max(0, respawn.respawnAtMs - serverTime) / 1000);
    this.respawnOverlay.textContent = `Respawn in ${remaining}s`;
    this.respawnOverlay.classList.remove("hidden");
  }

  update(
    selfPlayer: PlayerNetState | undefined,
    session: MatchState | null,
    serverTime: number,
    selfId: string | null
  ): void {
    if (!session) {
      this.phaseText.textContent = "Round: --";
      this.objectiveText.textContent = "Objective: --";
      this.timerText.textContent = "";
      this.timerText.classList.add("hidden");
      this.scoreboardList.innerHTML = "Waiting for server...";
      this.resultOverlay.classList.add("hidden");
      this.respawnOverlay.classList.add("hidden");
    } else {
      const phaseLabel = session.phase === MatchPhase.Ended ? "Ended" : "In progress";
      this.phaseText.textContent = `Round ${session.round} · ${phaseLabel}`;
      this.objectiveText.textContent = this.buildRoundObjective(session);
      this.updateTimer(session, serverTime);
      this.scoreboardList.innerHTML = this.renderTopScores(session.scoreboard);
      this.updateResultOverlay(session);
      this.updateRespawnOverlay(selfPlayer, session, serverTime, selfId);
    }

    if (!selfPlayer) {
      this.levelText.textContent = "Level: --";
      this.pointsText.textContent = "Upgrade points: --";
      this.playerNameText.textContent = "Unknown";
      this.playerMetaText.textContent = "Lvl -- · Score --";
      this.xpLabelText.textContent = "XP --/--";
      this.buffsText.textContent = "";
      this.xpBarFill.style.width = "0%";
      for (const [key, row] of this.rows) {
        row.innerHTML = `<span class="capitalize text-slate-200">${key}</span><span class="text-cyan-400">--</span>`;
        this.applyDisabledStyle(row, true, false);
      }
      return;
    }

    this.levelText.textContent = `Level: ${selfPlayer.level} | XP: ${selfPlayer.xp}`;
    this.pointsText.textContent = `Upgrade points: ${selfPlayer.upgradePoints}`;

    const score = session?.scoreboard.find((entry) => entry.playerId === selfId)?.kills;
    const xpRequired = Math.max(1, selfPlayer.level * 100);
    const xpProgress = Math.max(0, Math.min(1, selfPlayer.xp / xpRequired));

    this.playerNameText.textContent = selfPlayer.name;
    this.playerMetaText.textContent = `Lvl ${selfPlayer.level} · Score ${score ?? "--"}`;
    this.xpLabelText.textContent = `XP ${selfPlayer.xp}/${xpRequired}`;
    const activeBuffs = (selfPlayer.activeBuffs ?? [])
      .filter((buff) => buff.expiresAtMs > serverTime)
      .sort((left, right) => left.type.localeCompare(right.type));
    this.buffsText.textContent =
      activeBuffs.length === 0
        ? ""
        : activeBuffs
            .map((buff) => {
              const remainingSeconds = Math.max(0, Math.ceil((buff.expiresAtMs - serverTime) / 1000));
              return `${buff.type} x${buff.stacks} (${remainingSeconds}s)`;
            })
            .join(" · ");
    this.xpBarFill.style.width = `${Math.round(xpProgress * 100)}%`;

    for (const [key, row] of this.rows) {
      const value = selfPlayer.stats[key];
      row.innerHTML = `<span class="capitalize text-slate-200">${key}</span><span class="text-cyan-400">${value}</span>`;
      const disabled = selfPlayer.upgradePoints <= 0 || value >= STAT_MAX_LEVEL;
      const upgradeReady = !disabled;
      this.applyDisabledStyle(row, disabled, upgradeReady);
    }
  }
}
