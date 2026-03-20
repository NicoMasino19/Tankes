import { type AbilityId, type AbilityCastRejectedPayload, type AbilityOfferPayload, type AbilitySlot, type InputState, type JoinAckPayload, type RoundEndedPayload, type RoundResetPayload, type UpgradeStatPayload, type WorldDeltaSnapshot } from "@tankes/shared";
interface ClientSocketOptions {
    serverUrl: string;
    onJoinAck: (payload: JoinAckPayload) => void;
    onWorldDelta: (delta: WorldDeltaSnapshot) => void;
    onAbilityOffer?: (payload: AbilityOfferPayload) => void;
    onAbilityCastRejected?: (payload: AbilityCastRejectedPayload) => void;
    onRoundEnded?: (payload: RoundEndedPayload) => void;
    onRoundReset?: (payload: RoundResetPayload) => void;
}
export declare class ClientSocket {
    private readonly options;
    private readonly codec;
    private socket;
    private fallbackTried;
    private readonly resumeTokenKey;
    private pingProbeTimerId;
    private smoothedPingMs;
    constructor(options: ClientSocketOptions);
    connect(nickname: string): void;
    private openSocket;
    private startPingProbeLoop;
    private stopPingProbeLoop;
    getPingMs(): number | null;
    sendInput(input: InputState): void;
    upgradeStat(payload: UpgradeStatPayload): void;
    chooseAbility(payload: {
        slot: AbilitySlot;
        abilityId: AbilityId;
    }): void;
    castAbility(slot: AbilitySlot): void;
}
export {};
