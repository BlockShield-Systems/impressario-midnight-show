export type MirrorConductorPhase = 1 | 2 | 3;

export const MIRROR_CONDUCTOR_MINIMUM_PHASE_DURATION = {
  1: 55,
  2: 60,
  3: 70
} as const;

export interface MirrorConductorThresholdCueState {
  readonly insideSection: boolean;
  readonly bossStarted: boolean;
  readonly bossDefeated: boolean;
  readonly finaleActive: boolean;
  readonly controlsLocked: boolean;
  readonly playerX: number;
  readonly thresholdX: number;
}

export function shouldShowMirrorConductorThresholdCue(
  state: MirrorConductorThresholdCueState
): boolean {
  return (
    state.insideSection &&
    !state.bossStarted &&
    !state.bossDefeated &&
    !state.finaleActive &&
    !state.controlsLocked &&
    state.playerX < state.thresholdX
  );
}

export function getMirrorConductorPhase(
  health: number
): MirrorConductorPhase {
  if (health <= 36) {
    return 3;
  }

  if (health <= 72) {
    return 2;
  }

  return 1;
}

export function applyMirrorConductorDamage(
  health: number,
  damage: number,
  phaseElapsed: number
): number {
  const phase = getMirrorConductorPhase(health);
  const requestedHealth = Math.max(
    0,
    health - damage
  );

  const phaseFloor =
    phase === 1
      ? phaseElapsed <
        MIRROR_CONDUCTOR_MINIMUM_PHASE_DURATION[1]
        ? 73
        : 37
      : phase === 2
        ? phaseElapsed <
          MIRROR_CONDUCTOR_MINIMUM_PHASE_DURATION[2]
          ? 37
          : 1
        : phaseElapsed <
            MIRROR_CONDUCTOR_MINIMUM_PHASE_DURATION[3]
          ? 1
          : 0;

  return Math.max(
    requestedHealth,
    phaseFloor
  );
}
