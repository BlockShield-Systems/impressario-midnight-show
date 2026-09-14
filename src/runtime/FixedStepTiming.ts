export const FIXED_TIMESTEP_SECONDS =
  1 / 120;

export const MAX_ACTIVE_FRAME_SECONDS =
  0.4;

export const MAX_CATCH_UP_STEPS = 48;

export const MAX_ACCUMULATOR_SECONDS =
  MAX_CATCH_UP_STEPS *
  FIXED_TIMESTEP_SECONDS;

export interface FixedStepFrame {
  readonly acceptedSeconds: number;
  readonly discardedSeconds: number;
  readonly steps: number;
  readonly accumulatorSeconds: number;
}

export function advanceFixedStepFrame(
  deltaMilliseconds: number,
  accumulatorSeconds: number,
  resynchronize = false
): FixedStepFrame {
  const elapsedSeconds =
    Number.isFinite(deltaMilliseconds)
      ? Math.max(
          0,
          deltaMilliseconds / 1000
        )
      : 0;

  if (resynchronize) {
    return {
      acceptedSeconds: 0,
      discardedSeconds: elapsedSeconds,
      steps: 0,
      accumulatorSeconds: 0
    };
  }

  const safeAccumulator =
    Number.isFinite(accumulatorSeconds)
      ? Math.max(
          0,
          Math.min(
            accumulatorSeconds,
            FIXED_TIMESTEP_SECONDS
          )
        )
      : 0;

  const acceptedSeconds = Math.min(
    elapsedSeconds,
    MAX_ACTIVE_FRAME_SECONDS,
    MAX_ACCUMULATOR_SECONDS -
      safeAccumulator
  );

  let nextAccumulator =
    safeAccumulator +
    acceptedSeconds;

  const availableSteps = Math.floor(
    (
      nextAccumulator +
      Number.EPSILON
    ) /
    FIXED_TIMESTEP_SECONDS
  );

  const steps = Math.min(
    availableSteps,
    MAX_CATCH_UP_STEPS
  );

  nextAccumulator -=
    steps * FIXED_TIMESTEP_SECONDS;

  return {
    acceptedSeconds,
    discardedSeconds:
      Math.max(
        0,
        elapsedSeconds -
          acceptedSeconds
      ),
    steps,
    accumulatorSeconds:
      Math.max(0, nextAccumulator)
  };
}
