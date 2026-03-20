import {
  AbilityId,
  AbilityVfxPhase,
  PLAYER_RADIUS,
  type AbilityVfxCue
} from "@tankes/shared";

export interface DashEffect { x: number; y: number; rotation: number; life: number; maxLife: number }
export interface EmpEffect { x: number; y: number; radius: number; life: number; maxLife: number }
export interface ShieldAuraEffect { playerId: string; expiresAtMs: number; radius: number }
export interface BurstEffect { x: number; y: number; rotation: number; life: number; maxLife: number; radius: number }
export interface MineEffect { x: number; y: number; life: number; maxLife: number; radius: number; color: string; fillAlpha: number; strokeAlpha: number }
export interface MineNodeEffect { playerId: string; x: number; y: number; createdAtMs: number; expiresAtMs: number; radius: number }
export interface TurretPulseEffect { x: number; y: number; rotation: number; length: number; life: number; maxLife: number }
export interface TurretNodeEffect { playerId: string; x: number; y: number; expiresAtMs: number; radius: number }
export interface RepairEffect { x: number; y: number; radius: number; life: number; maxLife: number }
export interface FogEffect { x: number; y: number; radius: number; life: number; maxLife: number }
export interface FogZoneEffect { playerId: string; x: number; y: number; expiresAtMs: number; radius: number }
export interface OverheatAuraEffect { playerId: string; overheatEndsAtMs: number; penaltyEndsAtMs: number; radius: number }
export interface OrbitalEffect { x: number; y: number; radius: number; life: number; maxLife: number }
export interface SiegeAuraEffect { playerId: string; expiresAtMs: number; radius: number }
export interface HomingTrailEffect { x: number; y: number; rotation: number; length: number; life: number; maxLife: number }
export interface HomingImpactEffect { x: number; y: number; radius: number; life: number; maxLife: number }

export interface VfxEffectArrays {
  dashEffects: DashEffect[];
  empEffects: EmpEffect[];
  burstEffects: BurstEffect[];
  mineEffects: MineEffect[];
  turretPulseEffects: TurretPulseEffect[];
  repairEffects: RepairEffect[];
  fogEffects: FogEffect[];
  orbitalEffects: OrbitalEffect[];
  homingTrailEffects: HomingTrailEffect[];
  homingImpactEffects: HomingImpactEffect[];

  shieldAuras: Map<string, ShieldAuraEffect>;
  mineNodes: Map<string, MineNodeEffect>;
  turretNodes: Map<string, TurretNodeEffect>;
  fogZones: Map<string, FogZoneEffect>;
  overheatAuras: Map<string, OverheatAuraEffect>;
  siegeAuras: Map<string, SiegeAuraEffect>;

  maxDashEffects: number;
  maxEmpEffects: number;
  maxBurstEffects: number;
  maxMineEffects: number;
  maxTurretPulses: number;
  maxRepairEffects: number;
  maxFogEffects: number;
  maxOrbitalEffects: number;
  maxHomingTrails: number;
  maxHomingImpacts: number;
}

const trim = <T>(arr: T[], max: number): void => {
  if (arr.length > max) arr.splice(0, arr.length - max);
};

function handleDash(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase !== AbilityVfxPhase.Cast) return;
  fx.dashEffects.push({ x: cue.x, y: cue.y, rotation: cue.rotation ?? 0, life: 0.34, maxLife: 0.34 });
  trim(fx.dashEffects, fx.maxDashEffects);
}

function handleEmp(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase !== AbilityVfxPhase.Pulse) return;
  fx.empEffects.push({ x: cue.x, y: cue.y, radius: (cue.radius ?? 200) * 1.2, life: 0.54, maxLife: 0.54 });
  trim(fx.empEffects, fx.maxEmpEffects);
}

function handleReactiveShield(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase === AbilityVfxPhase.Cast) {
    fx.shieldAuras.set(cue.casterPlayerId, {
      playerId: cue.casterPlayerId,
      expiresAtMs: cue.createdAtMs + (cue.durationMs ?? 1_500),
      radius: cue.radius ?? PLAYER_RADIUS + 10
    });
  } else if (cue.phase === AbilityVfxPhase.Expire) {
    fx.shieldAuras.delete(cue.casterPlayerId);
  }
}

function handlePiercingBurst(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase !== AbilityVfxPhase.Cast) return;
  fx.burstEffects.push({
    x: cue.x, y: cue.y, rotation: cue.rotation ?? 0,
    radius: (cue.radius ?? 140) * 1.35, life: 0.3, maxLife: 0.3
  });
  trim(fx.burstEffects, fx.maxBurstEffects);
}

function handleProximityMine(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase === AbilityVfxPhase.Cast) {
    fx.mineNodes.set(cue.casterPlayerId, {
      playerId: cue.casterPlayerId, x: cue.x, y: cue.y,
      createdAtMs: cue.createdAtMs, expiresAtMs: cue.createdAtMs + (cue.durationMs ?? 10_000),
      radius: cue.radius ?? 180
    });
    fx.mineEffects.push({
      x: cue.x, y: cue.y, radius: (cue.radius ?? 180) * 0.52,
      life: 0.34, maxLife: 0.34, color: "#f97316", fillAlpha: 0.24, strokeAlpha: 0.95
    });
    trim(fx.mineEffects, fx.maxMineEffects);
  } else if (cue.phase === AbilityVfxPhase.Impact) {
    fx.mineNodes.delete(cue.casterPlayerId);
    fx.mineEffects.push({
      x: cue.x, y: cue.y, radius: (cue.radius ?? 180) * 1.36,
      life: 0.58, maxLife: 0.58, color: "#fb7185", fillAlpha: 0.56, strokeAlpha: 1
    });
    trim(fx.mineEffects, fx.maxMineEffects);
  } else if (cue.phase === AbilityVfxPhase.Expire) {
    fx.mineNodes.delete(cue.casterPlayerId);
    fx.mineEffects.push({
      x: cue.x, y: cue.y, radius: (cue.radius ?? 180) * 0.5,
      life: 0.22, maxLife: 0.22, color: "#f59e0b", fillAlpha: 0.14, strokeAlpha: 0.6
    });
    trim(fx.mineEffects, fx.maxMineEffects);
  }
}

function handleLightTurret(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase === AbilityVfxPhase.Cast) {
    fx.turretNodes.set(cue.casterPlayerId, {
      playerId: cue.casterPlayerId, x: cue.x, y: cue.y,
      expiresAtMs: cue.createdAtMs + (cue.durationMs ?? 6_000), radius: cue.radius ?? 24
    });
  } else if (cue.phase === AbilityVfxPhase.Pulse) {
    fx.turretPulseEffects.push({
      x: cue.x, y: cue.y, rotation: cue.rotation ?? 0,
      length: (cue.radius ?? 80) * 1.15, life: 0.2, maxLife: 0.2
    });
    trim(fx.turretPulseEffects, fx.maxTurretPulses);
  } else if (cue.phase === AbilityVfxPhase.Expire) {
    fx.turretNodes.delete(cue.casterPlayerId);
    fx.mineEffects.push({
      x: cue.x, y: cue.y, radius: cue.radius ?? 24,
      life: 0.2, maxLife: 0.2, color: "#22d3ee", fillAlpha: 0.2, strokeAlpha: 0.85
    });
    trim(fx.mineEffects, fx.maxMineEffects);
  }
}

function handleTankRepair(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase !== AbilityVfxPhase.Cast) return;
  fx.repairEffects.push({
    x: cue.x, y: cue.y, radius: (cue.radius ?? PLAYER_RADIUS + 16) * 1.3,
    life: 0.46, maxLife: 0.46
  });
  trim(fx.repairEffects, fx.maxRepairEffects);
}

function handleTacticalFog(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase === AbilityVfxPhase.Cast) {
    fx.fogZones.set(cue.casterPlayerId, {
      playerId: cue.casterPlayerId, x: cue.x, y: cue.y,
      expiresAtMs: cue.createdAtMs + (cue.durationMs ?? 6_500), radius: (cue.radius ?? 380) * 1.08
    });
    fx.fogEffects.push({ x: cue.x, y: cue.y, radius: (cue.radius ?? 380) * 1.2, life: 0.9, maxLife: 0.9 });
    trim(fx.fogEffects, fx.maxFogEffects);
  } else if (cue.phase === AbilityVfxPhase.Pulse) {
    fx.fogEffects.push({ x: cue.x, y: cue.y, radius: (cue.radius ?? 380) * 1.28, life: 1.1, maxLife: 1.1 });
    trim(fx.fogEffects, fx.maxFogEffects);
  } else if (cue.phase === AbilityVfxPhase.Expire) {
    fx.fogZones.delete(cue.casterPlayerId);
    fx.fogEffects.push({ x: cue.x, y: cue.y, radius: (cue.radius ?? 380) * 1.04, life: 0.45, maxLife: 0.45 });
    trim(fx.fogEffects, fx.maxFogEffects);
  }
}

function handleOverheat(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase === AbilityVfxPhase.Cast) {
    const overheatEndsAtMs = cue.createdAtMs + (cue.durationMs ?? 4_000);
    fx.overheatAuras.set(cue.casterPlayerId, {
      playerId: cue.casterPlayerId, overheatEndsAtMs, penaltyEndsAtMs: overheatEndsAtMs,
      radius: cue.radius ?? PLAYER_RADIUS + 16
    });
  } else if (cue.phase === AbilityVfxPhase.Expire) {
    const previous = fx.overheatAuras.get(cue.casterPlayerId);
    fx.overheatAuras.set(cue.casterPlayerId, {
      playerId: cue.casterPlayerId, overheatEndsAtMs: cue.createdAtMs,
      penaltyEndsAtMs: cue.createdAtMs + (cue.durationMs ?? 1_000),
      radius: cue.radius ?? previous?.radius ?? PLAYER_RADIUS + 16
    });
  }
}

function handleOrbitalBarrage(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase === AbilityVfxPhase.Cast) {
    fx.orbitalEffects.push({ x: cue.x, y: cue.y, radius: (cue.radius ?? 180) * 0.9, life: 0.28, maxLife: 0.28 });
    trim(fx.orbitalEffects, fx.maxOrbitalEffects);
  } else if (cue.phase === AbilityVfxPhase.Pulse) {
    fx.orbitalEffects.push({ x: cue.x, y: cue.y, radius: (cue.radius ?? 180) * 1.25, life: 0.56, maxLife: 0.56 });
    trim(fx.orbitalEffects, fx.maxOrbitalEffects);
  }
}

function handleSiegeMode(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase === AbilityVfxPhase.Cast) {
    fx.siegeAuras.set(cue.casterPlayerId, {
      playerId: cue.casterPlayerId, expiresAtMs: cue.createdAtMs + (cue.durationMs ?? 5_000),
      radius: cue.radius ?? PLAYER_RADIUS + 22
    });
  } else if (cue.phase === AbilityVfxPhase.Expire) {
    fx.siegeAuras.delete(cue.casterPlayerId);
  }
}

function handleHomingMissile(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  if (cue.phase === AbilityVfxPhase.Cast) {
    fx.homingTrailEffects.push({
      x: cue.x, y: cue.y, rotation: cue.rotation ?? 0,
      length: (cue.radius ?? 180) * 1.25, life: 0.24, maxLife: 0.24
    });
    trim(fx.homingTrailEffects, fx.maxHomingTrails);
  } else if (cue.phase === AbilityVfxPhase.Impact) {
    fx.homingImpactEffects.push({
      x: cue.x, y: cue.y, radius: (cue.radius ?? 130) * 1.3, life: 0.48, maxLife: 0.48
    });
    trim(fx.homingImpactEffects, fx.maxHomingImpacts);
  }
}

type VfxHandler = (cue: AbilityVfxCue, fx: VfxEffectArrays) => void;

const VFX_HANDLERS: Partial<Record<string, VfxHandler>> = {
  [AbilityId.DashVectorial]: handleDash,
  [AbilityId.EmpPulse]: handleEmp,
  [AbilityId.ReactiveShield]: handleReactiveShield,
  [AbilityId.PiercingBurst]: handlePiercingBurst,
  [AbilityId.ProximityMine]: handleProximityMine,
  [AbilityId.LightTurret]: handleLightTurret,
  [AbilityId.TankRepair]: handleTankRepair,
  [AbilityId.TacticalFog]: handleTacticalFog,
  [AbilityId.Overheat]: handleOverheat,
  [AbilityId.OrbitalBarrage]: handleOrbitalBarrage,
  [AbilityId.SiegeMode]: handleSiegeMode,
  [AbilityId.HomingMissile]: handleHomingMissile
};

export function dispatchAbilityVfxCue(cue: AbilityVfxCue, fx: VfxEffectArrays): void {
  const handler = VFX_HANDLERS[cue.abilityId];
  if (handler) handler(cue, fx);
}

export function cleanupExpiredVfx(serverTime: number, fx: VfxEffectArrays, seenCues: Map<string, number>): void {
  for (const [cueId, expiresAtMs] of seenCues.entries()) {
    if (expiresAtMs <= serverTime) seenCues.delete(cueId);
  }
  for (const [playerId, node] of fx.turretNodes.entries()) {
    if (node.expiresAtMs <= serverTime) fx.turretNodes.delete(playerId);
  }
  for (const [playerId, node] of fx.mineNodes.entries()) {
    if (node.expiresAtMs <= serverTime) fx.mineNodes.delete(playerId);
  }
  for (const [playerId, zone] of fx.fogZones.entries()) {
    if (zone.expiresAtMs <= serverTime) fx.fogZones.delete(playerId);
  }
  for (const [playerId, aura] of fx.overheatAuras.entries()) {
    if (aura.penaltyEndsAtMs <= serverTime) fx.overheatAuras.delete(playerId);
  }
  for (const [playerId, aura] of fx.siegeAuras.entries()) {
    if (aura.expiresAtMs <= serverTime) fx.siegeAuras.delete(playerId);
  }
}
