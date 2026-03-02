import { createNetworkCodec, NetworkCodecMode, SocketEvents } from "@tankes/shared";
import { io } from "socket.io-client";
export class ClientSocket {
    options;
    codec = createNetworkCodec(import.meta.env.VITE_NET_CODEC === NetworkCodecMode.Json ? NetworkCodecMode.Json : NetworkCodecMode.MsgPack);
    socket = null;
    fallbackTried = false;
    resumeTokenKey = "tankes:resume-token";
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
        });
        socket.on("connect_error", (error) => {
            console.error("[socket] connect_error", error?.message ?? error);
            if (this.fallbackTried || primaryUrl.hostname !== "localhost") {
                return;
            }
            const fallbackUrl = new URL(primaryUrl.toString());
            fallbackUrl.hostname = "127.0.0.1";
            this.fallbackTried = true;
            socket.removeAllListeners();
            socket.close();
            this.socket = this.openSocket(fallbackUrl.toString(), nickname, primaryUrl);
        });
        socket.on("disconnect", (reason) => {
            console.warn("[socket] disconnect", reason);
        });
        socket.on(SocketEvents.JoinAck, (payload) => {
            if (typeof payload.resumeToken === "string" && payload.resumeToken.length > 0) {
                window.localStorage.setItem(this.resumeTokenKey, payload.resumeToken);
            }
            this.options.onJoinAck(payload);
        });
        socket.on(SocketEvents.WorldUpdate, (payload) => {
            const delta = this.codec.decodeWorldUpdate(payload);
            this.options.onWorldDelta(delta);
        });
        socket.on(SocketEvents.RoundEnded, (payload) => {
            this.options.onRoundEnded?.(payload);
        });
        socket.on(SocketEvents.RoundReset, (payload) => {
            this.options.onRoundReset?.(payload);
        });
        return socket;
    }
    sendInput(input) {
        this.socket?.emit(SocketEvents.Input, input);
    }
    upgradeStat(payload) {
        this.socket?.emit(SocketEvents.UpgradeStat, payload);
    }
}
//# sourceMappingURL=ClientSocket.js.map