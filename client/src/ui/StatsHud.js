import { ABILITY_DEFINITIONS, ABILITY_UNLOCK_LEVELS, AbilitySlot, getXpRequiredForLevel, MatchPhase, MatchWinCondition, STAT_KEYS, STAT_MAX_LEVEL } from "@tankes/shared";
const formatSeconds = (milliseconds) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
};
const STAT_META = {
    movementSpeed: {
        label: "Movement Speed",
        icon: "SPD",
        accentClass: "text-sky-300",
        description: "Improves acceleration and chase potential."
    },
    bulletSpeed: {
        label: "Bullet Speed",
        icon: "VEL",
        accentClass: "text-indigo-300",
        description: "Shots travel faster and are easier to land at range."
    },
    bulletDamage: {
        label: "Bullet Damage",
        icon: "DMG",
        accentClass: "text-rose-300",
        description: "Each hit removes more HP from the enemy."
    },
    reloadSpeed: {
        label: "Reload Speed",
        icon: "RLD",
        accentClass: "text-amber-300",
        description: "Reduces time between shots and bursts."
    },
    maxHealth: {
        label: "Max Health",
        icon: "HP",
        accentClass: "text-emerald-300",
        description: "Raises survivability and recovery margin."
    }
};
const ABILITY_SLOT_LABEL = {
    [AbilitySlot.RightClick]: "RMB",
    [AbilitySlot.Slot1]: "1",
    [AbilitySlot.Slot2]: "2",
    [AbilitySlot.Ultimate]: "ULT"
};
const ABILITY_SLOT_META = {
    [AbilitySlot.RightClick]: { accentClass: "text-cyan-200", ringClass: "border-cyan-500/40" },
    [AbilitySlot.Slot1]: { accentClass: "text-amber-200", ringClass: "border-amber-500/40" },
    [AbilitySlot.Slot2]: { accentClass: "text-violet-200", ringClass: "border-violet-500/40" },
    [AbilitySlot.Ultimate]: { accentClass: "text-rose-200", ringClass: "border-rose-500/40" }
};
const BUFF_META = {
    damage: { icon: "DMG", colorClass: "text-rose-200" },
    reload: { icon: "RLD", colorClass: "text-amber-200" },
    movement: { icon: "SPD", colorClass: "text-sky-200" }
};
const renderGlyph = (label, accentClass) => {
    const svgByLabel = {
        SPD: '<path d="M6 12h8"/><path d="M11 7l4 5-4 5"/><path d="M4 7h5"/><path d="M4 17h5"/>',
        VEL: '<path d="M5 16l7-8 7 8"/><path d="M12 8v10"/>',
        DMG: '<path d="M12 4l6 4v5c0 4-2.6 6.5-6 7-3.4-.5-6-3-6-7V8l6-4z"/><path d="M12 8l-2 4h2l-1 4 3-5h-2l1-3z"/>',
        RLD: '<path d="M12 5a7 7 0 1 0 6.3 4"/><path d="M16 5h3v3"/><path d="M19 5l-4 4"/>',
        HP: '<path d="M12 19s-6-3.8-6-9a3.5 3.5 0 0 1 6-2.4A3.5 3.5 0 0 1 18 10c0 5.2-6 9-6 9z"/>',
        RMB: '<rect x="6" y="5" width="12" height="14" rx="4"/><path d="M12 5v5"/><path d="M12 10h4"/>',
        "1": '<path d="M10 8l2-2v12"/><path d="M9 18h6"/>',
        "2": '<path d="M9 10a3 3 0 1 1 4.8 2.4L9 18h6"/>',
        ULT: '<path d="M12 4l2.5 5.5L20 10l-4 4 .9 6L12 17.5 7.1 20 8 14l-4-4 5.5-.5L12 4z"/>',
        BUFF: '<circle cx="12" cy="12" r="6"/><path d="M12 8v8"/><path d="M8 12h8"/>'
    };
    const svg = svgByLabel[label] ?? svgByLabel.BUFF;
    return `<span class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/90 ${accentClass}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4.5 w-4.5">${svg}</svg></span>`;
};
export class StatsHud {
    element;
    roundPanel;
    statsPanel;
    playerPanel;
    abilitiesPanel;
    menuButton;
    pauseMenuBackdrop;
    pauseMenuPanel;
    pauseMenuTabs;
    pauseMenuSections = new Map();
    pauseMenuTabButtons = new Map();
    abilityOfferPanel;
    abilityOfferTitle;
    abilityOfferList;
    abilityRejectToast;
    tooltipPanel;
    pendingAbilityOffer = null;
    abilityRejectHideAtMs = 0;
    phaseText;
    objectiveText;
    timerText;
    pingText;
    scoreboardList;
    levelText;
    pointsText;
    upgradeLegendText;
    playerNameText;
    playerMetaText;
    playerHintText;
    xpLabelText;
    buffsText;
    xpBarFill;
    scoreboardText;
    resultOverlay;
    respawnOverlay;
    muteButton;
    volumeInput;
    pauseMenuOpen = false;
    activePauseTab = "controls";
    lastXp = -1;
    lastScore = -1;
    currentSelfPlayer;
    rows = new Map();
    abilitySlotText = new Map();
    setAbilityOffer = () => { };
    showAbilityCastRejected(payload) {
        const reasonByCode = {
            not_unlocked: "slot not unlocked",
            not_selected: "choose an ability first",
            cooldown: "ability on cooldown",
            dead: "cannot cast while dead",
            respawning: "cannot cast while respawning",
            invalid_state: "invalid state",
            round_ended: "round ended"
        };
        const slotLabel = ABILITY_SLOT_LABEL[payload.slot] ?? payload.slot;
        this.abilityRejectToast.textContent = `Cast blocked (${slotLabel}): ${reasonByCode[payload.reason]}`;
        this.abilityRejectToast.classList.remove("hidden");
        this.replayAnimationClass(this.abilityRejectToast, "hud-toast");
        this.abilityRejectHideAtMs = performance.now() + 1_800;
    }
    wireUpgradeInteraction(row, onActivate) {
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
    applyDisabledStyle(row, disabled, upgradeReady) {
        row.disabled = disabled;
        row.classList.toggle("opacity-60", disabled);
        row.classList.toggle("hover:border-cyan-500", !disabled && !upgradeReady);
        row.classList.toggle("border-emerald-400", upgradeReady);
        row.classList.toggle("bg-emerald-900/20", upgradeReady);
        row.classList.toggle("shadow-[0_0_0_1px_rgba(74,222,128,0.18),0_0_20px_rgba(74,222,128,0.15)]", upgradeReady);
        row.classList.toggle("hover:border-emerald-300", upgradeReady);
        row.classList.toggle("hud-ready", upgradeReady);
    }
    replayAnimationClass(element, className) {
        element.classList.remove(className);
        void element.offsetWidth;
        element.classList.add(className);
    }
    setPauseTab(tab) {
        this.activePauseTab = tab;
        for (const [key, button] of this.pauseMenuTabButtons) {
            button.classList.toggle("bg-cyan-500/15", key === tab);
            button.classList.toggle("text-cyan-100", key === tab);
            button.classList.toggle("border-cyan-500/60", key === tab);
            button.classList.toggle("text-slate-300", key !== tab);
            button.classList.toggle("border-slate-700", key !== tab);
        }
        for (const [key, section] of this.pauseMenuSections) {
            section.classList.toggle("hidden", key !== tab);
        }
    }
    showTooltip(target, content) {
        const rect = target.getBoundingClientRect();
        this.tooltipPanel.innerHTML = content;
        this.tooltipPanel.classList.remove("hidden");
        this.tooltipPanel.style.left = `${Math.min(window.innerWidth - 260, Math.max(12, rect.left + rect.width / 2 - 110))}px`;
        this.tooltipPanel.style.top = `${Math.max(12, rect.top - 12)}px`;
        this.replayAnimationClass(this.tooltipPanel, "hud-enter");
    }
    hideTooltip() {
        this.tooltipPanel.classList.add("hidden");
    }
    bindTooltip(element, content) {
        element.addEventListener("mouseenter", () => {
            this.showTooltip(element, content());
        });
        element.addEventListener("focus", () => {
            this.showTooltip(element, content());
        });
        element.addEventListener("mouseleave", () => {
            this.hideTooltip();
        });
        element.addEventListener("blur", () => {
            this.hideTooltip();
        });
    }
    togglePauseMenu(force) {
        this.pauseMenuOpen = force ?? !this.pauseMenuOpen;
        this.pauseMenuBackdrop.classList.toggle("hidden", !this.pauseMenuOpen);
        this.pauseMenuPanel.classList.toggle("hidden", !this.pauseMenuOpen);
        if (this.pauseMenuOpen) {
            this.setPauseTab("controls");
            this.replayAnimationClass(this.pauseMenuPanel, "hud-enter");
            return;
        }
        this.hideTooltip();
    }
    constructor(onUpgrade, onChooseAbility, audioOptions) {
        this.element = document.createElement("div");
        this.element.className = "pointer-events-none absolute inset-0 z-10 text-sm";
        this.roundPanel = document.createElement("div");
        this.roundPanel.className =
            "hud-card hud-round-panel pointer-events-auto absolute right-4 top-4 z-10 w-80 rounded-2xl border border-slate-700/80 bg-slate-900/92 p-4 shadow-2xl";
        this.statsPanel = document.createElement("div");
        this.statsPanel.className =
            "hud-card hud-stats-panel pointer-events-auto absolute bottom-4 left-4 z-10 w-80 rounded-2xl border border-slate-700/80 bg-slate-900/92 p-4 shadow-2xl";
        this.playerPanel = document.createElement("div");
        this.playerPanel.className =
            "hud-card hud-player-panel pointer-events-none absolute bottom-4 left-1/2 z-10 w-[30rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-slate-700/80 bg-slate-900/92 px-5 py-3 shadow-2xl";
        this.abilitiesPanel = document.createElement("div");
        this.abilitiesPanel.className =
            "hud-card hud-abilities-panel pointer-events-auto absolute bottom-4 right-4 z-10 w-80 rounded-2xl border border-slate-700/80 bg-slate-900/92 p-4 shadow-2xl";
        this.menuButton = document.createElement("button");
        this.menuButton.className =
            "hud-card hud-menu-button pointer-events-auto absolute left-4 top-4 z-20 rounded-xl border border-slate-700/80 bg-slate-900/92 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100";
        this.menuButton.innerHTML = '<span class="text-cyan-200">ESC</span> Menu';
        this.menuButton.addEventListener("click", () => this.togglePauseMenu());
        this.pauseMenuBackdrop = document.createElement("div");
        this.pauseMenuBackdrop.className = "absolute inset-0 z-30 hidden bg-slate-950/55";
        this.pauseMenuBackdrop.addEventListener("click", () => this.togglePauseMenu(false));
        this.pauseMenuPanel = document.createElement("div");
        this.pauseMenuPanel.className =
            "hud-card hud-pause-panel pointer-events-auto absolute left-1/2 top-1/2 z-40 hidden w-[34rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-700/80 bg-slate-900/96 p-5 shadow-2xl";
        this.pauseMenuPanel.addEventListener("click", (event) => event.stopPropagation());
        this.pauseMenuTabs = document.createElement("div");
        this.pauseMenuTabs.className = "mt-4 flex flex-wrap gap-2";
        this.abilityOfferPanel = document.createElement("div");
        this.abilityOfferPanel.className =
            "hud-card hud-offer-panel pointer-events-auto absolute left-4 top-28 z-20 hidden w-80 rounded-2xl border border-cyan-600/80 bg-slate-900/95 p-4 shadow-2xl";
        this.abilityOfferTitle = document.createElement("h3");
        this.abilityOfferTitle.className = "text-sm font-semibold text-cyan-100";
        this.abilityOfferTitle.textContent = "Choose ability";
        this.abilityOfferList = document.createElement("div");
        this.abilityOfferList.className = "mt-3 space-y-2";
        this.abilityOfferPanel.append(this.abilityOfferTitle, this.abilityOfferList);
        this.abilityRejectToast = document.createElement("div");
        this.abilityRejectToast.className =
            "hud-toast-panel pointer-events-none absolute left-1/2 top-16 z-20 hidden -translate-x-1/2 rounded-md border border-rose-700 bg-slate-950/95 px-4 py-2 text-xs font-semibold text-rose-200";
        this.tooltipPanel = document.createElement("div");
        this.tooltipPanel.className =
            "pointer-events-none fixed z-50 hidden max-w-[220px] -translate-y-full rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs text-slate-200 shadow-2xl";
        const title = document.createElement("h2");
        title.className = "text-base font-semibold text-slate-100";
        title.textContent = "Round";
        this.phaseText = document.createElement("div");
        this.phaseText.className = "mt-1 text-slate-200";
        this.objectiveText = document.createElement("div");
        this.objectiveText.className = "mt-1 text-slate-300";
        this.timerText = document.createElement("div");
        this.timerText.className = "mt-1 text-slate-400";
        this.pingText = document.createElement("div");
        this.pingText.className = "mt-1 text-slate-400";
        this.pingText.textContent = "Ping: -- ms";
        const scoreboardTitle = document.createElement("h3");
        scoreboardTitle.className = "mt-3 text-xs font-semibold uppercase tracking-wide text-slate-300";
        scoreboardTitle.textContent = "Top 10";
        this.scoreboardList = document.createElement("div");
        this.scoreboardList.className =
            "hud-scrollbar mt-2 max-h-60 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2 text-xs text-slate-300";
        const statsTitle = document.createElement("h3");
        statsTitle.className = "text-base font-semibold text-slate-100";
        statsTitle.textContent = "Upgrades";
        const statsSubtitle = document.createElement("div");
        statsSubtitle.className = "mt-1 text-xs text-slate-400";
        statsSubtitle.textContent = "Spend points on the rows glowing in green.";
        this.levelText = document.createElement("div");
        this.levelText.className = "mt-2 text-slate-300";
        this.pointsText = document.createElement("div");
        this.pointsText.className = "mb-3 text-slate-400";
        this.upgradeLegendText = document.createElement("div");
        this.upgradeLegendText.className = "mb-3 rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300";
        this.upgradeLegendText.innerHTML =
            '<div class="mb-1 font-semibold text-slate-100">Upgrade States</div>' +
                '<div class="flex flex-wrap gap-2">' +
                '<span class="rounded bg-emerald-500/20 px-1.5 py-0.5 font-black text-emerald-200">READY</span><span>Tap to spend a point</span>' +
                '<span class="rounded bg-slate-800 px-1.5 py-0.5 font-black text-slate-300">LOCK</span><span>No points available</span>' +
                '<span class="rounded bg-slate-700 px-1.5 py-0.5 font-black text-slate-200">MAX</span><span>Already capped</span>' +
                '</div>';
        const audioTitle = document.createElement("h3");
        audioTitle.className = "text-xs font-semibold uppercase tracking-wide text-slate-300";
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
        const pauseTitle = document.createElement("div");
        pauseTitle.className = "flex items-center justify-between gap-3";
        pauseTitle.innerHTML =
            '<div><div class="text-lg font-black tracking-tight text-slate-100">Combat Menu</div><div class="mt-1 text-xs text-slate-400">The match keeps running while this panel is open.</div></div>' +
                '<button class="rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-200">Close</button>';
        const closeButton = pauseTitle.querySelector("button");
        closeButton?.addEventListener("click", () => this.togglePauseMenu(false));
        const controlsPanel = document.createElement("div");
        controlsPanel.className = "mt-4 grid grid-cols-2 gap-2 text-xs";
        controlsPanel.innerHTML =
            '<div class="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"><div class="font-semibold text-slate-100">Move</div><div class="text-slate-400">WASD</div></div>' +
                '<div class="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"><div class="font-semibold text-slate-100">Aim</div><div class="text-slate-400">Mouse</div></div>' +
                '<div class="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"><div class="font-semibold text-slate-100">Fire</div><div class="text-slate-400">Left click</div></div>' +
                '<div class="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"><div class="font-semibold text-slate-100">Abilities</div><div class="text-slate-400">RMB / 1 / 2 / 3</div></div>' +
                '<div class="col-span-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2"><div class="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Combat flow</div><div class="mt-1 text-xs text-slate-300">Green means ready to upgrade or cast. ESC opens this panel and the match keeps running.</div></div>';
        const menuAudioPanel = document.createElement("div");
        menuAudioPanel.className = "mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3";
        menuAudioPanel.append(audioTitle, audioRow);
        const helpPanel = document.createElement("div");
        helpPanel.className = "mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300";
        helpPanel.innerHTML =
            '<div class="font-semibold text-slate-100">HUD Guide</div>' +
                '<div class="mt-2 space-y-2">' +
                '<div><span class="text-cyan-200">Top right</span>: round state, objective, timer and top 10.</div>' +
                '<div><span class="text-emerald-200">Bottom left</span>: upgrade rows. Green glow means you can spend a point.</div>' +
                '<div><span class="text-amber-200">Bottom right</span>: active abilities, unlock state and cooldown progress.</div>' +
                '<div><span class="text-sky-200">Bottom center</span>: your name, score, XP, next goal and temporary buffs.</div>' +
                '</div>';
        const audioSection = document.createElement("div");
        audioSection.append(menuAudioPanel);
        const controlsSection = document.createElement("div");
        controlsSection.append(controlsPanel);
        const hudSection = document.createElement("div");
        hudSection.append(helpPanel);
        this.pauseMenuSections.set("audio", audioSection);
        this.pauseMenuSections.set("controls", controlsSection);
        this.pauseMenuSections.set("hud", hudSection);
        const pauseTabs = [
            { key: "controls", label: "Controls" },
            { key: "audio", label: "Audio" },
            { key: "hud", label: "HUD Guide" }
        ];
        for (const pauseTab of pauseTabs) {
            const button = document.createElement("button");
            button.className =
                "rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300";
            button.textContent = pauseTab.label;
            button.addEventListener("click", () => this.setPauseTab(pauseTab.key));
            this.pauseMenuTabButtons.set(pauseTab.key, button);
            this.pauseMenuTabs.append(button);
        }
        this.pauseMenuPanel.append(pauseTitle, this.pauseMenuTabs, controlsSection, audioSection, hudSection);
        this.setPauseTab(this.activePauseTab);
        this.playerNameText = document.createElement("div");
        this.playerNameText.className = "text-center text-4xl font-black leading-none tracking-tight text-slate-100";
        this.playerMetaText = document.createElement("div");
        this.playerMetaText.className = "mt-1 text-center text-sm font-semibold tracking-wide text-cyan-200";
        this.playerHintText = document.createElement("div");
        this.playerHintText.className =
            "mt-2 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400";
        this.xpLabelText = document.createElement("div");
        this.xpLabelText.className = "mt-2 text-center text-xs font-medium text-slate-200";
        this.buffsText = document.createElement("div");
        this.buffsText.className = "mt-2 flex flex-wrap items-center justify-center gap-1 text-[11px]";
        const xpBarTrack = document.createElement("div");
        xpBarTrack.className = "mt-1 h-5 w-full overflow-hidden rounded-full border border-slate-700 bg-slate-950";
        this.xpBarFill = document.createElement("div");
        this.xpBarFill.className = "h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-500 transition-[width] duration-200";
        this.xpBarFill.style.width = "0%";
        xpBarTrack.append(this.xpBarFill);
        this.resultOverlay = document.createElement("div");
        this.resultOverlay.className =
            "hud-result-overlay pointer-events-none absolute inset-x-4 top-20 z-20 hidden rounded-md border border-slate-700 bg-slate-950/95 px-3 py-2 text-center text-xs text-slate-100";
        this.respawnOverlay = document.createElement("div");
        this.respawnOverlay.className =
            "hud-respawn-overlay pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 rounded-md border border-cyan-700 bg-slate-950/95 px-4 py-2 text-sm font-semibold text-cyan-200";
        this.roundPanel.append(title, this.phaseText, this.objectiveText, this.timerText, this.pingText, scoreboardTitle, this.scoreboardList);
        this.statsPanel.append(statsTitle, statsSubtitle, this.levelText, this.pointsText, this.upgradeLegendText);
        const abilitiesTitle = document.createElement("h3");
        abilitiesTitle.className = "text-base font-semibold text-slate-100";
        abilitiesTitle.textContent = "Abilities (RMB / 1 / 2 / ULT)";
        const abilitiesSubtitle = document.createElement("div");
        abilitiesSubtitle.className = "mt-1 text-xs text-slate-400";
        abilitiesSubtitle.textContent = "Each slot shows unlock state and cooldown readiness.";
        const slotRows = [
            { slot: AbilitySlot.RightClick, label: ABILITY_SLOT_LABEL[AbilitySlot.RightClick] },
            { slot: AbilitySlot.Slot1, label: ABILITY_SLOT_LABEL[AbilitySlot.Slot1] },
            { slot: AbilitySlot.Slot2, label: ABILITY_SLOT_LABEL[AbilitySlot.Slot2] },
            { slot: AbilitySlot.Ultimate, label: ABILITY_SLOT_LABEL[AbilitySlot.Ultimate] }
        ];
        this.abilitiesPanel.append(abilitiesTitle, abilitiesSubtitle);
        for (const slotRow of slotRows) {
            const row = document.createElement("div");
            row.className = "mt-2 rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2.5 text-xs text-slate-200 shadow-sm";
            row.tabIndex = 0;
            row.textContent = `${slotRow.label}: --`;
            this.bindTooltip(row, () => {
                const currentSelfPlayer = this.currentSelfPlayer;
                const abilityId = currentSelfPlayer?.abilityRuntime?.loadout?.[slotRow.slot];
                if (!currentSelfPlayer) {
                    return `${slotRow.label}: no player data yet.`;
                }
                if (!abilityId) {
                    const unlockLevel = ABILITY_UNLOCK_LEVELS[slotRow.slot];
                    return currentSelfPlayer.level >= unlockLevel
                        ? `${slotRow.label}: slot unlocked. Wait for an ability offer to assign a power.`
                        : `${slotRow.label}: unlocks at level ${unlockLevel}. Keep leveling to open this slot.`;
                }
                const ability = ABILITY_DEFINITIONS[abilityId];
                return `${ability.name}: ${ability.description}`;
            });
            this.abilitySlotText.set(slotRow.slot, row);
            this.abilitiesPanel.append(row);
        }
        for (const key of STAT_KEYS) {
            const row = document.createElement("button");
            row.className =
                "mb-2 flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left hover:border-cyan-500";
            this.wireUpgradeInteraction(row, () => onUpgrade(key));
            this.bindTooltip(row, () => {
                const meta = STAT_META[key];
                const currentSelfPlayer = this.currentSelfPlayer;
                const value = currentSelfPlayer?.stats[key];
                const nextLevel = typeof value === "number" ? Math.min(STAT_MAX_LEVEL, value + 1) : null;
                if (value === undefined) {
                    return `${meta.label}: ${meta.description}`;
                }
                if (value >= STAT_MAX_LEVEL) {
                    return `${meta.label}: maxed at level ${STAT_MAX_LEVEL}. ${meta.description}`;
                }
                const canUpgrade = (currentSelfPlayer?.upgradePoints ?? 0) > 0;
                return `${meta.label}: level ${value}/${STAT_MAX_LEVEL}. ${meta.description} ${canUpgrade ? `Spend a point to reach level ${nextLevel}.` : "Earn an upgrade point to increase this stat."}`;
            });
            this.rows.set(key, row);
            this.statsPanel.append(row);
        }
        const renderAbilityOffer = (offer) => {
            this.pendingAbilityOffer = offer;
            this.abilityOfferList.innerHTML = "";
            if (!offer) {
                this.abilityOfferPanel.classList.add("hidden");
                return;
            }
            this.abilityOfferTitle.textContent = `Ability unlock · ${offer.slot} (lvl ${offer.unlockLevel})`;
            for (const option of offer.options) {
                const definition = ABILITY_DEFINITIONS[option];
                const button = document.createElement("button");
                button.className =
                    "block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs hover:border-cyan-500";
                button.title = `${definition.name}: ${definition.description}`;
                button.innerHTML = `<div class="font-semibold text-cyan-200">${definition.name}</div>`;
                button.addEventListener("click", () => {
                    onChooseAbility({ slot: offer.slot, abilityId: option });
                    renderAbilityOffer(null);
                });
                this.abilityOfferList.append(button);
            }
            this.abilityOfferPanel.classList.remove("hidden");
            this.replayAnimationClass(this.abilityOfferPanel, "hud-enter");
        };
        this.setAbilityOffer = renderAbilityOffer;
        this.scoreboardText = document.createElement("div");
        this.scoreboardText.className = "hidden";
        this.playerPanel.append(this.playerNameText, this.playerMetaText, this.playerHintText, this.xpLabelText, this.buffsText, xpBarTrack);
        this.element.append(this.menuButton, this.roundPanel, this.statsPanel, this.abilitiesPanel, this.playerPanel, this.pauseMenuBackdrop, this.pauseMenuPanel, this.abilityOfferPanel, this.abilityRejectToast, this.tooltipPanel, this.resultOverlay, this.respawnOverlay, this.scoreboardText);
        this.setAudioState(audioOptions.initialState);
    }
    setAudioState(state) {
        this.muteButton.textContent = state.muted ? "Unmute" : "Mute";
        this.volumeInput.value = Math.round(state.volume * 100).toString();
        this.volumeInput.disabled = state.muted;
        this.volumeInput.classList.toggle("opacity-60", state.muted);
    }
    renderCooldownBar(progress) {
        const clamped = Math.max(0, Math.min(1, progress));
        return `<span class="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-800"><span class="block h-full bg-cyan-400 transition-[width] duration-150" style="width:${Math.round(clamped * 100)}%"></span></span>`;
    }
    renderBuffs(activeBuffs, serverTime) {
        return activeBuffs
            .map((buff) => {
            const remainingSeconds = Math.max(0, Math.ceil((buff.expiresAtMs - serverTime) / 1000));
            const meta = BUFF_META[buff.type] ?? { icon: "BUFF", colorClass: "text-slate-100" };
            return `<span class="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950/90 px-2 py-1 ${meta.colorClass}"><span class="text-[10px] font-black">${meta.icon}</span><span>x${buff.stacks}</span><span class="text-slate-300">${remainingSeconds}s</span></span>`;
        })
            .join("");
    }
    renderTopScores(scores, selfId) {
        const lines = scores.slice(0, 10).map((entry, index) => {
            const isSelf = selfId !== null && entry.playerId === selfId;
            const rankClass = index === 0 ? "text-amber-200" : index === 1 ? "text-slate-200" : "text-orange-200";
            return `<div class="mb-1 flex items-center justify-between rounded px-2 py-1 ${isSelf ? "bg-cyan-900/40 ring-1 ring-cyan-500/60" : "bg-slate-950/40"}"><span class="font-semibold ${rankClass}">#${index + 1}</span><span class="mx-2 flex-1 truncate ${isSelf ? "text-cyan-100" : "text-slate-200"}">${entry.name}</span><span class="text-slate-300">K:${entry.kills} D:${entry.deaths}</span></div>`;
        });
        return lines.length > 0 ? lines.join("") : "Waiting for players...";
    }
    buildRoundObjective(session) {
        if (session.winCondition === MatchWinCondition.TimeLimit) {
            return `Objective: survive ${formatSeconds(session.timeLimitMs)} and lead in kills`;
        }
        const leader = session.scoreboard[0];
        const leaderText = leader ? `${leader.name} ${leader.kills}/${session.objectiveKills}` : "--";
        return `Objective: first to ${session.objectiveKills} kills · Leader: ${leaderText}`;
    }
    updateTimer(session, serverTime) {
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
    updateResultOverlay(session) {
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
        this.replayAnimationClass(this.resultOverlay, "hud-enter");
    }
    updateRespawnOverlay(selfPlayer, session, serverTime, selfId) {
        if (!selfPlayer || !session || session.phase === MatchPhase.Ended || selfPlayer.hp > 0 || !selfId) {
            this.respawnOverlay.classList.add("hidden");
            this.respawnOverlay.textContent = "";
            return;
        }
        const respawn = session.respawns?.find((entry) => entry.playerId === selfId);
        if (!respawn?.respawnAtMs) {
            this.respawnOverlay.textContent = "Respawning...";
            this.respawnOverlay.classList.remove("hidden");
            this.replayAnimationClass(this.respawnOverlay, "hud-enter");
            return;
        }
        const remaining = Math.ceil(Math.max(0, respawn.respawnAtMs - serverTime) / 1000);
        this.respawnOverlay.textContent = `Respawn in ${remaining}s`;
        this.respawnOverlay.classList.remove("hidden");
        this.replayAnimationClass(this.respawnOverlay, "hud-enter");
    }
    update(selfPlayer, session, serverTime, selfId, pingMs) {
        this.currentSelfPlayer = selfPlayer;
        if (this.abilityRejectHideAtMs > 0 && performance.now() >= this.abilityRejectHideAtMs) {
            this.abilityRejectHideAtMs = 0;
            this.abilityRejectToast.classList.add("hidden");
            this.abilityRejectToast.textContent = "";
        }
        this.pingText.textContent = pingMs === null || pingMs === undefined ? "Ping: -- ms" : `Ping: ${pingMs} ms`;
        if (!session) {
            this.phaseText.textContent = "Round: --";
            this.objectiveText.textContent = "Objective: --";
            this.timerText.textContent = "";
            this.timerText.classList.add("hidden");
            this.scoreboardList.innerHTML = "Waiting for server...";
            this.resultOverlay.classList.add("hidden");
            this.respawnOverlay.classList.add("hidden");
        }
        else {
            const phaseLabel = session.phase === MatchPhase.Ended ? "Ended" : "In progress";
            this.phaseText.textContent = `Round ${session.round} · ${phaseLabel}`;
            this.objectiveText.textContent = this.buildRoundObjective(session);
            this.updateTimer(session, serverTime);
            this.scoreboardList.innerHTML = this.renderTopScores(session.scoreboard, selfId);
            this.updateResultOverlay(session);
            this.updateRespawnOverlay(selfPlayer, session, serverTime, selfId);
        }
        if (!selfPlayer) {
            this.levelText.textContent = "Level: --";
            this.pointsText.textContent = "Upgrade points: --";
            this.playerNameText.textContent = "Unknown";
            this.playerMetaText.textContent = "Lvl -- · Score --";
            this.playerHintText.textContent = "Waiting for player snapshot";
            this.xpLabelText.textContent = "XP --/--";
            this.buffsText.innerHTML = "";
            this.xpBarFill.style.width = "0%";
            this.lastXp = -1;
            this.lastScore = -1;
            for (const [key, row] of this.rows) {
                const meta = STAT_META[key];
                row.title = meta.description;
                row.innerHTML = `<span class="flex items-center gap-2">${renderGlyph(meta.icon, meta.accentClass)}<span class="block leading-tight text-slate-100">${meta.label}</span></span><span class="text-cyan-400">--</span>`;
                this.applyDisabledStyle(row, true, false);
            }
            for (const row of this.abilitySlotText.values()) {
                row.textContent = "--";
            }
            return;
        }
        this.levelText.textContent = `Level: ${selfPlayer.level} | XP: ${selfPlayer.xp}`;
        this.pointsText.textContent = `Upgrade points: ${selfPlayer.upgradePoints}`;
        const score = session?.scoreboard.find((entry) => entry.playerId === selfId)?.kills;
        const xpRequired = Math.max(1, getXpRequiredForLevel(selfPlayer.level));
        const xpProgress = Math.max(0, Math.min(1, selfPlayer.xp / xpRequired));
        const nextAbilityUnlock = Object.entries(ABILITY_UNLOCK_LEVELS)
            .map(([slot, level]) => ({ slot: slot, level }))
            .filter((entry) => entry.level > selfPlayer.level)
            .sort((left, right) => left.level - right.level)[0];
        const playerHint = selfPlayer.upgradePoints > 0
            ? `${selfPlayer.upgradePoints} upgrade point${selfPlayer.upgradePoints === 1 ? "" : "s"} ready`
            : nextAbilityUnlock
                ? `Next unlock: ${ABILITY_SLOT_LABEL[nextAbilityUnlock.slot]} at lvl ${nextAbilityUnlock.level}`
                : "Loadout complete · keep pressure on the scoreboard";
        this.playerNameText.textContent = selfPlayer.name;
        this.playerMetaText.textContent = `Lvl ${selfPlayer.level} · Score ${score ?? "--"}`;
        this.playerHintText.textContent = playerHint;
        this.xpLabelText.textContent = `XP ${selfPlayer.xp}/${xpRequired}`;
        const activeBuffs = (selfPlayer.activeBuffs ?? [])
            .filter((buff) => buff.expiresAtMs > serverTime)
            .sort((left, right) => left.type.localeCompare(right.type));
        this.buffsText.innerHTML = activeBuffs.length === 0 ? "" : this.renderBuffs(activeBuffs, serverTime);
        this.xpBarFill.style.width = `${Math.round(xpProgress * 100)}%`;
        if (this.lastXp !== selfPlayer.xp) {
            this.replayAnimationClass(this.xpBarFill, "hud-pulse");
            this.lastXp = selfPlayer.xp;
        }
        if (typeof score === "number") {
            if (this.lastScore !== score) {
                this.replayAnimationClass(this.playerPanel, "hud-pulse");
            }
            this.lastScore = score;
        }
        for (const [key, row] of this.rows) {
            const meta = STAT_META[key];
            const value = selfPlayer.stats[key];
            const isMax = value >= STAT_MAX_LEVEL;
            const canUpgrade = selfPlayer.upgradePoints > 0 && !isMax;
            const statusLabel = isMax ? "MAX" : canUpgrade ? "READY" : "LOCK";
            const statusClass = isMax
                ? "bg-slate-700 text-slate-200"
                : canUpgrade
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-slate-800 text-slate-400";
            row.title = meta.description;
            row.innerHTML = `<span class="flex items-center gap-2">${renderGlyph(meta.icon, meta.accentClass)}<span class="block leading-tight text-slate-100">${meta.label}</span></span><span class="flex flex-col items-end gap-1"><span class="text-cyan-200">+${value}</span><span class="rounded px-1.5 py-0.5 text-[10px] font-black ${statusClass}">${statusLabel}</span></span>`;
            const disabled = !canUpgrade;
            const upgradeReady = canUpgrade;
            this.applyDisabledStyle(row, disabled, upgradeReady);
        }
        const loadout = selfPlayer.abilityRuntime?.loadout ?? {};
        const cooldowns = selfPlayer.abilityRuntime?.cooldownEndsAtMs ?? {};
        const slotLabels = [
            { slot: AbilitySlot.RightClick, label: ABILITY_SLOT_LABEL[AbilitySlot.RightClick] },
            { slot: AbilitySlot.Slot1, label: ABILITY_SLOT_LABEL[AbilitySlot.Slot1] },
            { slot: AbilitySlot.Slot2, label: ABILITY_SLOT_LABEL[AbilitySlot.Slot2] },
            { slot: AbilitySlot.Ultimate, label: ABILITY_SLOT_LABEL[AbilitySlot.Ultimate] }
        ];
        for (const slotLabel of slotLabels) {
            const row = this.abilitySlotText.get(slotLabel.slot);
            if (!row) {
                continue;
            }
            const slotMeta = ABILITY_SLOT_META[slotLabel.slot];
            const abilityId = loadout[slotLabel.slot];
            if (!abilityId) {
                const unlockLevel = ABILITY_UNLOCK_LEVELS[slotLabel.slot];
                const isUnlocked = selfPlayer.level >= unlockLevel;
                row.title = isUnlocked
                    ? `Slot ${slotLabel.label} is unlocked. Choose an ability when offered.`
                    : `Unlocks at level ${unlockLevel}.`;
                row.className = `mt-2 rounded-xl border ${slotMeta.ringClass} bg-slate-950/95 px-3 py-2.5 text-xs text-slate-200 shadow-sm`;
                row.innerHTML = `<div class="flex items-center justify-between gap-2">${renderGlyph(slotLabel.label, slotMeta.accentClass)}<span class="flex-1 text-slate-200">${isUnlocked ? "Awaiting ability choice" : `Unlocks at lvl ${unlockLevel}`}</span><span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">${isUnlocked ? "OPEN" : "LOCKED"}</span></div>`;
                continue;
            }
            const ability = ABILITY_DEFINITIONS[abilityId];
            const remainingMs = Math.max(0, (cooldowns[slotLabel.slot] ?? 0) - serverTime);
            const ready = remainingMs <= 0;
            const progress = ready ? 1 : 1 - remainingMs / Math.max(1, ability.cooldownMs);
            const stateText = ready
                ? '<span class="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">READY</span>'
                : `<span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">${(remainingMs / 1000).toFixed(1)}s</span>`;
            row.title = ability.description;
            row.className = `mt-2 rounded-xl border ${slotMeta.ringClass} bg-slate-950/95 px-3 py-2.5 text-xs text-slate-200 shadow-sm`;
            row.innerHTML = `<div class="flex items-center justify-between gap-2">${renderGlyph(slotLabel.label, slotMeta.accentClass)}<span class="flex-1 truncate text-slate-100">${ability.name}</span>${stateText}</div>${this.renderCooldownBar(progress)}`;
        }
    }
}
//# sourceMappingURL=StatsHud.js.map