export type MirrorConductorPhase = 1 | 2 | 3;

export const MIRROR_CONDUCTOR_MINIMUM_PHASE_DURATION = {
  1: 55,
  2: 60,
  3: 70
} as const;

export const MIRROR_CONDUCTOR_INITIAL_HEALTH = 108;

export const MIRROR_CONDUCTOR_ARENA_BOUNDS = {
  left: 45472,
  right: 49248
} as const;

export const MIRROR_CONDUCTOR_ARENA_WALLS = [
  {
    x: 45448,
    y: 96,
    width: 24,
    height: 424
  },
  {
    x: 49248,
    y: 96,
    width: 24,
    height: 424
  }
] as const;

export const MIRROR_CONDUCTOR_PLATFORMS = [
  { x: 45472, y: 400, width: 256, height: 16 },
  { x: 45840, y: 464, width: 128, height: 16 },
  { x: 46048, y: 352, width: 256, height: 16 },
  { x: 46432, y: 448, width: 128, height: 16 },
  { x: 46624, y: 416, width: 256, height: 16 },
  { x: 46992, y: 464, width: 128, height: 16 },
  { x: 47200, y: 352, width: 288, height: 16 },
  { x: 47616, y: 464, width: 128, height: 16 },
  { x: 47840, y: 416, width: 256, height: 16 },
  { x: 48208, y: 448, width: 128, height: 16 },
  { x: 48416, y: 352, width: 256, height: 16 },
  { x: 48800, y: 464, width: 128, height: 16 },
  { x: 48992, y: 400, width: 256, height: 16 }
] as const;

export const MIRROR_CONDUCTOR_MOVEMENT_CYCLE_SECONDS = 8;
export const MIRROR_CONDUCTOR_MOVEMENT_LEG_SECONDS = 2;

export const MIRROR_CONDUCTOR_MOVEMENT_WAYPOINTS = [
  { x: 45872, y: 300 },
  { x: 47179, y: 210 },
  { x: 48768, y: 300 },
  { x: 47179, y: 270 },
  { x: 45872, y: 300 }
] as const;

export const MIRROR_CONDUCTOR_SHIELD_REARM_SECONDS = 12;
export const MIRROR_CONDUCTOR_SHIELD_DISPLACEMENT = 128;

export function getMirrorConductorPosition(
  elapsedSeconds: number
): { readonly x: number; readonly y: number } {
  const cycleTime =
    ((elapsedSeconds %
      MIRROR_CONDUCTOR_MOVEMENT_CYCLE_SECONDS) +
      MIRROR_CONDUCTOR_MOVEMENT_CYCLE_SECONDS) %
    MIRROR_CONDUCTOR_MOVEMENT_CYCLE_SECONDS;
  const leg = Math.min(
    MIRROR_CONDUCTOR_MOVEMENT_WAYPOINTS.length - 2,
    Math.floor(
      cycleTime /
        MIRROR_CONDUCTOR_MOVEMENT_LEG_SECONDS
    )
  );
  const linearProgress =
    (cycleTime -
      leg * MIRROR_CONDUCTOR_MOVEMENT_LEG_SECONDS) /
    MIRROR_CONDUCTOR_MOVEMENT_LEG_SECONDS;
  const easedProgress =
    linearProgress *
    linearProgress *
    (3 - 2 * linearProgress);
  const start =
    MIRROR_CONDUCTOR_MOVEMENT_WAYPOINTS[leg]!;
  const end =
    MIRROR_CONDUCTOR_MOVEMENT_WAYPOINTS[leg + 1]!;

  return {
    x: start.x + (end.x - start.x) * easedProgress,
    y: start.y + (end.y - start.y) * easedProgress
  };
}

export class MirrorConductorMovementCycle {
  private elapsed = 0;

  public reset(): void {
    this.elapsed = 0;
  }

  public update(
    deltaSeconds: number,
    simulationRunning = true
  ): { readonly x: number; readonly y: number } {
    if (simulationRunning) {
      this.elapsed += deltaSeconds;
    }

    return getMirrorConductorPosition(
      this.elapsed
    );
  }

  public get elapsedSeconds(): number {
    return this.elapsed;
  }
}

export class MirrorConductorShieldCycle {
  private anchorX = 0;
  private rearmRemaining: number | null = null;

  public reset(playerX: number): void {
    this.anchorX = playerX;
    this.rearmRemaining = null;
  }

  public canBreak(playerX: number): boolean {
    return (
      Math.abs(playerX - this.anchorX) >=
      MIRROR_CONDUCTOR_SHIELD_DISPLACEMENT
    );
  }

  public noteShieldBroken(): void {
    this.rearmRemaining =
      MIRROR_CONDUCTOR_SHIELD_REARM_SECONDS;
  }

  public update(
    deltaSeconds: number,
    playerX: number,
    simulationRunning = true
  ): boolean {
    if (
      !simulationRunning ||
      this.rearmRemaining === null
    ) {
      return false;
    }

    this.rearmRemaining = Math.max(
      0,
      this.rearmRemaining - deltaSeconds
    );

    if (this.rearmRemaining > 1e-9) {
      return false;
    }

    this.reset(playerX);
    return true;
  }

  public get displacementAnchorX(): number {
    return this.anchorX;
  }

  public get rearmSecondsRemaining(): number | null {
    return this.rearmRemaining;
  }
}

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
