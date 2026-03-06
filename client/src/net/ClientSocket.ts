import {
  type AbilityId,
  type AbilityCastRejectedPayload,
  type AbilityOfferPayload,
  type AbilitySlot,
  createNetworkCodec,
  NET_PING_PROBE_INTERVAL_MS,
  NET_PING_SMOOTHING_ALPHA,
  NetworkCodecMode,
  SocketEvents,
  type InputState,
  type JoinAckPayload,
  type JoinPayload,
  type PingAckPayload,
  type PingProbePayload,
  type RoundEndedPayload,
  type RoundResetPayload,
  type UpgradeStatPayload,
  type WorldDeltaSnapshot
} from "@tankes/shared";
import { io, type Socket } from "socket.io-client";

interface ClientSocketOptions {
  serverUrl: string;
  onJoinAck: (payload: JoinAckPayload) => void;
  onWorldDelta: (delta: WorldDeltaSnapshot) => void;
  onAbilityOffer?: (payload: AbilityOfferPayload) => void;
  onAbilityCastRejected?: (payload: AbilityCastRejectedPayload) => void;
  onRoundEnded?: (payload: RoundEndedPayload) => void;
  onRoundReset?: (payload: RoundResetPayload) => void;
}

export class ClientSocket {
  private readonly codec = createNetworkCodec(
    import.meta.env.VITE_NET_CODEC === NetworkCodecMode.Json ? NetworkCodecMode.Json : NetworkCodecMode.MsgPack
  );
  private socket: Socket | null = null;
  private fallbackTried = false;
  private readonly resumeTokenKey = "tankes:resume-token";
  private pingProbeTimerId: number | null = null;
  private smoothedPingMs: number | null = null;

  constructor(private readonly options: ClientSocketOptions) {}

  connect(nickname: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket?.removeAllListeners();
    this.socket?.close();

    const primaryUrl = new URL(this.options.serverUrl, window.location.origin);
    this.fallbackTried = false;
    this.socket = this.openSocket(primaryUrl.toString(), nickname, primaryUrl);
  }

  private openSocket(connectionUrl: string, nickname: string, primaryUrl: URL): Socket {
    const socket = io(connectionUrl, {
      transports: ["websocket", "polling"],
      timeout: 8_000
    });

    socket.on("connect", () => {
      const resumeToken = window.localStorage.getItem(this.resumeTokenKey) ?? undefined;
      const payload: JoinPayload = resumeToken ? { nickname, resumeToken } : { nickname };
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

    socket.on(SocketEvents.JoinAck, (payload: JoinAckPayload) => {
      if (typeof payload.resumeToken === "string" && payload.resumeToken.length > 0) {
        window.localStorage.setItem(this.resumeTokenKey, payload.resumeToken);
      }
      this.options.onJoinAck(payload);
    });

    socket.on(SocketEvents.WorldUpdate, (payload: ArrayBuffer | Uint8Array) => {
      const delta = this.codec.decodeWorldUpdate(payload);
      this.options.onWorldDelta(delta);
    });

    socket.on(SocketEvents.RoundEnded, (payload: RoundEndedPayload) => {
      this.options.onRoundEnded?.(payload);
    });

    socket.on(SocketEvents.RoundReset, (payload: RoundResetPayload) => {
      this.options.onRoundReset?.(payload);
    });

    socket.on(SocketEvents.PingAck, (payload: PingAckPayload) => {
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

    socket.on(SocketEvents.AbilityOffer, (payload: AbilityOfferPayload) => {
      this.options.onAbilityOffer?.(payload);
    });

    socket.on(SocketEvents.AbilityCastRejected, (payload: AbilityCastRejectedPayload) => {
      this.options.onAbilityCastRejected?.(payload);
    });

    return socket;
  }

  private startPingProbeLoop(socket: Socket): void {
    this.stopPingProbeLoop();

    const sendPingProbe = () => {
      if (!socket.connected || document.visibilityState === "hidden") {
        return;
      }

      const pingProbe: PingProbePayload = {
        clientSentAtMs: Date.now()
      };
      socket.emit(SocketEvents.Ping, pingProbe);
    };

    sendPingProbe();
    this.pingProbeTimerId = window.setInterval(sendPingProbe, NET_PING_PROBE_INTERVAL_MS);
  }

  private stopPingProbeLoop(): void {
    if (this.pingProbeTimerId !== null) {
      window.clearInterval(this.pingProbeTimerId);
      this.pingProbeTimerId = null;
    }

    this.smoothedPingMs = null;
  }

  getPingMs(): number | null {
    if (this.smoothedPingMs === null) {
      return null;
    }

    return Math.max(0, Math.round(this.smoothedPingMs));
  }

  sendInput(input: InputState): void {
    this.socket?.emit(SocketEvents.Input, input);
  }

  upgradeStat(payload: UpgradeStatPayload): void {
    this.socket?.emit(SocketEvents.UpgradeStat, payload);
  }

  chooseAbility(payload: { slot: AbilitySlot; abilityId: AbilityId }): void {
    this.socket?.emit(SocketEvents.ChooseAbility, payload);
  }

  castAbility(slot: AbilitySlot): void {
    this.socket?.emit(SocketEvents.CastAbility, { slot });
  }
}
