import type { AbilityVfxCue, MatchState } from "../game/types";
import type { WorldDeltaSnapshot } from "./snapshot";

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const ensureArray = <T>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];

const ensureStringArray = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === "string");
};

export const validateWorldDelta = (raw: unknown): WorldDeltaSnapshot => {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    throw new Error("WorldDeltaSnapshot: expected object");
  }

  const obj = raw as Record<string, unknown>;

  if (!isFiniteNumber(obj.tick)) {
    throw new Error("WorldDeltaSnapshot: tick must be a finite number");
  }

  if (!isFiniteNumber(obj.serverTime)) {
    throw new Error("WorldDeltaSnapshot: serverTime must be a finite number");
  }

  const delta: WorldDeltaSnapshot = {
    tick: obj.tick,
    serverTime: obj.serverTime,
    playersUpsert: ensureArray(obj.playersUpsert),
    playersRemove: ensureStringArray(obj.playersRemove),
    bulletsUpsert: ensureArray(obj.bulletsUpsert),
    bulletsRemove: ensureStringArray(obj.bulletsRemove),
    shapesUpsert: ensureArray(obj.shapesUpsert),
    shapesRemove: ensureStringArray(obj.shapesRemove),
    zonesUpsert: ensureArray(obj.zonesUpsert),
    zonesRemove: ensureStringArray(obj.zonesRemove),
    powerUpsUpsert: ensureArray(obj.powerUpsUpsert),
    powerUpsRemove: ensureStringArray(obj.powerUpsRemove)
  };

  if (obj.abilityVfxCues !== undefined && Array.isArray(obj.abilityVfxCues)) {
    delta.abilityVfxCues = obj.abilityVfxCues as AbilityVfxCue[];
  }

  if (obj.session !== undefined && obj.session !== null && typeof obj.session === "object") {
    delta.session = obj.session as MatchState;
  }

  return delta;
};
