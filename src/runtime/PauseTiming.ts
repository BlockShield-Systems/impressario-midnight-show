export interface SimulationTimingState {
  readonly accumulatorSeconds: number;
  readonly fixedStepInitialized: boolean;
}

export function resetSimulationTimingForPause():
SimulationTimingState {
  return {
    accumulatorSeconds: 0,
    fixedStepInitialized: false
  };
}
