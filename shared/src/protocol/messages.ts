import type {
  AbilityCastRejectedPayload,
  AbilityOfferPayload,
  CastAbilityPayload,
  ChooseAbilityPayload,
  InputState,
  JoinAckPayload,
  JoinPayload,
  PingAckPayload,
  PingProbePayload,
  RoundEndedPayload,
  RoundResetPayload,
  UpgradeStatPayload
} from "../game/types";
import type { WorldDeltaSnapshot } from "./snapshot";

export const SocketEvents = {
  Join: "join",
  JoinAck: "join:ack",
  Input: "input",
  UpgradeStat: "stat:upgrade",
  ChooseAbility: "ability:choose",
  CastAbility: "ability:cast",
  Ping: "net:ping",
  PingAck: "net:ping:ack",
  AbilityOffer: "ability:offer",
  AbilityCastRejected: "ability:cast:rejected",
  WorldUpdate: "world:update:bin",
  RoundEnded: "round:ended",
  RoundReset: "round:reset"
} as const;

export interface ClientToServerPayloads {
  [SocketEvents.Join]: JoinPayload;
  [SocketEvents.Input]: InputState;
  [SocketEvents.UpgradeStat]: UpgradeStatPayload;
  [SocketEvents.ChooseAbility]: ChooseAbilityPayload;
  [SocketEvents.CastAbility]: CastAbilityPayload;
  [SocketEvents.Ping]: PingProbePayload;
}

export interface ServerToClientPayloads {
  [SocketEvents.JoinAck]: JoinAckPayload;
  [SocketEvents.PingAck]: PingAckPayload;
  [SocketEvents.AbilityOffer]: AbilityOfferPayload;
  [SocketEvents.AbilityCastRejected]: AbilityCastRejectedPayload;
  [SocketEvents.WorldUpdate]: WorldDeltaSnapshot | ArrayBuffer | Uint8Array;
  [SocketEvents.RoundEnded]: RoundEndedPayload;
  [SocketEvents.RoundReset]: RoundResetPayload;
}
