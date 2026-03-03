import type {
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
  Ping: "net:ping",
  PingAck: "net:ping:ack",
  WorldUpdate: "world:update:bin",
  RoundEnded: "round:ended",
  RoundReset: "round:reset"
} as const;

export interface ClientToServerPayloads {
  [SocketEvents.Join]: JoinPayload;
  [SocketEvents.Input]: InputState;
  [SocketEvents.UpgradeStat]: UpgradeStatPayload;
  [SocketEvents.Ping]: PingProbePayload;
}

export interface ServerToClientPayloads {
  [SocketEvents.JoinAck]: JoinAckPayload;
  [SocketEvents.PingAck]: PingAckPayload;
  [SocketEvents.WorldUpdate]: WorldDeltaSnapshot | ArrayBuffer | Uint8Array;
  [SocketEvents.RoundEnded]: RoundEndedPayload;
  [SocketEvents.RoundReset]: RoundResetPayload;
}
