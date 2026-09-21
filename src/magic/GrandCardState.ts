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

export class PickupRespawnState {
  private readonly timers =
    new Map<string, number>();

  public collect(
    id: string,
    respawnSeconds: number
  ): boolean {
    if (
      respawnSeconds <= 0 ||
      !this.isAvailable(id)
    ) {
      return false;
    }

    this.timers.set(id, respawnSeconds);
    return true;
  }

  public isAvailable(id: string): boolean {
    return (this.timers.get(id) ?? 0) <= 0;
  }

  public remainingSeconds(id: string): number {
    return this.timers.get(id) ?? 0;
  }

  public update(
    deltaSeconds: number,
    simulationRunning = true
  ): void {
    if (
      !simulationRunning ||
      deltaSeconds <= 0
    ) {
      return;
    }

    for (const [id, remaining] of this.timers) {
      const next = Math.max(
        0,
        remaining - deltaSeconds
      );

      if (next === 0) {
        this.timers.delete(id);
      } else {
        this.timers.set(id, next);
      }
    }
  }

  public snapshot(
    ids: readonly string[]
  ): Readonly<Record<string, number>> {
    return Object.fromEntries(
      ids.map(id => [
        id,
        this.remainingSeconds(id)
      ])
    );
  }

  public restore(
    remainders: Readonly<Record<string, number>>
  ): void {
    for (const [id, remaining] of
      Object.entries(remainders)) {
      if (remaining > 0) {
        this.timers.set(id, remaining);
      } else {
        this.timers.delete(id);
      }
    }
  }

  public reset(ids?: readonly string[]): void {
    if (ids === undefined) {
      this.timers.clear();
      return;
    }

    for (const id of ids) {
      this.timers.delete(id);
    }
  }
}

export class GrandCardChargeState {
  private unlocked = false;
  private charges = 0;

  private readonly pickupRespawns =
    new PickupRespawnState();

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
      !this.pickupRespawns.collect(
        id,
        GRAND_CARD_PICKUP_RESPAWN_SECONDS
      )
    ) {
      return false;
    }

    this.charges += 1;
    return true;
  }

  public isPickupAvailable(id: string): boolean {
    return this.pickupRespawns.isAvailable(id);
  }

  public restoreCharges(charges: number): void {
    if (!this.unlocked) {
      return;
    }

    this.charges = Math.max(
      0,
      Math.min(
        GRAND_CARD_MAX_CHARGES,
        Math.floor(charges)
      )
    );
  }

  public pickupTimerRemainders(
    ids: readonly string[]
  ): Readonly<Record<string, number>> {
    return this.pickupRespawns.snapshot(ids);
  }

  public restorePickupTimers(
    remainders: Readonly<Record<string, number>>
  ): void {
    this.pickupRespawns.restore(remainders);
  }

  public update(deltaSeconds: number): void {
    this.pickupRespawns.update(deltaSeconds);
  }

  public resetPickups(
    ids: readonly string[]
  ): void {
    this.pickupRespawns.reset(ids);
  }

  public resetEncounter(): void {
    if (this.unlocked) {
      this.charges = GRAND_CARD_MAX_CHARGES;
    }

    this.pickupRespawns.reset();
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

