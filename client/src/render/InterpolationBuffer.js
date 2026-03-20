import { INTERPOLATION_DELAY_MS, } from "@tankes/shared";
const lerp = (a, b, t) => a + (b - a) * t;
const normalizeAngle = (angle) => {
    let normalized = angle;
    while (normalized <= -Math.PI) {
        normalized += Math.PI * 2;
    }
    while (normalized > Math.PI) {
        normalized -= Math.PI * 2;
    }
    return normalized;
};
const lerpAngle = (a, b, t) => {
    const delta = normalizeAngle(b - a);
    return normalizeAngle(a + delta * t);
};
const RING_CAPACITY = 60;
export class InterpolationBuffer {
    ring = new Array(RING_CAPACITY).fill(null);
    head = 0;
    count = 0;
    serverOffsetMs = 0;
    push(state) {
        if (this.serverOffsetMs === 0) {
            this.serverOffsetMs = Date.now() - state.serverTime;
        }
        else {
            const sample = Date.now() - state.serverTime;
            this.serverOffsetMs = this.serverOffsetMs * 0.9 + sample * 0.1;
        }
        const writeIndex = (this.head + this.count) % RING_CAPACITY;
        this.ring[writeIndex] = { serverTime: state.serverTime, state };
        if (this.count < RING_CAPACITY) {
            this.count += 1;
        }
        else {
            this.head = (this.head + 1) % RING_CAPACITY;
        }
    }
    at(index) {
        if (index < 0 || index >= this.count)
            return null;
        return this.ring[(this.head + index) % RING_CAPACITY] ?? null;
    }
    getInterpolated() {
        const firstEntry = this.at(0);
        if (!firstEntry) {
            return {
                tick: 0,
                serverTime: 0,
                abilityVfxCues: [],
                session: null,
                players: [],
                bullets: [],
                shapes: [],
                zones: [],
                powerUps: []
            };
        }
        if (this.count === 1) {
            const only = firstEntry.state;
            return {
                tick: only.tick,
                serverTime: only.serverTime,
                abilityVfxCues: only.abilityVfxCues,
                session: only.session,
                players: Array.from(only.players.values()),
                bullets: Array.from(only.bullets.values()),
                shapes: Array.from(only.shapes.values()),
                zones: Array.from(only.zones.values()),
                powerUps: Array.from(only.powerUps.values())
            };
        }
        const renderServerTime = Date.now() - this.serverOffsetMs - INTERPOLATION_DELAY_MS;
        let older = firstEntry;
        let newer = this.at(this.count - 1) ?? firstEntry;
        for (let index = 0; index < this.count - 1; index += 1) {
            const current = this.at(index);
            const next = this.at(index + 1);
            if (!current || !next) {
                continue;
            }
            if (current.serverTime <= renderServerTime && next.serverTime >= renderServerTime) {
                older = current;
                newer = next;
                break;
            }
        }
        const span = Math.max(1, newer.serverTime - older.serverTime);
        const alpha = Math.min(1, Math.max(0, (renderServerTime - older.serverTime) / span));
        const players = [];
        for (const [id, newPlayer] of newer.state.players) {
            const oldPlayer = older.state.players.get(id);
            if (!oldPlayer) {
                players.push(newPlayer);
                continue;
            }
            players.push({
                ...newPlayer,
                x: lerp(oldPlayer.x, newPlayer.x, alpha),
                y: lerp(oldPlayer.y, newPlayer.y, alpha),
                rotation: lerpAngle(oldPlayer.rotation, newPlayer.rotation, alpha)
            });
        }
        const bullets = [];
        for (const [id, newBullet] of newer.state.bullets) {
            const oldBullet = older.state.bullets.get(id);
            if (!oldBullet) {
                bullets.push(newBullet);
                continue;
            }
            bullets.push({
                ...newBullet,
                x: lerp(oldBullet.x, newBullet.x, alpha),
                y: lerp(oldBullet.y, newBullet.y, alpha)
            });
        }
        const shapes = [];
        for (const [id, newShape] of newer.state.shapes) {
            const oldShape = older.state.shapes.get(id);
            if (!oldShape) {
                shapes.push(newShape);
                continue;
            }
            shapes.push({
                ...newShape,
                x: lerp(oldShape.x, newShape.x, alpha),
                y: lerp(oldShape.y, newShape.y, alpha),
                rotation: lerpAngle(oldShape.rotation, newShape.rotation, alpha)
            });
        }
        const zones = Array.from(newer.state.zones.values());
        const powerUps = Array.from(newer.state.powerUps.values());
        return {
            tick: newer.state.tick,
            serverTime: renderServerTime,
            abilityVfxCues: newer.state.abilityVfxCues,
            session: newer.state.session,
            players,
            bullets,
            shapes,
            zones,
            powerUps
        };
    }
}
//# sourceMappingURL=InterpolationBuffer.js.map