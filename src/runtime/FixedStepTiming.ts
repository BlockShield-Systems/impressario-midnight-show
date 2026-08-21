export const FIXED_TIMESTEP_SECONDS =
  1 / 120;

export const MAX_ACTIVE_FRAME_SECONDS =
  0.4;

export const MAX_CATCH_UP_STEPS = 48;

export interface FixedStepFrame {
  readonly acceptedSeconds: number;
  readonly discardedSeconds: number;
  readonly steps: number;
  readonly accumulatorSeconds: number;
}

export function advanceFixedStepFrame(
  deltaMilliseconds: number,
  accumulatorSeconds: number
): FixedStepFrame {
  const elapsedSeconds =
    Number.isFinite(deltaMilliseconds)
      ? Math.max(
          0,
          deltaMilliseconds / 1000
        )
      : 0;

  const activeFrame =
    elapsedSeconds <=
    MAX_ACTIVE_FRAME_SECONDS;

  const acceptedSeconds =
    activeFrame
      ? elapsedSeconds
      : 0;

  let nextAccumulator =
    activeFrame
      ? accumulatorSeconds +
        acceptedSeconds
      : 0;

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
      elapsedSeconds -
      acceptedSeconds,
    steps,
    accumulatorSeconds:
      Math.max(0, nextAccumulator)
  };
}
