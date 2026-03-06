export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 4000;
export const SERVER_TICK_RATE = 60;
export const SNAPSHOT_RATE = 30;
export const FIXED_DELTA_SECONDS = 1 / SERVER_TICK_RATE;
export const PLAYER_RADIUS = 24;
export const BULLET_RADIUS = 6;
export const BULLET_LIFETIME_MS = 2400;
export const BASE_MOVE_SPEED = 230;
export const BASE_BULLET_SPEED = 500;
export const BASE_BULLET_DAMAGE = 16;
export const BASE_RELOAD_MS = 360;
export const BASE_MAX_HEALTH = 135;
export const STAT_MAX_LEVEL = 10;
export const INTERPOLATION_DELAY_MS = 100;
export const GRID_CELL_SIZE = 200;
export const RESPAWN_INVULNERABILITY_MS = 1600;

export interface ControlZoneConfig {
	radius: number;
	xpPerSecond: number;
	captureBonusXp: number;
}

export const CONTROL_ZONE_BASE_CONFIG: ControlZoneConfig = {
	radius: 190,
	xpPerSecond: 4,
	captureBonusXp: 26
};

export const CONTROL_ZONE_CAPTURE_RATE_PER_SECOND = 0.13;
export const CONTROL_ZONE_MAX_ACTIVE = 1;
export const CONTROL_ZONE_SPAWN_INTERVAL_MS = 8_000;
export const CONTROL_ZONE_SPAWN_ATTEMPTS = 50;
export const CONTROL_ZONE_SPAWN_MARGIN = 220;

export const POWER_UP_RADIUS = 20;
export const POWER_UP_DURATION_MS = 11_000;
export const POWER_UP_TTL_MS = 22_000;
export const POWER_UP_MAX_ACTIVE = 3;
export const POWER_UP_SPAWN_INTERVAL_MS = 9_000;
export const POWER_UP_SPAWN_ATTEMPTS = 40;
export const POWER_UP_SPAWN_PLAYER_SAFE_DISTANCE = 220;

export const POWER_UP_TYPE_WEIGHTS = {
	damage: 35,
	reload: 35,
	movement: 30
} as const;

export const BUFF_MAX_STACKS = 3;
export const BUFF_DAMAGE_PER_STACK = 0.08;
export const BUFF_RELOAD_PER_STACK = 0.07;
export const BUFF_MOVEMENT_PER_STACK = 0.08;

export const NET_PING_PROBE_INTERVAL_MS = 1_000;
export const NET_PING_SMOOTHING_ALPHA = 0.18;
