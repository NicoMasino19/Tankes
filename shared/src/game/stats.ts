export const STAT_KEYS = [
  "movementSpeed",
  "bulletSpeed",
  "bulletDamage",
  "reloadSpeed",
  "maxHealth"
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export interface PlayerStats {
  movementSpeed: number;
  bulletSpeed: number;
  bulletDamage: number;
  reloadSpeed: number;
  maxHealth: number;
}

export const createBaseStats = (): PlayerStats => ({
  movementSpeed: 0,
  bulletSpeed: 0,
  bulletDamage: 0,
  reloadSpeed: 0,
  maxHealth: 0
});
