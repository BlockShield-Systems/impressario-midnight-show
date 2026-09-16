export const KALEIDOSCOPE_CENTER_X = 36768;
export const KALEIDOSCOPE_CENTER_Y = 336;
export const KALEIDOSCOPE_BEAM_LENGTH = 544;
export const KALEIDOSCOPE_ANGULAR_SPEED = 0.9;

/*
 * The authored platforms flanking the emitter end at x=36720 and begin at
 * x=36848. Including the 18px-wide player body, a fully supported side
 * change is 128 + 18 = 146px. A 1.5s run at 190px/s covers 285px, leaving
 * 139px of margin without requiring a dash.
 */
export const KALEIDOSCOPE_SIDE_CHANGE_DISTANCE = 146;
export const KALEIDOSCOPE_RUN_ONLY_DISTANCE = 285;

export const KALEIDOSCOPE_OFF_SECONDS = 1.5;
export const KALEIDOSCOPE_TELEGRAPH_SECONDS = 0.65;
export const KALEIDOSCOPE_ACTIVE_SECONDS = 1.85;

export const KALEIDOSCOPE_CYCLE_SECONDS =
  KALEIDOSCOPE_OFF_SECONDS +
  KALEIDOSCOPE_TELEGRAPH_SECONDS +
  KALEIDOSCOPE_ACTIVE_SECONDS;

export type KaleidoscopeHazardPhase =
  | "off"
  | "telegraph"
  | "active";

export function getKaleidoscopeHazardPhase(
  simulationElapsedSeconds: number
): KaleidoscopeHazardPhase {
  const cycleElapsed =
    (
      simulationElapsedSeconds %
      KALEIDOSCOPE_CYCLE_SECONDS
    ) + KALEIDOSCOPE_CYCLE_SECONDS;
  const normalizedElapsed =
    cycleElapsed %
    KALEIDOSCOPE_CYCLE_SECONDS;

  if (
    normalizedElapsed <
    KALEIDOSCOPE_OFF_SECONDS
  ) {
    return "off";
  }

  if (
    normalizedElapsed <
    KALEIDOSCOPE_OFF_SECONDS +
      KALEIDOSCOPE_TELEGRAPH_SECONDS
  ) {
    return "telegraph";
  }

  return "active";
}

export function isKaleidoscopeBeamDamaging(
  simulationElapsedSeconds: number
): boolean {
  return (
    getKaleidoscopeHazardPhase(
      simulationElapsedSeconds
    ) === "active"
  );
}

export function advanceKaleidoscopeHazardTime(
  simulationElapsedSeconds: number,
  deltaSeconds: number,
  simulationRunning = true
): number {
  if (!simulationRunning) {
    return simulationElapsedSeconds;
  }

  return (
    simulationElapsedSeconds +
    Math.max(0, deltaSeconds)
  );
}
