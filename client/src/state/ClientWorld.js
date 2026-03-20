const cloneSession = (session) => {
    if (!session) {
        return null;
    }
    return {
        ...session,
        scoreboard: session.scoreboard.map((entry) => ({ ...entry })),
        ...(session.config ? { config: { ...session.config } } : {}),
        ...(session.lastRoundResult
            ? {
                lastRoundResult: {
                    ...session.lastRoundResult,
                    scoreboard: session.lastRoundResult.scoreboard.map((entry) => ({ ...entry }))
                }
            }
            : {}),
        ...(session.respawns ? { respawns: session.respawns.map((entry) => ({ ...entry })) } : {})
    };
};
const cloneMap = (value) => new Map(Array.from(value.entries(), ([key, entry]) => [key, { ...entry }]));
export class ClientWorld {
    players = new Map();
    bullets = new Map();
    shapes = new Map();
    zones = new Map();
    powerUps = new Map();
    lastAbilityVfxCues = [];
    session = null;
    tick = 0;
    serverTime = 0;
    cachedSnapshot = null;
    applyDelta(delta) {
        this.cachedSnapshot = null;
        this.tick = delta.tick;
        this.serverTime = delta.serverTime;
        this.lastAbilityVfxCues = delta.abilityVfxCues ? [...delta.abilityVfxCues] : [];
        if (delta.session) {
            this.session = delta.session;
        }
        for (const player of delta.playersUpsert) {
            this.players.set(player.id, player);
        }
        for (const playerId of delta.playersRemove) {
            this.players.delete(playerId);
        }
        for (const bullet of delta.bulletsUpsert) {
            this.bullets.set(bullet.id, bullet);
        }
        for (const bulletId of delta.bulletsRemove) {
            this.bullets.delete(bulletId);
        }
        for (const shape of delta.shapesUpsert) {
            this.shapes.set(shape.id, shape);
        }
        for (const shapeId of delta.shapesRemove) {
            this.shapes.delete(shapeId);
        }
        for (const zone of delta.zonesUpsert) {
            this.zones.set(zone.id, zone);
        }
        for (const zoneId of delta.zonesRemove) {
            this.zones.delete(zoneId);
        }
        for (const powerUp of delta.powerUpsUpsert) {
            this.powerUps.set(powerUp.id, powerUp);
        }
        for (const powerUpId of delta.powerUpsRemove) {
            this.powerUps.delete(powerUpId);
        }
        return this.getSnapshot();
    }
    getSnapshot() {
        if (this.cachedSnapshot)
            return this.cachedSnapshot;
        this.cachedSnapshot = {
            tick: this.tick,
            serverTime: this.serverTime,
            abilityVfxCues: [...this.lastAbilityVfxCues],
            session: cloneSession(this.session),
            players: cloneMap(this.players),
            bullets: cloneMap(this.bullets),
            shapes: cloneMap(this.shapes),
            zones: cloneMap(this.zones),
            powerUps: cloneMap(this.powerUps)
        };
        return this.cachedSnapshot;
    }
}
//# sourceMappingURL=ClientWorld.js.map