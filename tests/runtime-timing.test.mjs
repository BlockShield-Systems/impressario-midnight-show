import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXED_TIMESTEP_SECONDS,
  MAX_ACTIVE_FRAME_SECONDS,
  MAX_CATCH_UP_STEPS,
  advanceFixedStepFrame
} from "../src/runtime/FixedStepTiming.ts";

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
  "inactive-tab resume is discarded instead of causing uncontrolled catch-up",
  () => {
    const frame = advanceFixedStepFrame(
      5000,
      FIXED_TIMESTEP_SECONDS / 2
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
