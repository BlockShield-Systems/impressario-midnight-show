export type MirrorConductorPhase = 1 | 2 | 3;

export const MIRROR_CONDUCTOR_MINIMUM_PHASE_DURATION = {
  1: 55,
  2: 60,
  3: 70
} as const;

export const MIRROR_CONDUCTOR_INITIAL_HEALTH = 108;

export const MIRROR_CONDUCTOR_ARENA_BOUNDS = {
  left: 45552,
  right: 49136
} as const;

export const MIRROR_CONDUCTOR_ARENA_WALLS = [
  {
    x: 45528,
    y: 96,
    width: 24,
    height: 424
  },
  {
    x: 49136,
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

export type MirrorConductorMovementState =
  | "hold"
  | "telegraph"
  | "travel";

export type MirrorConductorBeamState =
  | "off"
  | "telegraph"
  | "active";

export const MIRROR_CONDUCTOR_ANCHORS = [
  { id: "A", x: 46155, y: 138 },
  { id: "B", x: 47323, y: 138 },
  { id: "C", x: 48523, y: 138 },
  { id: "D", x: 48120, y: 306 }
] as const;

export const MIRROR_CONDUCTOR_HOLD_SECONDS = 3;
export const MIRROR_CONDUCTOR_TELEGRAPH_SECONDS = 1;
export const MIRROR_CONDUCTOR_TRAVEL_SECONDS = [
  6.677,
  6.83,
  403 / 190,
  1965 / 190 + (9.479 - 1584 / 190)
] as const;
export const MIRROR_CONDUCTOR_BEAM_TELEGRAPH_SECONDS = 0.65;
export const MIRROR_CONDUCTOR_BEAM_ACTIVE_SECONDS = 0.3;
export const MIRROR_CONDUCTOR_BEAM_ACTIVE_START =
  MIRROR_CONDUCTOR_HOLD_SECONDS -
  MIRROR_CONDUCTOR_BEAM_ACTIVE_SECONDS;
export const MIRROR_CONDUCTOR_BEAM_TELEGRAPH_START =
  MIRROR_CONDUCTOR_BEAM_ACTIVE_START -
  MIRROR_CONDUCTOR_BEAM_TELEGRAPH_SECONDS;
export const MIRROR_CONDUCTOR_BEAM_REACH = 480;
export const MIRROR_CONDUCTOR_MOVEMENT_CYCLE_SECONDS =
  MIRROR_CONDUCTOR_ANCHORS.reduce(
    (total, _anchor, index) =>
      total +
      MIRROR_CONDUCTOR_HOLD_SECONDS +
      MIRROR_CONDUCTOR_TELEGRAPH_SECONDS +
      MIRROR_CONDUCTOR_TRAVEL_SECONDS[index]!,
    0
  );

export const MIRROR_CONDUCTOR_SHIELD_REARM_SECONDS = 12;
export const MIRROR_CONDUCTOR_SHIELD_DISPLACEMENT = 128;

export interface MirrorConductorMovementSnapshot {
  readonly x: number;
  readonly y: number;
  readonly state: MirrorConductorMovementState;
  readonly stateElapsed: number;
  readonly anchorIndex: number;
  readonly destinationIndex: number;
  readonly beamState: MirrorConductorBeamState;
  readonly beamTelegraphStarted: boolean;
}

export function getMirrorConductorBeamState(
  movementState: MirrorConductorMovementState,
  stateElapsed: number
): MirrorConductorBeamState {
  if (movementState !== "hold") {
    return "off";
  }

  if (
    stateElapsed >=
    MIRROR_CONDUCTOR_BEAM_ACTIVE_START
  ) {
    return "active";
  }

  if (
    stateElapsed >=
    MIRROR_CONDUCTOR_BEAM_TELEGRAPH_START
  ) {
    return "telegraph";
  }

  return "off";
}

export class MirrorConductorMovementCycle {
  private state: MirrorConductorMovementState = "hold";
  private stateElapsed = 0;
  private anchorIndex = 0;
  private elapsed = 0;

  public reset(): void {
    this.state = "hold";
    this.stateElapsed = 0;
    this.anchorIndex = 0;
    this.elapsed = 0;
  }

  public update(
    deltaSeconds: number,
    simulationRunning = true
  ): MirrorConductorMovementSnapshot {
    let remaining = simulationRunning
      ? Math.max(0, deltaSeconds)
      : 0;
    let beamTelegraphStarted = false;

    this.elapsed += remaining;

    while (remaining > 1e-9) {
      const duration = this.stateDuration;
      const step = Math.min(
        remaining,
        duration - this.stateElapsed
      );
      const previousElapsed = this.stateElapsed;

      this.stateElapsed += step;
      remaining -= step;

      if (
        this.state === "hold" &&
        previousElapsed <
          MIRROR_CONDUCTOR_BEAM_TELEGRAPH_START &&
        this.stateElapsed >=
          MIRROR_CONDUCTOR_BEAM_TELEGRAPH_START
      ) {
        beamTelegraphStarted = true;
      }

      if (this.stateElapsed >= duration - 1e-9) {
        this.advanceState();
      }
    }

    return this.snapshot(
      beamTelegraphStarted
    );
  }

  public get current(): MirrorConductorMovementSnapshot {
    return this.snapshot(false);
  }

  public get elapsedSeconds(): number {
    return this.elapsed;
  }

  private get stateDuration(): number {
    if (this.state === "hold") {
      return MIRROR_CONDUCTOR_HOLD_SECONDS;
    }

    if (this.state === "telegraph") {
      return MIRROR_CONDUCTOR_TELEGRAPH_SECONDS;
    }

    return MIRROR_CONDUCTOR_TRAVEL_SECONDS[
      this.anchorIndex
    ]!;
  }

  private advanceState(): void {
    this.stateElapsed = 0;

    if (this.state === "hold") {
      this.state = "telegraph";
      return;
    }

    if (this.state === "telegraph") {
      this.state = "travel";
      return;
    }

    this.anchorIndex =
      (this.anchorIndex + 1) %
      MIRROR_CONDUCTOR_ANCHORS.length;
    this.state = "hold";
  }

  private snapshot(
    beamTelegraphStarted: boolean
  ): MirrorConductorMovementSnapshot {
    const destinationIndex =
      (this.anchorIndex + 1) %
      MIRROR_CONDUCTOR_ANCHORS.length;
    const start =
      MIRROR_CONDUCTOR_ANCHORS[
        this.anchorIndex
      ]!;
    const destination =
      MIRROR_CONDUCTOR_ANCHORS[
        destinationIndex
      ]!;
    let x = start.x;
    let y = start.y;

    if (this.state === "travel") {
      const progress =
        this.stateElapsed /
        MIRROR_CONDUCTOR_TRAVEL_SECONDS[
          this.anchorIndex
        ]!;
      const eased =
        progress * progress *
        (3 - 2 * progress);
      x += (destination.x - start.x) * eased;
      y += (destination.y - start.y) * eased;
    }

    return {
      x,
      y,
      state: this.state,
      stateElapsed: this.stateElapsed,
      anchorIndex: this.anchorIndex,
      destinationIndex,
      beamState: getMirrorConductorBeamState(
        this.state,
        this.stateElapsed
      ),
      beamTelegraphStarted
    };
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
    simulationRunning = true,
    deferRearm = false
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

    if (
      this.rearmRemaining > 1e-9 ||
      deferRearm
    ) {
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
