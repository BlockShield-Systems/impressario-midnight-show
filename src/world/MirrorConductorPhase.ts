export type MirrorConductorPhase = 1 | 2 | 3;

export const MIRROR_CONDUCTOR_MINIMUM_PHASE_DURATION = {
  1: 55,
  2: 60,
  3: 70
} as const;

export const MIRROR_CONDUCTOR_INITIAL_HEALTH = 108;

export const MIRROR_CONDUCTOR_PHASE_START = {
  2: {
    health: 72,
    spawnX: 45584,
    spawnY: 370
  },
  3: {
    health: 36,
    spawnX: 49104,
    spawnY: 370
  }
} as const;

export type MirrorConductorCheckpointPhase = 2 | 3;

export interface MirrorConductorPhaseCheckpoint {
  readonly phase: MirrorConductorCheckpointPhase;
  readonly bossHealth: 72 | 36;
  readonly playerHealth: number;
  readonly grandCardCharges: number;
  readonly dropTimerRemainders:
    Readonly<Record<string, number>>;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly phaseElapsed: 0;
  readonly shielded: true;
}

export class MirrorConductorCheckpointState {
  private checkpoint:
    MirrorConductorPhaseCheckpoint | null = null;

  public beginRun(): void {
    this.checkpoint = null;
  }

  public capture(
    phase: MirrorConductorCheckpointPhase,
    playerHealth: number,
    grandCardCharges: number,
    dropTimerRemainders:
      Readonly<Record<string, number>>
  ): MirrorConductorPhaseCheckpoint {
    const phaseStart =
      MIRROR_CONDUCTOR_PHASE_START[phase];

    this.checkpoint = {
      phase,
      bossHealth: phaseStart.health,
      playerHealth,
      grandCardCharges,
      dropTimerRemainders: {
        ...dropTimerRemainders
      },
      spawnX: phaseStart.spawnX,
      spawnY: phaseStart.spawnY,
      phaseElapsed: 0,
      shielded: true
    };

    return this.restore()!;
  }

  public preserveDropTimers(
    dropTimerRemainders:
      Readonly<Record<string, number>>
  ): void {
    if (!this.checkpoint) {
      return;
    }

    this.checkpoint = {
      ...this.checkpoint,
      dropTimerRemainders: {
        ...dropTimerRemainders
      }
    };
  }

  public restore():
  MirrorConductorPhaseCheckpoint | null {
    return this.checkpoint
      ? {
          ...this.checkpoint,
          dropTimerRemainders: {
            ...this.checkpoint
              .dropTimerRemainders
          }
        }
      : null;
  }

  public clear(): void {
    this.checkpoint = null;
  }
}

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
