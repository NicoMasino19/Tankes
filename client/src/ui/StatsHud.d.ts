import { type MatchState, type PlayerNetState, type StatKey } from "@tankes/shared";
export interface HudAudioState {
    muted: boolean;
    volume: number;
}
interface StatsHudAudioOptions {
    initialState: HudAudioState;
    onToggleMute: () => void;
    onVolumeChange: (volume: number) => void;
}
export declare class StatsHud {
    readonly element: HTMLDivElement;
    private readonly roundPanel;
    private readonly statsPanel;
    private readonly playerPanel;
    private readonly phaseText;
    private readonly objectiveText;
    private readonly timerText;
    private readonly scoreboardList;
    private readonly levelText;
    private readonly pointsText;
    private readonly playerNameText;
    private readonly playerMetaText;
    private readonly xpLabelText;
    private readonly buffsText;
    private readonly xpBarFill;
    private readonly scoreboardText;
    private readonly resultOverlay;
    private readonly respawnOverlay;
    private readonly muteButton;
    private readonly volumeInput;
    private readonly rows;
    private wireUpgradeInteraction;
    private applyDisabledStyle;
    constructor(onUpgrade: (stat: StatKey) => void, audioOptions: StatsHudAudioOptions);
    setAudioState(state: HudAudioState): void;
    private renderTopScores;
    private buildRoundObjective;
    private updateTimer;
    private updateResultOverlay;
    private updateRespawnOverlay;
    update(selfPlayer: PlayerNetState | undefined, session: MatchState | null, serverTime: number, selfId: string | null, _pingMs?: number | null): void;
}
export {};
