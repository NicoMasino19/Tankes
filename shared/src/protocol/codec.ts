import { decode, encode } from "@msgpack/msgpack";
import type { WorldDeltaSnapshot } from "./snapshot";

export const NetworkCodecMode = {
  MsgPack: "msgpack",
  Json: "json"
} as const;

export type NetworkCodecMode = (typeof NetworkCodecMode)[keyof typeof NetworkCodecMode];

export interface NetworkCodec {
  encodeWorldUpdate(delta: WorldDeltaSnapshot): Uint8Array;
  decodeWorldUpdate(payload: ArrayBuffer | Uint8Array): WorldDeltaSnapshot;
}

export class MsgPackCodec implements NetworkCodec {
  encodeWorldUpdate(delta: WorldDeltaSnapshot): Uint8Array {
    return encode(delta);
  }

  decodeWorldUpdate(payload: ArrayBuffer | Uint8Array): WorldDeltaSnapshot {
    const input = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    return decode(input) as WorldDeltaSnapshot;
  }
}

export class JsonCodec implements NetworkCodec {
  encodeWorldUpdate(delta: WorldDeltaSnapshot): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(delta));
  }

  decodeWorldUpdate(payload: ArrayBuffer | Uint8Array): WorldDeltaSnapshot {
    const input = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    return JSON.parse(new TextDecoder().decode(input)) as WorldDeltaSnapshot;
  }
}

export const createNetworkCodec = (mode: NetworkCodecMode = NetworkCodecMode.MsgPack): NetworkCodec => {
  if (mode === NetworkCodecMode.Json) {
    return new JsonCodec();
  }
  return new MsgPackCodec();
};
