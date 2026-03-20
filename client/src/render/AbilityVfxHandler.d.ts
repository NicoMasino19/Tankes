import { type AbilityVfxCue } from "@tankes/shared";
export interface DashEffect {
    x: number;
    y: number;
    rotation: number;
    life: number;
    maxLife: number;
}
export interface EmpEffect {
    x: number;
    y: number;
    radius: number;
    life: number;
    maxLife: number;
}
export interface ShieldAuraEffect {
    playerId: string;
    expiresAtMs: number;
    radius: number;
}
export interface BurstEffect {
    x: number;
    y: number;
    rotation: number;
    life: number;
    maxLife: number;
    radius: number;
}
export interface MineEffect {
    x: number;
    y: number;
    life: number;
    maxLife: number;
    radius: number;
    color: string;
    fillAlpha: number;
    strokeAlpha: number;
}
export interface MineNodeEffect {
    playerId: string;
    x: number;
    y: number;
    createdAtMs: number;
    expiresAtMs: number;
    radius: number;
}
export interface TurretPulseEffect {
    x: number;
    y: number;
    rotation: number;
    length: number;
    life: number;
    maxLife: number;
}
export interface TurretNodeEffect {
    playerId: string;
    x: number;
    y: number;
    expiresAtMs: number;
    radius: number;
}
export interface RepairEffect {
    x: number;
    y: number;
    radius: number;
    life: number;
    maxLife: number;
}
export interface FogEffect {
    x: number;
    y: number;
    radius: number;
    life: number;
    maxLife: number;
}
export interface FogZoneEffect {
    playerId: string;
    x: number;
    y: number;
    expiresAtMs: number;
    radius: number;
}
export interface OverheatAuraEffect {
    playerId: string;
    overheatEndsAtMs: number;
    penaltyEndsAtMs: number;
    radius: number;
}
export interface OrbitalEffect {
    x: number;
    y: number;
    radius: number;
    life: number;
    maxLife: number;
}
export interface SiegeAuraEffect {
    playerId: string;
    expiresAtMs: number;
    radius: number;
}
export interface HomingTrailEffect {
    x: number;
    y: number;
    rotation: number;
    length: number;
    life: number;
    maxLife: number;
}
export interface HomingImpactEffect {
    x: number;
    y: number;
    radius: number;
    life: number;
    maxLife: number;
}
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
export declare function dispatchAbilityVfxCue(cue: AbilityVfxCue, fx: VfxEffectArrays): void;
export declare function cleanupExpiredVfx(serverTime: number, fx: VfxEffectArrays, seenCues: Map<string, number>): void;
