import "./index.css";
import { SfxManager } from "./audio/SfxManager";
import { InputController } from "./input/InputController";
import { ClientSocket } from "./net/ClientSocket";
import { CanvasRenderer } from "./render/CanvasRenderer";
import { InterpolationBuffer } from "./render/InterpolationBuffer";
import { ClientWorld } from "./state/ClientWorld";
import { GameplayEventDetector, GameplayEventType } from "./state/GameplayEventDetector";
import { StartScreen } from "./ui/StartScreen";
import { StatsHud } from "./ui/StatsHud";
const app = document.querySelector("#app");
if (!app) {
    throw new Error("Missing #app root");
}
app.className = "relative h-full w-full overflow-hidden";
const canvas = document.createElement("canvas");
canvas.className = "h-full w-full";
app.appendChild(canvas);
const renderer = new CanvasRenderer(canvas);
const worldState = new ClientWorld();
const interpolation = new InterpolationBuffer();
const gameplayEvents = new GameplayEventDetector();
const sfx = new SfxManager();
const REMOTE_AUDIO_NEAR_DISTANCE = 180;
const REMOTE_AUDIO_FAR_DISTANCE = 1100;
const REMOTE_AUDIO_SMOOTHING = 0.22;
const REMOTE_AUDIO_MIN_VOLUME = 0.01;
const MAX_FRAME_DELTA_SECONDS = 0.1;
const INPUT_TICK_RATE = 30;
const remoteAudioMixByPlayerId = new Map();
const smoothstep = (edge0, edge1, value) => {
    const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1, edge1 - edge0)));
    return t * t * (3 - 2 * t);
};
const computeDistanceVolume = (distance) => {
    if (distance <= REMOTE_AUDIO_NEAR_DISTANCE) {
        return 1;
    }
    if (distance >= REMOTE_AUDIO_FAR_DISTANCE) {
        return 0;
    }
    const fade = smoothstep(REMOTE_AUDIO_NEAR_DISTANCE, REMOTE_AUDIO_FAR_DISTANCE, distance);
    return 1 - fade;
};
let selfId = null;
let joined = false;
let latestInterpolated = interpolation.getInterpolated();
const statsHud = new StatsHud((stat) => {
    socketClient.upgradeStat({ stat });
}, ({ slot, abilityId }) => {
    socketClient.chooseAbility({ slot, abilityId });
}, {
    initialState: sfx.getSettings(),
    onToggleMute: () => {
        const current = sfx.getSettings();
        sfx.setMuted(!current.muted);
        statsHud.setAudioState(sfx.getSettings());
    },
    onVolumeChange: (volume) => {
        sfx.setVolume(volume);
        statsHud.setAudioState(sfx.getSettings());
    }
});
app.appendChild(statsHud.element);
window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !joined) {
        return;
    }
    event.preventDefault();
    statsHud.togglePauseMenu();
});
const defaultServerUrl = `${window.location.protocol === "https:" ? "https" : "http"}://${window.location.hostname || "127.0.0.1"}:3001`;
const socketClient = new ClientSocket({
    serverUrl: import.meta.env.VITE_SERVER_URL || defaultServerUrl,
    onJoinAck: (payload) => {
        selfId = payload.playerId;
        joined = true;
        startScreen.setLoading(false);
        startScreen.hide();
    },
    onWorldDelta: (delta) => {
        const state = worldState.applyDelta(delta);
        const events = gameplayEvents.consume(state);
        const selfPlayerSnapshot = selfId ? state.players.get(selfId) : undefined;
        if (!selfPlayerSnapshot || !selfId) {
            remoteAudioMixByPlayerId.clear();
        }
        else {
            const seenRemoteIds = new Set();
            for (const [playerId, player] of state.players) {
                if (playerId === selfId) {
                    continue;
                }
                seenRemoteIds.add(playerId);
                const distance = Math.hypot(player.x - selfPlayerSnapshot.x, player.y - selfPlayerSnapshot.y);
                const target = computeDistanceVolume(distance);
                const previous = remoteAudioMixByPlayerId.get(playerId) ?? target;
                const next = previous + (target - previous) * REMOTE_AUDIO_SMOOTHING;
                remoteAudioMixByPlayerId.set(playerId, next);
            }
            for (const playerId of [...remoteAudioMixByPlayerId.keys()]) {
                if (!seenRemoteIds.has(playerId)) {
                    remoteAudioMixByPlayerId.delete(playerId);
                }
            }
        }
        const getRemoteVolumeScale = (eventPlayerId) => {
            if (!eventPlayerId || eventPlayerId === selfId) {
                return 1;
            }
            return remoteAudioMixByPlayerId.get(eventPlayerId) ?? 0;
        };
        for (const event of events) {
            if (event.type === GameplayEventType.Shot) {
                const selfShot = event.playerId === selfId;
                const volumeScale = getRemoteVolumeScale(event.playerId);
                if (!selfShot && volumeScale <= REMOTE_AUDIO_MIN_VOLUME) {
                    continue;
                }
                sfx.playShot(selfShot, volumeScale);
                if (event.x !== undefined && event.y !== undefined) {
                    renderer.triggerShotEffect(event.x, event.y, event.rotation ?? 0);
                }
                continue;
            }
            if (event.type === GameplayEventType.Damage) {
                const selfDamage = event.playerId === selfId;
                const volumeScale = getRemoteVolumeScale(event.playerId);
                if (!selfDamage && volumeScale <= REMOTE_AUDIO_MIN_VOLUME) {
                    continue;
                }
                sfx.playHit(selfDamage, volumeScale);
                if (event.x !== undefined && event.y !== undefined) {
                    renderer.triggerHitEffect(event.x, event.y, selfDamage);
                }
                continue;
            }
            if (event.type === GameplayEventType.Death) {
                const selfDeath = event.playerId === selfId;
                const volumeScale = getRemoteVolumeScale(event.playerId);
                if (!selfDeath && volumeScale <= REMOTE_AUDIO_MIN_VOLUME) {
                    continue;
                }
                sfx.playDeath(selfDeath, volumeScale);
                if (event.x !== undefined && event.y !== undefined) {
                    renderer.triggerDeathEffect(event.x, event.y, selfDeath);
                }
                continue;
            }
            if (event.type === GameplayEventType.Respawn) {
                const selfRespawn = event.playerId === selfId;
                const volumeScale = getRemoteVolumeScale(event.playerId);
                if (!selfRespawn && volumeScale <= REMOTE_AUDIO_MIN_VOLUME) {
                    continue;
                }
                sfx.playRespawn(selfRespawn, volumeScale);
                if (event.x !== undefined && event.y !== undefined) {
                    renderer.triggerRespawnEffect(event.x, event.y);
                }
                continue;
            }
            if (event.type === GameplayEventType.Kill && event.playerId === selfId) {
                renderer.triggerKillFlash();
                continue;
            }
            if (event.type === GameplayEventType.ZoneCapturing) {
                const selfCapturing = event.playerId === selfId;
                const volumeScale = getRemoteVolumeScale(event.playerId);
                if (!selfCapturing && volumeScale <= REMOTE_AUDIO_MIN_VOLUME) {
                    continue;
                }
                sfx.playZoneCapturing(selfCapturing, event.amount ?? 0, volumeScale);
                continue;
            }
            if (event.type === GameplayEventType.ZoneContested) {
                sfx.playZoneContested();
                continue;
            }
            if (event.type === GameplayEventType.ZoneCaptured) {
                const selfCaptured = event.playerId === selfId;
                const volumeScale = getRemoteVolumeScale(event.playerId);
                if (!selfCaptured && volumeScale <= REMOTE_AUDIO_MIN_VOLUME) {
                    continue;
                }
                sfx.playZoneCaptured(selfCaptured, volumeScale);
            }
        }
        interpolation.push(state);
    },
    onAbilityOffer: (payload) => {
        statsHud.setAbilityOffer(payload);
    },
    onAbilityCastRejected: (payload) => {
        statsHud.showAbilityCastRejected(payload);
    },
    onRoundEnded: () => {
        sfx.playRoundEnded();
        renderer.triggerRoundTransition("ended");
    },
    onRoundReset: () => {
        sfx.playRoundReset();
        renderer.triggerRoundTransition("reset");
    }
});
const startScreen = new StartScreen((nickname) => {
    joined = false;
    selfId = null;
    sfx.unlock();
    startScreen.setLoading(true);
    socketClient.connect(nickname || "Tanker");
});
app.appendChild(startScreen.element);
const input = new InputController(canvas);
let accumulator = 0;
let lastFrame = performance.now();
const loop = (now) => {
    const deltaSeconds = Math.min(MAX_FRAME_DELTA_SECONDS, (now - lastFrame) / 1000);
    lastFrame = now;
    accumulator += deltaSeconds;
    latestInterpolated = interpolation.getInterpolated();
    renderer.render(latestInterpolated, selfId);
    const selfPlayer = latestInterpolated.players.find((player) => player.id === selfId);
    statsHud.update(selfPlayer, latestInterpolated.session, latestInterpolated.serverTime, selfId, socketClient.getPingMs());
    while (accumulator >= 1 / INPUT_TICK_RATE) {
        const mouse = input.getMouseScreenPosition();
        const worldMouse = renderer.screenToWorld(mouse.x, mouse.y, latestInterpolated, selfId);
        const allowInput = !latestInterpolated.session || latestInterpolated.session.phase === "in_progress";
        if (joined && selfId && allowInput) {
            socketClient.sendInput(input.buildInput(worldMouse.x, worldMouse.y));
            for (const trigger of input.consumeAbilityTriggers()) {
                socketClient.castAbility(trigger);
            }
        }
        accumulator -= 1 / INPUT_TICK_RATE;
    }
    requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
//# sourceMappingURL=main.js.map