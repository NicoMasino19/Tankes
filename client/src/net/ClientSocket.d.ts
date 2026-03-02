import { type InputState, type JoinAckPayload, type RoundEndedPayload, type RoundResetPayload, type UpgradeStatPayload, type WorldDeltaSnapshot } from "@tankes/shared";
interface ClientSocketOptions {
    serverUrl: string;
    onJoinAck: (payload: JoinAckPayload) => void;
    onWorldDelta: (delta: WorldDeltaSnapshot) => void;
    onRoundEnded?: (payload: RoundEndedPayload) => void;
    onRoundReset?: (payload: RoundResetPayload) => void;
}
export declare class ClientSocket {
    private readonly options;
    private readonly codec;
    private socket;
    private fallbackTried;
    private readonly resumeTokenKey;
    constructor(options: ClientSocketOptions);
    connect(nickname: string): void;
    private openSocket;
    sendInput(input: InputState): void;
    upgradeStat(payload: UpgradeStatPayload): void;
}
export {};
