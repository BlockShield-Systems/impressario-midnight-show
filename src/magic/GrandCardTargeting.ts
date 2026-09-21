export interface GrandCardTargetCandidate {
  readonly id: string;
  readonly active: boolean;
  readonly centerX: number;
  readonly centerY: number;
  readonly group?: string;
  readonly kind?: string;
}

interface RankedTarget<T> {
  readonly target: T;
  readonly facingRank: number;
  readonly kindRank: number;
  readonly distanceSquared: number;
}

function compareRankedTargets<T extends GrandCardTargetCandidate>(
  left: RankedTarget<T>,
  right: RankedTarget<T>
): number {
  return (
    left.facingRank - right.facingRank ||
    left.kindRank - right.kindRank ||
    left.distanceSquared - right.distanceSquared ||
    left.target.id.localeCompare(right.target.id)
  );
}

export function selectGrandCardTarget<
  T extends GrandCardTargetCandidate
>(
  targets: readonly T[],
  centerX: number,
  centerY: number,
  maximumDistance: number,
  facing: -1 | 1,
  sectionId: string | null
): T | null {
  const maximumDistanceSquared =
    maximumDistance * maximumDistance;
  const mirrorCore = sectionId === "MirrorCore";
  const ranked: RankedTarget<T>[] = [];

  for (const target of targets) {
    if (!target.active) {
      continue;
    }

    const deltaX = target.centerX - centerX;
    const deltaY = target.centerY - centerY;
    const distanceSquared =
      deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared > maximumDistanceSquared) {
      continue;
    }

    ranked.push({
      target,
      facingRank:
        mirrorCore && deltaX * facing < 0
          ? 1
          : 0,
      kindRank:
        mirrorCore &&
        target.group === "MirrorCore" &&
        target.kind === "caster"
          ? 0
          : mirrorCore
            ? 1
            : 0,
      distanceSquared
    });
  }

  ranked.sort(compareRankedTargets);
  return ranked[0]?.target ?? null;
}
