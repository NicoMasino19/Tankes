import {
  BuffType,
  PLAYER_RADIUS,
  ShapeKind,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type AbilityVfxCue,
  type PlayerNetState,
  type PowerUpNetState,
  type ShapeNetState,
  type ZoneNetState
} from "@tankes/shared";
import type { InterpolatedWorld } from "./InterpolationBuffer";
import {
  cleanupExpiredVfx,
  dispatchAbilityVfxCue,
  type BurstEffect,
  type DashEffect,
  type EmpEffect,
  type FogEffect,
  type FogZoneEffect,
  type HomingImpactEffect,
  type HomingTrailEffect,
  type MineEffect,
  type MineNodeEffect,
  type OrbitalEffect,
  type OverheatAuraEffect,
  type RepairEffect,
  type ShieldAuraEffect,
  type SiegeAuraEffect,
  type TurretNodeEffect,
  type TurretPulseEffect,
  type VfxEffectArrays
} from "./AbilityVfxHandler";

interface MuzzleFlash {
  x: number;
  y: number;
  rotation: number;
  life: number;
  maxLife: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

interface BulletTrail {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  life: number;
  maxLife: number;
}

interface RespawnPulse {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export class CanvasRenderer {
  private static readonly MAX_MUZZLE_FLASHES = 50;
  private static readonly MAX_PARTICLES = 240;
  private static readonly MAX_TRAILS = 260;
  private static readonly MAX_RESPAWN_PULSES = 40;
  private static readonly MAX_DASH_EFFECTS = 40;
  private static readonly MAX_EMP_EFFECTS = 40;
  private static readonly MAX_BURST_EFFECTS = 40;
  private static readonly MAX_MINE_EFFECTS = 50;
  private static readonly MAX_TURRET_PULSES = 60;
  private static readonly MAX_REPAIR_EFFECTS = 40;
  private static readonly MAX_FOG_EFFECTS = 40;
  private static readonly MAX_ORBITAL_EFFECTS = 40;
  private static readonly MAX_HOMING_TRAILS = 30;
  private static readonly MAX_HOMING_IMPACTS = 30;

  private readonly context: CanvasRenderingContext2D;
  private width = 1280;
  private height = 720;

  private readonly muzzleFlashes: MuzzleFlash[] = [];
  private readonly particles: Particle[] = [];
  private readonly bulletTrails: BulletTrail[] = [];
  private readonly respawnPulses: RespawnPulse[] = [];
  private readonly dashEffects: DashEffect[] = [];
  private readonly empEffects: EmpEffect[] = [];
  private readonly burstEffects: BurstEffect[] = [];
  private readonly mineEffects: MineEffect[] = [];
  private readonly mineNodes = new Map<string, MineNodeEffect>();
  private readonly turretPulseEffects: TurretPulseEffect[] = [];
  private readonly repairEffects: RepairEffect[] = [];
  private readonly fogEffects: FogEffect[] = [];
  private readonly fogZones = new Map<string, FogZoneEffect>();
  private readonly orbitalEffects: OrbitalEffect[] = [];
  private readonly homingTrailEffects: HomingTrailEffect[] = [];
  private readonly homingImpactEffects: HomingImpactEffect[] = [];
  private readonly shieldAuras = new Map<string, ShieldAuraEffect>();
  private readonly turretNodes = new Map<string, TurretNodeEffect>();
  private readonly overheatAuras = new Map<string, OverheatAuraEffect>();
  private readonly siegeAuras = new Map<string, SiegeAuraEffect>();
  private readonly seenAbilityCueExpiryById = new Map<string, number>();
  private readonly previousBulletPositions = new Map<string, { x: number; y: number }>();

  private selfDamageRingLife = 0;
  private selfKillFlashLife = 0;
  private roundTransitionLife = 0;
  private roundTransitionLabel = "";
  private lastFrameTime = performance.now();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2D canvas context unavailable");
    }
    this.context = context;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  getCameraCenter(selfPlayer: PlayerNetState | undefined): { x: number; y: number } {
    if (!selfPlayer) {
      return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    }
    return { x: selfPlayer.x, y: selfPlayer.y };
  }

  render(world: InterpolatedWorld, selfId: string | null): void {
    const now = performance.now();
    const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    this.stepEffects(deltaSeconds);
    this.ingestAbilityVfxCues(world.abilityVfxCues, world.serverTime);

    const self = world.players.find((player) => player.id === selfId);
    const camera = this.getCameraCenter(self);

    const ctx = this.context;
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawGrid(camera);
    this.drawWorldBounds(camera);
    this.drawControlZones(world.zones, camera);
    this.drawZoneGuide(world.zones, self, camera);
    this.drawShapes(world.shapes, camera);
    this.drawPowerUps(world.powerUps, camera);
    this.captureBulletTrails(world);
    this.drawBulletTrails(camera);
    this.drawRespawnPulses(camera);
    this.drawFogEffects(camera, world.serverTime);
    this.drawEmpEffects(camera, world.serverTime);
    this.drawOrbitalEffects(camera, world.serverTime);
    this.drawRepairEffects(camera);
    this.drawMineEffects(camera, world.serverTime);
    this.drawTurretNodes(camera, world.serverTime);
    this.drawTurretPulseEffects(camera);
    this.drawHomingImpactEffects(camera);
    this.drawParticles(camera);

    for (const bullet of world.bullets) {
      const sx = bullet.x - camera.x + this.width / 2;
      const sy = bullet.y - camera.y + this.height / 2;
      ctx.beginPath();
      ctx.fillStyle = "#f59e0b";
      ctx.arc(sx, sy, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const player of world.players) {
      const sx = player.x - camera.x + this.width / 2;
      const sy = player.y - camera.y + this.height / 2;
      const isInvulnerable = player.invulnerableUntilMs > world.serverTime;

      if (isInvulnerable) {
        ctx.beginPath();
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 3;
        ctx.arc(sx, sy, PLAYER_RADIUS + 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(player.rotation);

      ctx.fillStyle = player.id === selfId ? "#22d3ee" : "#60a5fa";
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(0, -5, PLAYER_RADIUS + 18, 10);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, -4, PLAYER_RADIUS + 16, 8);

      ctx.restore();

      this.drawShieldAura(player, camera, world.serverTime);
      this.drawOverheatAura(player, camera, world.serverTime);
      this.drawSiegeAura(player, camera, world.serverTime);

      const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(sx - 26, sy + 30, 52, 6);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(sx - 26, sy + 30, 52 * hpRatio, 6);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(player.name, sx, sy - 34);
    }

    this.drawMuzzleFlashes(camera);
    this.drawDashEffects(camera);
    this.drawBurstEffects(camera);
    this.drawHomingTrailEffects(camera);
    this.drawScreenEffects();
  }

  private get vfxEffects(): VfxEffectArrays {
    return {
      dashEffects: this.dashEffects,
      empEffects: this.empEffects,
      burstEffects: this.burstEffects,
      mineEffects: this.mineEffects,
      turretPulseEffects: this.turretPulseEffects,
      repairEffects: this.repairEffects,
      fogEffects: this.fogEffects,
      orbitalEffects: this.orbitalEffects,
      homingTrailEffects: this.homingTrailEffects,
      homingImpactEffects: this.homingImpactEffects,
      shieldAuras: this.shieldAuras,
      mineNodes: this.mineNodes,
      turretNodes: this.turretNodes,
      fogZones: this.fogZones,
      overheatAuras: this.overheatAuras,
      siegeAuras: this.siegeAuras,
      maxDashEffects: CanvasRenderer.MAX_DASH_EFFECTS,
      maxEmpEffects: CanvasRenderer.MAX_EMP_EFFECTS,
      maxBurstEffects: CanvasRenderer.MAX_BURST_EFFECTS,
      maxMineEffects: CanvasRenderer.MAX_MINE_EFFECTS,
      maxTurretPulses: CanvasRenderer.MAX_TURRET_PULSES,
      maxRepairEffects: CanvasRenderer.MAX_REPAIR_EFFECTS,
      maxFogEffects: CanvasRenderer.MAX_FOG_EFFECTS,
      maxOrbitalEffects: CanvasRenderer.MAX_ORBITAL_EFFECTS,
      maxHomingTrails: CanvasRenderer.MAX_HOMING_TRAILS,
      maxHomingImpacts: CanvasRenderer.MAX_HOMING_IMPACTS
    };
  }

  private ingestAbilityVfxCues(cues: AbilityVfxCue[], serverTime: number): void {
    const fx = this.vfxEffects;
    cleanupExpiredVfx(serverTime, fx, this.seenAbilityCueExpiryById);

    for (const cue of cues) {
      if (this.seenAbilityCueExpiryById.has(cue.id)) continue;
      this.seenAbilityCueExpiryById.set(cue.id, cue.createdAtMs + cue.ttlMs + 200);
      dispatchAbilityVfxCue(cue, fx);
    }
  }

  triggerShotEffect(x: number, y: number, rotation: number): void {
    this.muzzleFlashes.push({ x, y, rotation, life: 0.1, maxLife: 0.1 });
    this.trim(this.muzzleFlashes, CanvasRenderer.MAX_MUZZLE_FLASHES);
  }

  triggerHitEffect(x: number, y: number, selfHit: boolean): void {
    const particleCount = selfHit ? 12 : 8;
    for (let index = 0; index < particleCount; index += 1) {
      const speed = 90 + Math.random() * 190;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 2,
        life: 0.22,
        maxLife: 0.22,
        color: selfHit ? "#fb7185" : "#fbbf24"
      });
    }
    this.trim(this.particles, CanvasRenderer.MAX_PARTICLES);

    if (selfHit) {
      this.selfDamageRingLife = Math.max(this.selfDamageRingLife, 0.3);
    }
  }

  triggerDeathEffect(x: number, y: number, selfDeath: boolean): void {
    const particleCount = selfDeath ? 34 : 24;
    for (let index = 0; index < particleCount; index += 1) {
      const speed = 140 + Math.random() * 280;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        life: 0.42,
        maxLife: 0.42,
        color: selfDeath ? "#f87171" : "#f59e0b"
      });
    }
    this.trim(this.particles, CanvasRenderer.MAX_PARTICLES);

    if (selfDeath) {
      this.selfDamageRingLife = Math.max(this.selfDamageRingLife, 0.45);
    }
  }

  triggerRespawnEffect(x: number, y: number): void {
    this.respawnPulses.push({
      x,
      y,
      life: 0.48,
      maxLife: 0.48
    });
    this.trim(this.respawnPulses, CanvasRenderer.MAX_RESPAWN_PULSES);
  }

  triggerKillFlash(): void {
    this.selfKillFlashLife = Math.max(this.selfKillFlashLife, 0.15);
  }

  triggerRoundTransition(kind: "ended" | "reset"): void {
    this.roundTransitionLife = Math.max(this.roundTransitionLife, 0.55);
    this.roundTransitionLabel = kind === "ended" ? "Round Ended" : "Round Started";
  }

  screenToWorld(
    screenX: number,
    screenY: number,
    world: InterpolatedWorld,
    selfId: string | null
  ): { x: number; y: number } {
    const self = world.players.find((player) => player.id === selfId);
    const camera = this.getCameraCenter(self);
    return {
      x: screenX - this.width / 2 + camera.x,
      y: screenY - this.height / 2 + camera.y
    };
  }

  private drawGrid(camera: { x: number; y: number }): void {
    const ctx = this.context;
    const gap = 80;

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1;

    const startX = -((camera.x - this.width / 2) % gap);
    const startY = -((camera.y - this.height / 2) % gap);

    for (let x = startX; x < this.width; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }

    for (let y = startY; y < this.height; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
  }

  private drawWorldBounds(camera: { x: number; y: number }): void {
    const ctx = this.context;
    const left = -camera.x + this.width / 2;
    const top = -camera.y + this.height / 2;

    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.strokeRect(left, top, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = "rgba(147, 197, 253, 0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 6, top + 6, WORLD_WIDTH - 12, WORLD_HEIGHT - 12);
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawShapes(shapes: ShapeNetState[], camera: { x: number; y: number }): void {
    const ctx = this.context;

    for (const shape of shapes) {
      const centerX = shape.x - camera.x + this.width / 2;
      const centerY = shape.y - camera.y + this.height / 2;
      const palette = this.getShapePalette(shape);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(shape.rotation);

      this.pathRegularPolygon(shape.sides, shape.radius);
      ctx.fillStyle = palette.fill;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = palette.stroke;
      ctx.stroke();
      ctx.restore();

      const hpRatio = Math.max(0, Math.min(1, shape.hp / shape.maxHp));
      const barWidth = Math.max(34, shape.radius * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(centerX - barWidth / 2, centerY + shape.radius + 10, barWidth, 6);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(centerX - barWidth / 2, centerY + shape.radius + 10, barWidth * hpRatio, 6);
    }
  }

  private drawControlZones(zones: ZoneNetState[], camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const zone of zones) {
      const centerX = zone.x - camera.x + this.width / 2;
      const centerY = zone.y - camera.y + this.height / 2;

      ctx.beginPath();
      ctx.fillStyle = zone.contested ? "rgba(251, 191, 36, 0.14)" : "rgba(56, 189, 248, 0.12)";
      ctx.arc(centerX, centerY, zone.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = zone.contested ? "rgba(251, 191, 36, 0.88)" : "rgba(56, 189, 248, 0.78)";
      ctx.lineWidth = 2;
      ctx.arc(centerX, centerY, zone.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (zone.capturingPlayerId) {
        const progress = Math.max(0, Math.min(1, zone.captureProgress));
        ctx.beginPath();
        ctx.strokeStyle = "rgba(34, 197, 94, 0.95)";
        ctx.lineWidth = 4;
        ctx.arc(centerX, centerY, zone.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
      }
    }
  }

  private drawZoneGuide(
    zones: ZoneNetState[],
    selfPlayer: PlayerNetState | undefined,
    camera: { x: number; y: number }
  ): void {
    if (!selfPlayer || zones.length === 0) {
      return;
    }

    let nearestZone = zones[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const zone of zones) {
      const dx = zone.x - selfPlayer.x;
      const dy = zone.y - selfPlayer.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < nearestDistance) {
        nearestDistance = distanceSq;
        nearestZone = zone;
      }
    }

    if (!nearestZone) {
      return;
    }

    const zoneScreenX = nearestZone.x - camera.x + this.width / 2;
    const zoneScreenY = nearestZone.y - camera.y + this.height / 2;
    const margin = 70;
    const onScreen =
      zoneScreenX >= margin &&
      zoneScreenX <= this.width - margin &&
      zoneScreenY >= margin &&
      zoneScreenY <= this.height - margin;

    if (onScreen) {
      return;
    }

    const dx = nearestZone.x - selfPlayer.x;
    const dy = nearestZone.y - selfPlayer.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.0001) {
      return;
    }

    const dirX = dx / distance;
    const dirY = dy / distance;
    const arrowDistance = Math.min(this.width, this.height) * 0.42;
    const arrowX = this.width / 2 + dirX * arrowDistance;
    const arrowY = this.height / 2 + dirY * arrowDistance;
    const angle = Math.atan2(dirY, dirX);

    const ctx = this.context;
    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.fillStyle = "rgba(56, 189, 248, 0.95)";
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(186, 230, 253, 0.95)";
    ctx.font = "600 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ZONE", 0, -14);
    ctx.restore();
  }

  private drawPowerUps(powerUps: PowerUpNetState[], camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const powerUp of powerUps) {
      const sx = powerUp.x - camera.x + this.width / 2;
      const sy = powerUp.y - camera.y + this.height / 2;
      const palette = this.getPowerUpPalette(powerUp.type);

      ctx.beginPath();
      ctx.fillStyle = palette.glow;
      ctx.arc(sx, sy, powerUp.radius + 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = palette.fill;
      ctx.arc(sx, sy, powerUp.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = palette.stroke;
      ctx.lineWidth = 3;
      ctx.arc(sx, sy, powerUp.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private getPowerUpPalette(type: PowerUpNetState["type"]): { fill: string; stroke: string; glow: string } {
    if (type === BuffType.Reload) {
      return {
        fill: "#f59e0b",
        stroke: "#b45309",
        glow: "rgba(245, 158, 11, 0.25)"
      };
    }

    if (type === BuffType.Movement) {
      return {
        fill: "#22d3ee",
        stroke: "#0891b2",
        glow: "rgba(34, 211, 238, 0.24)"
      };
    }

    return {
      fill: "#f43f5e",
      stroke: "#be123c",
      glow: "rgba(244, 63, 94, 0.22)"
    };
  }

  private getShapePalette(shape: ShapeNetState): { fill: string; stroke: string } {
    if (shape.kind === ShapeKind.Triangle) {
      return { fill: "#f87171", stroke: "#ef4444" };
    }

    if (shape.kind === ShapeKind.Hexagon) {
      return { fill: "#22d3ee", stroke: "#0891b2" };
    }

    return { fill: "#f59e0b", stroke: "#b45309" };
  }

  private pathRegularPolygon(sides: number, radius: number): void {
    const ctx = this.context;
    const clampedSides = Math.max(3, sides);
    ctx.beginPath();
    for (let index = 0; index < clampedSides; index += 1) {
      const angle = (index / clampedSides) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) {
        ctx.moveTo(x, y);
        continue;
      }
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  private captureBulletTrails(world: InterpolatedWorld): void {
    const activeIds = new Set<string>();
    for (const bullet of world.bullets) {
      activeIds.add(bullet.id);
      const previous = this.previousBulletPositions.get(bullet.id);
      if (previous) {
        this.bulletTrails.push({
          fromX: previous.x,
          fromY: previous.y,
          toX: bullet.x,
          toY: bullet.y,
          life: 0.1,
          maxLife: 0.1
        });
      }
      this.previousBulletPositions.set(bullet.id, { x: bullet.x, y: bullet.y });
    }

    for (const bulletId of this.previousBulletPositions.keys()) {
      if (!activeIds.has(bulletId)) {
        this.previousBulletPositions.delete(bulletId);
      }
    }

    this.trim(this.bulletTrails, CanvasRenderer.MAX_TRAILS);
  }

  private drawBulletTrails(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const trail of this.bulletTrails) {
      const alpha = Math.max(0, trail.life / trail.maxLife);
      ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trail.fromX - camera.x + this.width / 2, trail.fromY - camera.y + this.height / 2);
      ctx.lineTo(trail.toX - camera.x + this.width / 2, trail.toY - camera.y + this.height / 2);
      ctx.stroke();
    }
  }

  private drawParticles(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = this.hexToRgba(particle.color, alpha * 0.9);
      ctx.beginPath();
      ctx.arc(particle.x - camera.x + this.width / 2, particle.y - camera.y + this.height / 2, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRespawnPulses(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const pulse of this.respawnPulses) {
      const alpha = Math.max(0, pulse.life / pulse.maxLife);
      const progress = 1 - alpha;
      const radius = PLAYER_RADIUS + progress * 44;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(34, 211, 238, ${alpha * 0.75})`;
      ctx.lineWidth = 2 + alpha * 2;
      ctx.arc(pulse.x - camera.x + this.width / 2, pulse.y - camera.y + this.height / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawDashEffects(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const effect of this.dashEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(effect.rotation);
      ctx.strokeStyle = `rgba(34, 211, 238, ${alpha * 0.8})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-92, 0);
      ctx.lineTo(24, 0);
      ctx.stroke();

      ctx.strokeStyle = `rgba(125, 211, 252, ${alpha * 0.55})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-84, -12);
      ctx.lineTo(12, -12);
      ctx.moveTo(-84, 12);
      ctx.lineTo(12, 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawEmpEffects(camera: { x: number; y: number }, serverTime: number): void {
    const ctx = this.context;
    for (const effect of this.empEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - alpha;
      const radius = effect.radius * (0.34 + progress * 1.08);
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.beginPath();
      ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.26})`;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.9})`;
      ctx.lineWidth = 4.5;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();

      const pulseAngle = (serverTime / 260) % (Math.PI * 2);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(147, 197, 253, ${alpha * 0.8})`;
      ctx.lineWidth = 2.8;
      ctx.arc(sx, sy, radius * 0.65, pulseAngle, pulseAngle + Math.PI * 1.2);
      ctx.stroke();
    }
  }

  private drawRepairEffects(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const effect of this.repairEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - alpha;
      const radius = effect.radius * (0.5 + progress * 1.25);
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.beginPath();
      ctx.fillStyle = `rgba(34, 197, 94, ${alpha * 0.28})`;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.95})`;
      ctx.lineWidth = 3.4;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawFogEffects(camera: { x: number; y: number }, serverTime: number): void {
    const ctx = this.context;
    for (const [playerId, zone] of this.fogZones.entries()) {
      if (zone.expiresAtMs <= serverTime) {
        this.fogZones.delete(playerId);
        continue;
      }

      const remaining = Math.max(0, zone.expiresAtMs - serverTime);
      const alpha = Math.max(0.24, Math.min(1, remaining / 6_500));
      const pulse = 0.96 + Math.sin((serverTime + zone.x * 0.3 + zone.y * 0.2) / 220) * 0.05;
      const sx = zone.x - camera.x + this.width / 2;
      const sy = zone.y - camera.y + this.height / 2;
      const radius = zone.radius * pulse;

      ctx.beginPath();
      ctx.fillStyle = `rgba(71, 85, 105, ${alpha * 0.3})`;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = `rgba(148, 163, 184, ${alpha * 0.17})`;
      ctx.arc(sx - radius * 0.12, sy - radius * 0.08, radius * 0.72, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = `rgba(94, 234, 212, ${alpha * 0.08})`;
      ctx.arc(sx + radius * 0.18, sy + radius * 0.1, radius * 0.52, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.setLineDash([14, 10]);
      ctx.strokeStyle = `rgba(103, 232, 249, ${alpha * 0.8})`;
      ctx.lineWidth = 4.2;
      ctx.arc(sx, sy, radius * 0.94, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const effect of this.fogEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const flicker = 0.84 + Math.sin((serverTime + effect.x + effect.y) / 160) * 0.16;
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.beginPath();
      ctx.fillStyle = `rgba(148, 163, 184, ${alpha * 0.34 * flicker})`;
      ctx.arc(sx, sy, effect.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.setLineDash([12, 9]);
      ctx.strokeStyle = `rgba(125, 211, 252, ${alpha * 0.9})`;
      ctx.lineWidth = 4.2;
      ctx.arc(sx, sy, effect.radius * (0.9 + (1 - alpha) * 0.08), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawOrbitalEffects(camera: { x: number; y: number }, serverTime: number): void {
    const ctx = this.context;
    for (const effect of this.orbitalEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - alpha;
      const radius = effect.radius * (0.38 + progress * 1.15);
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.beginPath();
      ctx.fillStyle = `rgba(14, 165, 233, ${alpha * 0.32})`;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.95})`;
      ctx.lineWidth = 3.6;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();

      const sweep = (serverTime / 230) % (Math.PI * 2);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.75})`;
      ctx.lineWidth = 2.4;
      ctx.arc(sx, sy, radius * 0.72, sweep, sweep + Math.PI * 1.1);
      ctx.stroke();
    }
  }

  private drawBurstEffects(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const effect of this.burstEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(effect.rotation);

      for (const angleOffset of [-0.12, 0, 0.12]) {
        ctx.save();
        ctx.rotate(angleOffset);
        ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.88})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(effect.radius, 0);
        ctx.stroke();

        ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.55})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(22, -5);
        ctx.lineTo(effect.radius - 10, -5);
        ctx.moveTo(22, 5);
        ctx.lineTo(effect.radius - 10, 5);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  private drawMineEffects(camera: { x: number; y: number }, serverTime: number): void {
    const ctx = this.context;
    for (const [playerId, node] of this.mineNodes.entries()) {
      if (node.expiresAtMs <= serverTime) {
        this.mineNodes.delete(playerId);
        continue;
      }

      const armedProgress = Math.max(0, Math.min(1, (serverTime - node.createdAtMs) / 350));
      const remaining = Math.max(0, node.expiresAtMs - serverTime);
      const alpha = Math.max(0.22, Math.min(1, remaining / 10_000));
      const warningPulse = 0.94 + Math.sin(serverTime / 110) * 0.08;
      const sx = node.x - camera.x + this.width / 2;
      const sy = node.y - camera.y + this.height / 2;
      const outerRadius = node.radius * (0.8 + warningPulse * 0.12);
      const coreRadius = 18 + armedProgress * 14;

      ctx.beginPath();
      ctx.fillStyle = `rgba(249, 115, 22, ${alpha * 0.18})`;
      ctx.arc(sx, sy, outerRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = `rgba(251, 146, 60, ${alpha * (0.5 + armedProgress * 0.45)})`;
      ctx.lineWidth = 4.2;
      ctx.arc(sx, sy, outerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.fillStyle = `rgba(254, 215, 170, ${alpha * 0.32})`;
      ctx.arc(sx, sy, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.95})`;
      ctx.lineWidth = 3.4;
      ctx.arc(sx, sy, coreRadius * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const effect of this.mineEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - alpha;
      const radius = effect.radius * (0.4 + progress * 1.08);
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.beginPath();
      ctx.fillStyle = this.hexToRgba(effect.color, alpha * effect.fillAlpha);
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = this.hexToRgba(effect.color, alpha * effect.strokeAlpha);
      ctx.lineWidth = 4.6;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawTurretNodes(camera: { x: number; y: number }, serverTime: number): void {
    const ctx = this.context;
    for (const [playerId, node] of this.turretNodes.entries()) {
      if (node.expiresAtMs <= serverTime) {
        this.turretNodes.delete(playerId);
        continue;
      }

      const remaining = Math.max(0, node.expiresAtMs - serverTime);
      const alpha = Math.max(0.25, Math.min(1, remaining / 6_000));
      const sx = node.x - camera.x + this.width / 2;
      const sy = node.y - camera.y + this.height / 2;

      ctx.beginPath();
      ctx.fillStyle = `rgba(34, 211, 238, ${alpha * 0.18})`;
      ctx.arc(sx, sy, node.radius + 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(34, 211, 238, ${alpha * 0.9})`;
      ctx.lineWidth = 3;
      ctx.arc(sx, sy, node.radius + 8, 0, Math.PI * 2);
      ctx.stroke();

      const orbit = (serverTime / 190) % (Math.PI * 2);
      ctx.beginPath();
      ctx.fillStyle = `rgba(125, 211, 252, ${alpha * 0.95})`;
      ctx.arc(sx + Math.cos(orbit) * (node.radius + 1), sy + Math.sin(orbit) * (node.radius + 1), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawTurretPulseEffects(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const effect of this.turretPulseEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(effect.rotation);

      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.95})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(effect.length, 0);
      ctx.stroke();

      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.7})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(3, -3);
      ctx.lineTo(effect.length - 3, -3);
      ctx.moveTo(3, 3);
      ctx.lineTo(effect.length - 3, 3);
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawShieldAura(
    player: PlayerNetState,
    camera: { x: number; y: number },
    serverTime: number
  ): void {
    const aura = this.shieldAuras.get(player.id);
    if (!aura) {
      return;
    }

    if (aura.expiresAtMs <= serverTime) {
      this.shieldAuras.delete(player.id);
      return;
    }

    const remaining = Math.max(0, aura.expiresAtMs - serverTime);
    const alpha = Math.max(0.2, Math.min(1, remaining / 1_500));
    const sx = player.x - camera.x + this.width / 2;
    const sy = player.y - camera.y + this.height / 2;
    const ctx = this.context;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(125, 211, 252, ${alpha * 0.95})`;
    ctx.lineWidth = 3;
    ctx.arc(sx, sy, aura.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = `rgba(14, 165, 233, ${alpha * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.arc(sx, sy, aura.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawOverheatAura(
    player: PlayerNetState,
    camera: { x: number; y: number },
    serverTime: number
  ): void {
    const aura = this.overheatAuras.get(player.id);
    if (!aura) {
      return;
    }

    if (aura.penaltyEndsAtMs <= serverTime) {
      this.overheatAuras.delete(player.id);
      return;
    }

    const sx = player.x - camera.x + this.width / 2;
    const sy = player.y - camera.y + this.height / 2;
    const ctx = this.context;

    if (serverTime < aura.overheatEndsAtMs) {
      const remaining = Math.max(0, aura.overheatEndsAtMs - serverTime);
      const alpha = Math.max(0.2, Math.min(1, remaining / 4_000));
      const pulse = 1 + Math.sin(serverTime / 95) * 0.1;
      const radius = aura.radius * pulse;

      ctx.beginPath();
      ctx.fillStyle = `rgba(249, 115, 22, ${alpha * 0.22})`;
      ctx.arc(sx, sy, radius + 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(251, 146, 60, ${alpha * 0.95})`;
      ctx.lineWidth = 3.2;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    const remainingPenalty = Math.max(0, aura.penaltyEndsAtMs - serverTime);
    const alpha = Math.max(0.15, Math.min(1, remainingPenalty / 1_000));
    const radius = aura.radius * (0.92 + (1 - alpha) * 0.16);

    ctx.beginPath();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = `rgba(244, 63, 94, ${alpha * 0.85})`;
    ctx.lineWidth = 2.8;
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawSiegeAura(
    player: PlayerNetState,
    camera: { x: number; y: number },
    serverTime: number
  ): void {
    const aura = this.siegeAuras.get(player.id);
    if (!aura) {
      return;
    }

    if (aura.expiresAtMs <= serverTime) {
      this.siegeAuras.delete(player.id);
      return;
    }

    const remaining = Math.max(0, aura.expiresAtMs - serverTime);
    const alpha = Math.max(0.2, Math.min(1, remaining / 5_000));
    const sx = player.x - camera.x + this.width / 2;
    const sy = player.y - camera.y + this.height / 2;
    const ctx = this.context;

    ctx.beginPath();
    ctx.setLineDash([12, 8]);
    ctx.strokeStyle = `rgba(14, 165, 233, ${alpha * 0.85})`;
    ctx.lineWidth = 3.8;
    ctx.arc(sx, sy, aura.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.55})`;
    ctx.lineWidth = 2;
    ctx.arc(sx, sy, aura.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawHomingTrailEffects(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const effect of this.homingTrailEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(effect.rotation);

      ctx.strokeStyle = `rgba(248, 113, 113, ${alpha * 0.95})`;
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(effect.length, 0);
      ctx.stroke();

      ctx.strokeStyle = `rgba(254, 202, 202, ${alpha * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, -4);
      ctx.lineTo(effect.length - 6, -4);
      ctx.moveTo(10, 4);
      ctx.lineTo(effect.length - 6, 4);
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawHomingImpactEffects(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const effect of this.homingImpactEffects) {
      const alpha = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - alpha;
      const radius = effect.radius * (0.42 + progress * 1.18);
      const sx = effect.x - camera.x + this.width / 2;
      const sy = effect.y - camera.y + this.height / 2;

      ctx.beginPath();
      ctx.fillStyle = `rgba(244, 63, 94, ${alpha * 0.36})`;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(251, 113, 133, ${alpha * 0.95})`;
      ctx.lineWidth = 4.2;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawMuzzleFlashes(camera: { x: number; y: number }): void {
    const ctx = this.context;
    for (const flash of this.muzzleFlashes) {
      const alpha = Math.max(0, flash.life / flash.maxLife);
      const sx = flash.x - camera.x + this.width / 2;
      const sy = flash.y - camera.y + this.height / 2;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(flash.rotation);
      ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.moveTo(PLAYER_RADIUS + 10, 0);
      ctx.lineTo(PLAYER_RADIUS + 2, -6);
      ctx.lineTo(PLAYER_RADIUS + 2, 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.45})`;
      ctx.beginPath();
      ctx.arc(PLAYER_RADIUS + 6, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawScreenEffects(): void {
    const ctx = this.context;
    if (this.selfDamageRingLife > 0) {
      const alpha = this.selfDamageRingLife / 0.45;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(248, 113, 113, ${Math.max(0, alpha * 0.36)})`;
      ctx.lineWidth = 14;
      ctx.arc(this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.38, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.selfKillFlashLife > 0) {
      const alpha = this.selfKillFlashLife / 0.15;
      ctx.fillStyle = `rgba(240, 249, 255, ${Math.max(0, alpha * 0.18)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.roundTransitionLife > 0) {
      const alpha = this.roundTransitionLife / 0.55;
      ctx.fillStyle = `rgba(2, 6, 23, ${Math.max(0, alpha * 0.32)})`;
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = `rgba(56, 189, 248, ${Math.max(0, alpha * 0.95)})`;
      ctx.font = "600 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.roundTransitionLabel, this.width / 2, this.height * 0.22);
    }
  }

  private stepEffects(deltaSeconds: number): void {
    for (const flash of this.muzzleFlashes) {
      flash.life -= deltaSeconds;
    }
    for (const particle of this.particles) {
      particle.life -= deltaSeconds;
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.vx *= 0.93;
      particle.vy *= 0.93;
    }
    for (const trail of this.bulletTrails) {
      trail.life -= deltaSeconds;
    }
    for (const pulse of this.respawnPulses) {
      pulse.life -= deltaSeconds;
    }
    for (const effect of this.dashEffects) {
      effect.life -= deltaSeconds;
    }
    for (const effect of this.empEffects) {
      effect.life -= deltaSeconds;
    }
    for (const effect of this.burstEffects) {
      effect.life -= deltaSeconds;
    }
    for (const effect of this.mineEffects) {
      effect.life -= deltaSeconds;
    }
    for (const effect of this.turretPulseEffects) {
      effect.life -= deltaSeconds;
    }
    for (const effect of this.repairEffects) {
      effect.life -= deltaSeconds;
    }
    for (const effect of this.fogEffects) {
      effect.life -= deltaSeconds;
    }
    for (const effect of this.orbitalEffects) {
      effect.life -= deltaSeconds;
    }
    for (const effect of this.homingTrailEffects) {
      effect.life -= deltaSeconds;
    }
    for (const effect of this.homingImpactEffects) {
      effect.life -= deltaSeconds;
    }

    this.selfDamageRingLife = Math.max(0, this.selfDamageRingLife - deltaSeconds);
    this.selfKillFlashLife = Math.max(0, this.selfKillFlashLife - deltaSeconds);
    this.roundTransitionLife = Math.max(0, this.roundTransitionLife - deltaSeconds);

    this.pruneByLife(this.muzzleFlashes);
    this.pruneByLife(this.particles);
    this.pruneByLife(this.bulletTrails);
    this.pruneByLife(this.respawnPulses);
    this.pruneByLife(this.dashEffects);
    this.pruneByLife(this.empEffects);
    this.pruneByLife(this.burstEffects);
    this.pruneByLife(this.mineEffects);
    this.pruneByLife(this.turretPulseEffects);
    this.pruneByLife(this.repairEffects);
    this.pruneByLife(this.fogEffects);
    this.pruneByLife(this.orbitalEffects);
    this.pruneByLife(this.homingTrailEffects);
    this.pruneByLife(this.homingImpactEffects);
  }

  private pruneByLife<T extends { life: number }>(collection: T[]): void {
    let write = 0;
    for (let index = 0; index < collection.length; index += 1) {
      const value = collection[index];
      if (!value || value.life <= 0) {
        continue;
      }
      collection[write] = value;
      write += 1;
    }
    collection.length = write;
  }

  private trim<T>(collection: T[], max: number): void {
    if (collection.length <= max) {
      return;
    }
    collection.splice(0, collection.length - max);
  }

  private hexToRgba(hex: string, alpha: number): string {
    const cleaned = hex.replace("#", "");
    const normalized = cleaned.length === 3 ? cleaned.split("").map((char) => char + char).join("") : cleaned;
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
}
