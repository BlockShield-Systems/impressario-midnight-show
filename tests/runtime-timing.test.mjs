import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXED_TIMESTEP_SECONDS,
  MAX_ACCUMULATOR_SECONDS,
  MAX_ACTIVE_FRAME_SECONDS,
  MAX_CATCH_UP_STEPS,
  advanceFixedStepFrame
} from "../src/runtime/FixedStepTiming.ts";
import {
  resetSimulationTimingForPause
} from "../src/runtime/PauseTiming.ts";

const representativeDeltas = [
  16.67,
  33.33,
  50,
  66.67,
  100,
  316.7
];

test(
  "active low-FPS frames preserve elapsed time with bounded fixed steps",
  () => {
    let accumulator = 0;
    let accepted = 0;
    let discarded = 0;
    let steps = 0;
    let displacement = 0;
    let animationProgress = 0;
    let tweenProgress = 0;

    const samples = [];

    for (const delta of representativeDeltas) {
      const frame = advanceFixedStepFrame(
        delta,
        accumulator
      );

      accumulator =
        frame.accumulatorSeconds;
      accepted += frame.acceptedSeconds;
      discarded += frame.discardedSeconds;
      steps += frame.steps;

      displacement +=
        frame.steps *
        FIXED_TIMESTEP_SECONDS *
        190;

      animationProgress +=
        frame.acceptedSeconds;
      tweenProgress = Math.min(
        1,
        tweenProgress +
          frame.acceptedSeconds
      );

      samples.push({
        delta,
        accepted: frame.acceptedSeconds,
        discarded: frame.discardedSeconds,
        steps: frame.steps
      });
    }

    const wallSeconds =
      representativeDeltas.reduce(
        (sum, delta) => sum + delta,
        0
      ) / 1000;

    assert.equal(
      samples.at(-1).accepted,
      0.3167
    );
    assert.equal(
      samples.at(-1).discarded,
      0
    );
    assert.equal(
      samples.at(-1).steps,
      38
    );
    assert.ok(
      Math.abs(accepted - wallSeconds) <
        1e-12
    );
    assert.equal(discarded, 0);
    assert.ok(
      Math.abs(
        accepted / wallSeconds - 1
      ) < 1e-12
    );
    assert.ok(
      Math.abs(
        displacement -
        steps *
          FIXED_TIMESTEP_SECONDS *
          190
      ) < 1e-12
    );
    assert.ok(
      Math.abs(
        animationProgress -
        wallSeconds
      ) < 1e-12
    );
    assert.ok(
      Math.abs(
        tweenProgress -
        Math.min(1, wallSeconds)
      ) < 1e-12
    );
    assert.ok(
      accumulator <
        FIXED_TIMESTEP_SECONDS
    );
  }
);

test(
  "sustained ten-FPS delivery catches up without changing movement constants",
  () => {
    let accumulator = 0;
    let accepted = 0;
    let steps = 0;

    for (let frameIndex = 0;
      frameIndex < 10;
      frameIndex += 1) {
      const frame = advanceFixedStepFrame(
        100,
        accumulator
      );

      accumulator =
        frame.accumulatorSeconds;
      accepted += frame.acceptedSeconds;
      steps += frame.steps;

      assert.ok(
        frame.steps <= MAX_CATCH_UP_STEPS
      );
    }

    assert.ok(
      Math.abs(accepted - 1) < 1e-12
    );
    assert.equal(steps, 120);
    assert.ok(
      Math.abs(
        steps *
          FIXED_TIMESTEP_SECONDS -
        1
      ) < 1e-12
    );
  }
);

test(
  "startup-sized active stalls cannot leave retained catch-up backlog",
  () => {
    const frame = advanceFixedStepFrame(
      399,
      30
    );

    assert.equal(
      frame.steps,
      MAX_CATCH_UP_STEPS
    );
    assert.ok(
      frame.accumulatorSeconds <
        FIXED_TIMESTEP_SECONDS
    );
    assert.ok(
      frame.acceptedSeconds <=
        MAX_ACCUMULATOR_SECONDS
    );
    assert.ok(
      frame.discardedSeconds > 0
    );
  }
);

test(
  "first playable frame can resynchronize without simulating pre-game time",
  () => {
    const frame = advanceFixedStepFrame(
      250,
      FIXED_TIMESTEP_SECONDS / 2,
      true
    );

    assert.equal(frame.acceptedSeconds, 0);
    assert.equal(frame.discardedSeconds, 0.25);
    assert.equal(frame.steps, 0);
    assert.equal(frame.accumulatorSeconds, 0);
  }
);

test(
  "inactive-tab resume is discarded instead of causing uncontrolled catch-up",
  () => {
    const frame = advanceFixedStepFrame(
      5000,
      FIXED_TIMESTEP_SECONDS / 2,
      true
    );

    assert.equal(
      MAX_ACTIVE_FRAME_SECONDS,
      0.4
    );
    assert.equal(frame.acceptedSeconds, 0);
    assert.equal(frame.discardedSeconds, 5);
    assert.equal(frame.steps, 0);
    assert.equal(
      frame.accumulatorSeconds,
      0
    );
  }
);

test(
  "pause keeps wall-clock duration authoritative and resumes without accumulator backlog",
  () => {
    const runStartedAt = 10_000;
    const pausedAt = 14_000;
    const resumedAt = 44_000;
    const runFinishedAt = 50_000;
    const timing =
      resetSimulationTimingForPause();

    assert.equal(
      runFinishedAt - runStartedAt,
      40_000,
      "submitted wall time includes the entire 30-second pause"
    );
    assert.equal(resumedAt - pausedAt, 30_000);
    assert.equal(timing.accumulatorSeconds, 0);
    assert.equal(timing.fixedStepInitialized, false);

    const resumeFrame = advanceFixedStepFrame(
      resumedAt - pausedAt,
      timing.accumulatorSeconds,
      !timing.fixedStepInitialized
    );

    assert.equal(resumeFrame.acceptedSeconds, 0);
    assert.equal(resumeFrame.discardedSeconds, 30);
    assert.equal(resumeFrame.steps, 0);
    assert.equal(resumeFrame.accumulatorSeconds, 0);

    const nextFrame = advanceFixedStepFrame(
      1000 / 60,
      resumeFrame.accumulatorSeconds
    );

    assert.equal(nextFrame.steps, 2);
    assert.ok(
      nextFrame.accumulatorSeconds <
        FIXED_TIMESTEP_SECONDS
    );
  }
);

test(
  "very slow active rendering advances a bounded slice without retaining backlog",
  () => {
    const frame = advanceFixedStepFrame(
      5000,
      0
    );

    assert.equal(
      frame.acceptedSeconds,
      MAX_ACTIVE_FRAME_SECONDS
    );
    assert.equal(frame.discardedSeconds, 4.6);
    assert.equal(
      frame.steps,
      MAX_CATCH_UP_STEPS
    );
    assert.ok(
      frame.accumulatorSeconds <
        FIXED_TIMESTEP_SECONDS
    );
  }
);
