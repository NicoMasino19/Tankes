import { createNetworkCodec, NET_PING_PROBE_INTERVAL_MS, NET_PING_SMOOTHING_ALPHA, NetworkCodecMode, SocketEvents } from "@tankes/shared";
import { io } from "socket.io-client";
export class ClientSocket {
    options;
    codec = createNetworkCodec(import.meta.env.VITE_NET_CODEC === NetworkCodecMode.Json ? NetworkCodecMode.Json : NetworkCodecMode.MsgPack);
    socket = null;
    fallbackTried = false;
    resumeTokenKey = "tankes:resume-token";
    pingProbeTimerId = null;
    smoothedPingMs = null;
    constructor(options) {
        this.options = options;
    }
    connect(nickname) {
        if (this.socket?.connected) {
            return;
        }
        this.socket?.removeAllListeners();
        this.socket?.close();
        const primaryUrl = new URL(this.options.serverUrl, window.location.origin);
        this.fallbackTried = false;
        this.socket = this.openSocket(primaryUrl.toString(), nickname, primaryUrl);
    }
    openSocket(connectionUrl, nickname, primaryUrl) {
        const socket = io(connectionUrl, {
            transports: ["websocket", "polling"],
            timeout: 8_000
        });
        socket.on("connect", () => {
            const resumeToken = window.localStorage.getItem(this.resumeTokenKey) ?? undefined;
            const payload = resumeToken ? { nickname, resumeToken } : { nickname };
            socket.emit(SocketEvents.Join, payload);
            this.startPingProbeLoop(socket);
        });
        socket.on("connect_error", (error) => {
            console.error("[socket] connect_error", error?.message ?? error);
            if (this.fallbackTried || primaryUrl.hostname !== "localhost") {
                return;
            }
            const fallbackUrl = new URL(primaryUrl.toString());
            fallbackUrl.hostname = "127.0.0.1";
            this.fallbackTried = true;
            this.stopPingProbeLoop();
            socket.removeAllListeners();
            socket.close();
            this.socket = this.openSocket(fallbackUrl.toString(), nickname, primaryUrl);
        });
        socket.on("disconnect", (reason) => {
            console.warn("[socket] disconnect", reason);
            this.stopPingProbeLoop();
        });
        socket.on(SocketEvents.JoinAck, (payload) => {
            if (typeof payload.resumeToken === "string" && payload.resumeToken.length > 0) {
                window.localStorage.setItem(this.resumeTokenKey, payload.resumeToken);
            }
            this.options.onJoinAck(payload);
        });
        socket.on(SocketEvents.WorldUpdate, (payload) => {
            try {
                const delta = this.codec.decodeWorldUpdate(payload);
                this.options.onWorldDelta(delta);
            }
            catch {
                // Malformed snapshot — drop frame silently
            }
        });
        socket.on(SocketEvents.RoundEnded, (payload) => {
            this.options.onRoundEnded?.(payload);
        });
        socket.on(SocketEvents.RoundReset, (payload) => {
            this.options.onRoundReset?.(payload);
        });
        socket.on(SocketEvents.PingAck, (payload) => {
            const roundTripMs = Date.now() - payload.clientSentAtMs;
            if (!Number.isFinite(roundTripMs) || roundTripMs < 0 || roundTripMs > 60_000) {
                return;
            }
            if (this.smoothedPingMs === null) {
                this.smoothedPingMs = roundTripMs;
                return;
            }
            this.smoothedPingMs =
                this.smoothedPingMs + (roundTripMs - this.smoothedPingMs) * NET_PING_SMOOTHING_ALPHA;
        });
        socket.on(SocketEvents.AbilityOffer, (payload) => {
            this.options.onAbilityOffer?.(payload);
        });
        socket.on(SocketEvents.AbilityCastRejected, (payload) => {
            this.options.onAbilityCastRejected?.(payload);
        });
        return socket;
    }
    startPingProbeLoop(socket) {
        this.stopPingProbeLoop();
        const sendPingProbe = () => {
            if (!socket.connected || document.visibilityState === "hidden") {
                return;
            }
            const pingProbe = {
                clientSentAtMs: Date.now()
            };
            socket.emit(SocketEvents.Ping, pingProbe);
        };
        sendPingProbe();
        this.pingProbeTimerId = window.setInterval(sendPingProbe, NET_PING_PROBE_INTERVAL_MS);
    }
    stopPingProbeLoop() {
        if (this.pingProbeTimerId !== null) {
            window.clearInterval(this.pingProbeTimerId);
            this.pingProbeTimerId = null;
        }
        this.smoothedPingMs = null;
    }
    getPingMs() {
        if (this.smoothedPingMs === null) {
            return null;
        }
        return Math.max(0, Math.round(this.smoothedPingMs));
    }
    sendInput(input) {
        this.socket?.emit(SocketEvents.Input, input);
    }
    upgradeStat(payload) {
        this.socket?.emit(SocketEvents.UpgradeStat, payload);
    }
    chooseAbility(payload) {
        this.socket?.emit(SocketEvents.ChooseAbility, payload);
    }
    castAbility(slot) {
        this.socket?.emit(SocketEvents.CastAbility, { slot });
    }
}
//# sourceMappingURL=ClientSocket.js.map