import {
  STAT_KEYS,
  type AbilityId,
  type AbilitySlot,
  type CastAbilityPayload,
  type ChooseAbilityPayload,
  type InputState,
  type JoinPayload,
  type PingProbePayload,
  type StatKey,
  type UpgradeStatPayload
} from "@tankes/shared";

export interface JoinRequest {
  nickname: string;
  resumeToken?: string;
}

const MAX_INPUT_SEQUENCE = 2_147_483_647;
const NICKNAME_ALLOWED = /[^A-Za-z0-9 _-]/g;

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sanitizeNickname = (nickname: unknown): string => {
  if (typeof nickname !== "string") {
    return "Tanker";
  }

  const cleaned = nickname.replace(NICKNAME_ALLOWED, "").trim().slice(0, 16);
  return cleaned || "Tanker";
};

export const sanitizeJoinPayload = (payload: unknown): JoinRequest => {
  const base = payload && typeof payload === "object" ? (payload as Partial<JoinPayload>) : {};
  const nickname = sanitizeNickname(base.nickname);

  if (typeof base.resumeToken !== "string") {
    return { nickname };
  }

  const token = base.resumeToken.trim();
  if (!token || token.length > 128) {
    return { nickname };
  }

  return {
    nickname,
    resumeToken: token
  };
};

export const sanitizeInputState = (payload: unknown): InputState | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const input = payload as Partial<InputState>;
  if (
    !isBoolean(input.up) ||
    !isBoolean(input.down) ||
    !isBoolean(input.left) ||
    !isBoolean(input.right) ||
    !isBoolean(input.shoot) ||
    !isFiniteNumber(input.aimX) ||
    !isFiniteNumber(input.aimY) ||
    !isFiniteNumber(input.sequence)
  ) {
    return null;
  }

  return {
    up: input.up,
    down: input.down,
    left: input.left,
    right: input.right,
    shoot: input.shoot,
    aimX: clamp(input.aimX, -100_000, 100_000),
    aimY: clamp(input.aimY, -100_000, 100_000),
    sequence: clamp(Math.trunc(input.sequence), 0, MAX_INPUT_SEQUENCE)
  };
};

export const sanitizeUpgradePayload = (payload: unknown): UpgradeStatPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const statCandidate = (payload as Partial<UpgradeStatPayload>).stat;
  if (typeof statCandidate !== "string") {
    return null;
  }

  if (!STAT_KEYS.includes(statCandidate as StatKey)) {
    return null;
  }

  return { stat: statCandidate as StatKey };
};

const ABILITY_SLOTS: AbilitySlot[] = ["right_click", "slot_1", "slot_2", "slot_3"];
const ABILITY_IDS: AbilityId[] = [
  "dash_vectorial",
  "emp_pulse",
  "reactive_shield",
  "piercing_burst",
  "proximity_mine",
  "light_turret",
  "tank_repair",
  "tactical_fog",
  "overheat",
  "orbital_barrage",
  "siege_mode",
  "homing_missile"
];

export const sanitizeCastAbilityPayload = (payload: unknown): CastAbilityPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const slot = (payload as Partial<CastAbilityPayload>).slot;
  if (typeof slot !== "string" || !ABILITY_SLOTS.includes(slot as AbilitySlot)) {
    return null;
  }

  return { slot: slot as AbilitySlot };
};

export const sanitizeChooseAbilityPayload = (payload: unknown): ChooseAbilityPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const slot = (payload as Partial<ChooseAbilityPayload>).slot;
  const abilityId = (payload as Partial<ChooseAbilityPayload>).abilityId;
  if (
    typeof slot !== "string" ||
    typeof abilityId !== "string" ||
    !ABILITY_SLOTS.includes(slot as AbilitySlot) ||
    !ABILITY_IDS.includes(abilityId as AbilityId)
  ) {
    return null;
  }

  return {
    slot: slot as AbilitySlot,
    abilityId: abilityId as AbilityId
  };
};

export const sanitizePingPayload = (payload: unknown): PingProbePayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const clientSentAtMs = (payload as Partial<PingProbePayload>).clientSentAtMs;
  if (!isFiniteNumber(clientSentAtMs) || clientSentAtMs <= 0) {
    return null;
  }

  return {
    clientSentAtMs: Math.trunc(clientSentAtMs)
  };
};
