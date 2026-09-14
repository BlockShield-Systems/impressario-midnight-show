export const GRAND_CARD_MAX_CHARGES = 3;
export const GRAND_CARD_PICKUP_RESPAWN_SECONDS = 8;
export const GRAND_CARD_PROJECTILE_MARGIN = 640;

export type GrandCardSpendResult =
  | "spent"
  | "depleted"
  | "locked";

export interface GrandCardProjectileOwner {
  readonly id: string;
  readonly startX: number;
  readonly endX: number;
}

export interface GrandCardProjectileState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifetime: number;
  readonly ownerSection:
    GrandCardProjectileOwner | null;
}

export interface RectangleBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class GrandCardChargeState {
  private unlocked = false;
  private charges = 0;

  private readonly pickupRespawnTimers =
    new Map<string, number>();

  public get currentCharges(): number {
    return this.charges;
  }

  public get isUnlocked(): boolean {
    return this.unlocked;
  }

  public unlock(): void {
    if (this.unlocked) {
      return;
    }

    this.unlocked = true;
    this.charges = GRAND_CARD_MAX_CHARGES;
  }

  public spend(): GrandCardSpendResult {
    if (!this.unlocked) {
      return "locked";
    }

    if (this.charges <= 0) {
      return "depleted";
    }

    this.charges -= 1;
    return "spent";
  }

  public collectPickup(id: string): boolean {
    if (
      !this.unlocked ||
      this.charges >= GRAND_CARD_MAX_CHARGES ||
      !this.isPickupAvailable(id)
    ) {
      return false;
    }

    this.charges += 1;
    this.pickupRespawnTimers.set(
      id,
      GRAND_CARD_PICKUP_RESPAWN_SECONDS
    );

    return true;
  }

  public isPickupAvailable(id: string): boolean {
    return (
      this.pickupRespawnTimers.get(id) ?? 0
    ) <= 0;
  }

  public update(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    for (const [id, remaining] of
      this.pickupRespawnTimers) {
      const next = Math.max(
        0,
        remaining - deltaSeconds
      );

      if (next === 0) {
        this.pickupRespawnTimers.delete(id);
      } else {
        this.pickupRespawnTimers.set(id, next);
      }
    }
  }

  public resetEncounter(): void {
    if (this.unlocked) {
      this.charges = GRAND_CARD_MAX_CHARGES;
    }

    this.pickupRespawnTimers.clear();
  }
}

export function createGrandCardProjectileState(
  x: number,
  y: number,
  velocityX: number,
  velocityY: number,
  lifetime: number,
  ownerSection:
    GrandCardProjectileOwner | null
): GrandCardProjectileState {
  return {
    x,
    y,
    velocityX,
    velocityY,
    lifetime,
    ownerSection
  };
}

export function advanceGrandCardProjectile(
  projectile: GrandCardProjectileState,
  deltaSeconds: number,
  currentSection:
    GrandCardProjectileOwner | null
): boolean {
  projectile.lifetime -= deltaSeconds;
  projectile.x +=
    projectile.velocityX * deltaSeconds;
  projectile.y +=
    projectile.velocityY * deltaSeconds;

  if (
    projectile.lifetime <= 0 ||
    projectile.y < -40 ||
    projectile.y > 760
  ) {
    return false;
  }

  const owner = projectile.ownerSection;

  if (
    owner === null ||
    currentSection?.id === owner.id
  ) {
    return true;
  }

  return (
    projectile.x >=
      owner.startX -
        GRAND_CARD_PROJECTILE_MARGIN &&
    projectile.x <=
      owner.endX +
        GRAND_CARD_PROJECTILE_MARGIN
  );
}

export function grandCardProjectileBounds(
  projectile: GrandCardProjectileState
): RectangleBounds {
  return {
    x: projectile.x - 8,
    y: projectile.y - 5,
    width: 16,
    height: 10
  };
}

export function rectangleBoundsOverlap(
  left: RectangleBounds,
  right: RectangleBounds
): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

