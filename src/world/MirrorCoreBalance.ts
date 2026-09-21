export const MIRROR_CORE_CASTER_HEALTH = 40;
export const MIRROR_CORE_GROUND_ENEMY_HEALTH = 42;
export const MIRROR_CORE_HEALTH_PICKUP_RESPAWN_SECONDS = 12;
export const MIRROR_CORE_GRAND_CARD_DAMAGE = 14;

export const MIRROR_CORE_GAUNTLET_HEALTH_PICKUP_IDS = [
  "CoreRoseE",
  "CoreRoseF"
] as const;

export const MIRROR_CORE_GAUNTLET_CARD_PICKUP_IDS = [
  "CoreCardC",
  "CoreCardD"
] as const;

export function mirrorCoreEnemyHealth(
  kind: "duelist" | "caster" | "mime"
): number {
  return kind === "caster"
    ? MIRROR_CORE_CASTER_HEALTH
    : MIRROR_CORE_GROUND_ENEMY_HEALTH;
}

export function grandCardHitsToDefeat(
  health: number
): number {
  return Math.ceil(
    health / MIRROR_CORE_GRAND_CARD_DAMAGE
  );
}
