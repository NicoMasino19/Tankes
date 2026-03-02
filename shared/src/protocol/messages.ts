import type {
  InputState,
  JoinAckPayload,
  JoinPayload,
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
  WorldUpdate: "world:update:bin",
  RoundEnded: "round:ended",
  RoundReset: "round:reset"
} as const;

export interface ClientToServerPayloads {
  [SocketEvents.Join]: JoinPayload;
  [SocketEvents.Input]: InputState;
  [SocketEvents.UpgradeStat]: UpgradeStatPayload;
}

export interface ServerToClientPayloads {
  [SocketEvents.JoinAck]: JoinAckPayload;
  [SocketEvents.WorldUpdate]: WorldDeltaSnapshot | ArrayBuffer | Uint8Array;
  [SocketEvents.RoundEnded]: RoundEndedPayload;
  [SocketEvents.RoundReset]: RoundResetPayload;
}
