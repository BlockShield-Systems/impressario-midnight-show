import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  KALEIDOSCOPE_ACTIVE_SECONDS,
  KALEIDOSCOPE_CYCLE_SECONDS,
  KALEIDOSCOPE_OFF_SECONDS,
  KALEIDOSCOPE_RUN_ONLY_DISTANCE,
  KALEIDOSCOPE_SIDE_CHANGE_DISTANCE,
  KALEIDOSCOPE_TELEGRAPH_SECONDS,
  advanceKaleidoscopeHazardTime,
  getKaleidoscopeHazardPhase,
  isKaleidoscopeBeamDamaging
} from "../src/world/KaleidoscopeHazardTiming.ts";

const EPSILON = 1e-6;

function accumulate(stepSeconds, durationSeconds) {
  let elapsed = 0;
  let stepIndex = 0;

  while (elapsed < durationSeconds - EPSILON) {
    const step = stepSeconds[stepIndex % stepSeconds.length];
    elapsed = advanceKaleidoscopeHazardTime(
      elapsed,
      Math.min(step, durationSeconds - elapsed)
    );
    stepIndex += 1;
  }

  return elapsed;
}

test("the recurring safe window is deterministic across frame-step sequences", () => {
  assert.equal(KALEIDOSCOPE_CYCLE_SECONDS, 4);
  assert.equal(KALEIDOSCOPE_OFF_SECONDS, 1.5);
  assert.equal(KALEIDOSCOPE_TELEGRAPH_SECONDS, 0.65);
  assert.equal(KALEIDOSCOPE_ACTIVE_SECONDS, 1.85);

  const stepSequences = [
    [1 / 120],
    [1 / 60],
    [1 / 144],
    [0.011, 0.029, 0.007, 0.021]
  ];

  for (const steps of stepSequences) {
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const cycleStart = cycle * KALEIDOSCOPE_CYCLE_SECONDS;
      const offSample = accumulate(steps, cycleStart + 1.49);
      const telegraphSample = accumulate(steps, cycleStart + 2.14);
      const activeSample = accumulate(steps, cycleStart + 2.16);

      assert.equal(getKaleidoscopeHazardPhase(offSample), "off");
      assert.equal(getKaleidoscopeHazardPhase(telegraphSample), "telegraph");
      assert.equal(getKaleidoscopeHazardPhase(activeSample), "active");
    }
  }
});

test("off and telegraph phases explicitly disable beam collision", () => {
  assert.equal(isKaleidoscopeBeamDamaging(0), false);
  assert.equal(isKaleidoscopeBeamDamaging(1.499), false);
  assert.equal(isKaleidoscopeBeamDamaging(1.5), false);
  assert.equal(isKaleidoscopeBeamDamaging(2.149), false);
  assert.equal(isKaleidoscopeBeamDamaging(2.15), true);
  assert.equal(isKaleidoscopeBeamDamaging(3.999), true);
  assert.equal(isKaleidoscopeBeamDamaging(4), false);
});

test("a simulated pause preserves the hazard phase exactly", () => {
  const beforePause = advanceKaleidoscopeHazardTime(0, 1.2);
  const duringPause = advanceKaleidoscopeHazardTime(
    beforePause,
    30,
    false
  );

  assert.equal(duringPause, beforePause);
  assert.equal(getKaleidoscopeHazardPhase(duringPause), "off");

  const afterResume = advanceKaleidoscopeHazardTime(
    duringPause,
    0.31
  );

  assert.equal(getKaleidoscopeHazardPhase(afterResume), "telegraph");
});

test("run-only movement clears the authored side-change distance with margin", () => {
  assert.equal(KALEIDOSCOPE_SIDE_CHANGE_DISTANCE, 146);
  assert.equal(KALEIDOSCOPE_RUN_ONLY_DISTANCE, 285);
  assert.equal(
    KALEIDOSCOPE_RUN_ONLY_DISTANCE -
      KALEIDOSCOPE_SIDE_CHANGE_DISTANCE,
    139
  );
});

test("MirrorCore collision is gated by active phase rather than rendering", async () => {
  const source = await readFile(
    new URL(
      "../src/world/MirrorCoreSystem.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /!isKaleidoscopeBeamDamaging\(\s*this\.gauntletBeamElapsed\s*\)/
  );
  assert.match(
    source,
    /this\.gauntletBeamElapsed \*\s*KALEIDOSCOPE_ANGULAR_SPEED/
  );
  assert.doesNotMatch(source, /Date\.now\(\)/);
});

test("the existing hazard cues are manifested and loaded for MirrorCore", async () => {
  const manifest = await readFile(
    new URL(
      "../public/assets/audio/audio-manifest.json",
      import.meta.url
    ),
    "utf8"
  );
  const loadPlan = await readFile(
    new URL(
      "../src/audio/AudioLoadPlan.ts",
      import.meta.url
    ),
    "utf8"
  );
  const mirrorCorePlan = loadPlan.slice(
    loadPlan.indexOf("MirrorCore:"),
    loadPlan.indexOf("ConductorApproach:")
  );

  assert.match(manifest, /"id": "world_hazard_telegraph"/);
  assert.match(manifest, /"id": "world_hazard_active"/);
  assert.match(mirrorCorePlan, /"world_hazard_telegraph"/);
  assert.match(mirrorCorePlan, /"world_hazard_active"/);
});
