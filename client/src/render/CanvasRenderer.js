import { BuffType, PLAYER_RADIUS, ShapeKind, WORLD_HEIGHT, WORLD_WIDTH } from "@tankes/shared";
export class CanvasRenderer {
    canvas;
    static MAX_MUZZLE_FLASHES = 50;
    static MAX_PARTICLES = 240;
    static MAX_TRAILS = 260;
    static MAX_RESPAWN_PULSES = 40;
    context;
    width = 1280;
    height = 720;
    muzzleFlashes = [];
    particles = [];
    bulletTrails = [];
    respawnPulses = [];
    previousBulletPositions = new Map();
    selfDamageRingLife = 0;
    selfKillFlashLife = 0;
    roundTransitionLife = 0;
    roundTransitionLabel = "";
    lastFrameTime = performance.now();
    constructor(canvas) {
        this.canvas = canvas;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("2D canvas context unavailable");
        }
        this.context = context;
        this.resize();
        window.addEventListener("resize", () => this.resize());
    }
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    getCameraCenter(selfPlayer) {
        if (!selfPlayer) {
            return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
        }
        return { x: selfPlayer.x, y: selfPlayer.y };
    }
    render(world, selfId) {
        const now = performance.now();
        const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
        this.lastFrameTime = now;
        this.stepEffects(deltaSeconds);
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
        this.drawScreenEffects();
    }
    triggerShotEffect(x, y, rotation) {
        this.muzzleFlashes.push({ x, y, rotation, life: 0.1, maxLife: 0.1 });
        this.trim(this.muzzleFlashes, CanvasRenderer.MAX_MUZZLE_FLASHES);
    }
    triggerHitEffect(x, y, selfHit) {
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
    triggerDeathEffect(x, y, selfDeath) {
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
    triggerRespawnEffect(x, y) {
        this.respawnPulses.push({
            x,
            y,
            life: 0.48,
            maxLife: 0.48
        });
        this.trim(this.respawnPulses, CanvasRenderer.MAX_RESPAWN_PULSES);
    }
    triggerKillFlash() {
        this.selfKillFlashLife = Math.max(this.selfKillFlashLife, 0.15);
    }
    triggerRoundTransition(kind) {
        this.roundTransitionLife = Math.max(this.roundTransitionLife, 0.55);
        this.roundTransitionLabel = kind === "ended" ? "Round Ended" : "Round Started";
    }
    screenToWorld(screenX, screenY, world, selfId) {
        const self = world.players.find((player) => player.id === selfId);
        const camera = this.getCameraCenter(self);
        return {
            x: screenX - this.width / 2 + camera.x,
            y: screenY - this.height / 2 + camera.y
        };
    }
    drawGrid(camera) {
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
    drawWorldBounds(camera) {
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
    drawShapes(shapes, camera) {
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
    drawControlZones(zones, camera) {
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
    drawZoneGuide(zones, selfPlayer, camera) {
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
        const onScreen = zoneScreenX >= margin &&
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
    drawPowerUps(powerUps, camera) {
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
    getPowerUpPalette(type) {
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
    getShapePalette(shape) {
        if (shape.kind === ShapeKind.Triangle) {
            return { fill: "#f87171", stroke: "#ef4444" };
        }
        if (shape.kind === ShapeKind.Hexagon) {
            return { fill: "#22d3ee", stroke: "#0891b2" };
        }
        return { fill: "#f59e0b", stroke: "#b45309" };
    }
    pathRegularPolygon(sides, radius) {
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
    captureBulletTrails(world) {
        const activeIds = new Set();
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
    drawBulletTrails(camera) {
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
    drawParticles(camera) {
        const ctx = this.context;
        for (const particle of this.particles) {
            const alpha = Math.max(0, particle.life / particle.maxLife);
            ctx.fillStyle = this.hexToRgba(particle.color, alpha * 0.9);
            ctx.beginPath();
            ctx.arc(particle.x - camera.x + this.width / 2, particle.y - camera.y + this.height / 2, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    drawRespawnPulses(camera) {
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
    drawMuzzleFlashes(camera) {
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
    drawScreenEffects() {
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
    stepEffects(deltaSeconds) {
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
        this.selfDamageRingLife = Math.max(0, this.selfDamageRingLife - deltaSeconds);
        this.selfKillFlashLife = Math.max(0, this.selfKillFlashLife - deltaSeconds);
        this.roundTransitionLife = Math.max(0, this.roundTransitionLife - deltaSeconds);
        this.pruneByLife(this.muzzleFlashes);
        this.pruneByLife(this.particles);
        this.pruneByLife(this.bulletTrails);
        this.pruneByLife(this.respawnPulses);
    }
    pruneByLife(collection) {
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
    trim(collection, max) {
        if (collection.length <= max) {
            return;
        }
        collection.splice(0, collection.length - max);
    }
    hexToRgba(hex, alpha) {
        const cleaned = hex.replace("#", "");
        const normalized = cleaned.length === 3 ? cleaned.split("").map((char) => char + char).join("") : cleaned;
        const r = Number.parseInt(normalized.slice(0, 2), 16);
        const g = Number.parseInt(normalized.slice(2, 4), 16);
        const b = Number.parseInt(normalized.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
    }
}
//# sourceMappingURL=CanvasRenderer.js.map