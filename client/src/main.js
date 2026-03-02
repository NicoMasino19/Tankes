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
let selfId = null;
let joined = false;
let latestInterpolated = interpolation.getInterpolated();
const statsHud = new StatsHud((stat) => {
    socketClient.upgradeStat({ stat });
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
const defaultServerUrl = `${window.location.protocol === "https:" ? "https" : "http"}://${window.location.hostname || "127.0.0.1"}:3001`;
const socketClient = new ClientSocket({
    serverUrl: import.meta.env.VITE_SERVER_URL ?? defaultServerUrl,
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
        for (const event of events) {
            if (event.type === GameplayEventType.Shot) {
                let volumeScale = 1;
                const selfShot = event.playerId === selfId;
                if (!selfShot && selfPlayerSnapshot && event.x !== undefined && event.y !== undefined) {
                    const distance = Math.hypot(event.x - selfPlayerSnapshot.x, event.y - selfPlayerSnapshot.y);
                    const nearDistance = 220;
                    const farDistance = 2600;
                    const normalized = Math.max(0, Math.min(1, (distance - nearDistance) / (farDistance - nearDistance)));
                    volumeScale = 1 - normalized;
                }
                sfx.playShot(selfShot, volumeScale);
                if (event.x !== undefined && event.y !== undefined) {
                    renderer.triggerShotEffect(event.x, event.y, event.rotation ?? 0);
                }
                continue;
            }
            if (event.type === GameplayEventType.Damage) {
                sfx.playHit(event.playerId === selfId);
                if (event.x !== undefined && event.y !== undefined) {
                    renderer.triggerHitEffect(event.x, event.y, event.playerId === selfId);
                }
                continue;
            }
            if (event.type === GameplayEventType.Death) {
                sfx.playDeath(event.playerId === selfId);
                if (event.x !== undefined && event.y !== undefined) {
                    renderer.triggerDeathEffect(event.x, event.y, event.playerId === selfId);
                }
                continue;
            }
            if (event.type === GameplayEventType.Respawn) {
                sfx.playRespawn(event.playerId === selfId);
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
                sfx.playZoneCapturing(event.playerId === selfId, event.amount ?? 0);
                continue;
            }
            if (event.type === GameplayEventType.ZoneContested) {
                sfx.playZoneContested();
                continue;
            }
            if (event.type === GameplayEventType.ZoneCaptured) {
                sfx.playZoneCaptured(event.playerId === selfId);
            }
        }
        interpolation.push(state);
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
    const deltaSeconds = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    accumulator += deltaSeconds;
    latestInterpolated = interpolation.getInterpolated();
    renderer.render(latestInterpolated, selfId);
    const selfPlayer = latestInterpolated.players.find((player) => player.id === selfId);
    statsHud.update(selfPlayer, latestInterpolated.session, latestInterpolated.serverTime, selfId);
    while (accumulator >= 1 / 30) {
        const mouse = input.getMouseScreenPosition();
        const worldMouse = renderer.screenToWorld(mouse.x, mouse.y, latestInterpolated, selfId);
        const allowInput = !latestInterpolated.session || latestInterpolated.session.phase === "in_progress";
        if (joined && selfId && allowInput) {
            socketClient.sendInput(input.buildInput(worldMouse.x, worldMouse.y));
        }
        accumulator -= 1 / 30;
    }
    requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
//# sourceMappingURL=main.js.map