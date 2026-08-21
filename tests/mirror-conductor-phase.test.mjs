import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMirrorConductorDamage,
  getMirrorConductorPhase,
  shouldShowMirrorConductorThresholdCue
} from "../src/world/MirrorConductorPhase.ts";

test("threshold cue appears only before the boss trigger inside its section", () => {
  const ready = {
    insideSection: true,
    bossStarted: false,
    bossDefeated: false,
    finaleActive: false,
    controlsLocked: false,
    playerX: 45_200,
    thresholdX: 45_312
  };

  assert.equal(
    shouldShowMirrorConductorThresholdCue(ready),
    true
  );
  assert.equal(
    shouldShowMirrorConductorThresholdCue({
      ...ready,
      playerX: ready.thresholdX
    }),
    false,
    "crossing the threshold clears the cue"
  );
  assert.equal(
    shouldShowMirrorConductorThresholdCue({
      ...ready,
      insideSection: false,
      playerX: 40_000
    }),
    false,
    "earlier unrelated sections cannot display the cue"
  );
  assert.equal(
    shouldShowMirrorConductorThresholdCue({
      ...ready,
      insideSection: false,
      playerX: 50_000
    }),
    false,
    "section exit and later positions clear the cue"
  );
  assert.equal(
    shouldShowMirrorConductorThresholdCue({
      ...ready,
      controlsLocked: true
    }),
    false,
    "death/control lock clears the cue"
  );
  assert.equal(
    shouldShowMirrorConductorThresholdCue({
      ...ready,
      bossStarted: true
    }),
    false,
    "boss start clears the cue"
  );
  assert.equal(
    shouldShowMirrorConductorThresholdCue({
      ...ready,
      bossStarted: false
    }),
    true,
    "an encounter restart before crossing restores the cue only in context"
  );
  assert.equal(
    shouldShowMirrorConductorThresholdCue({
      ...ready,
      bossDefeated: true
    }),
    false,
    "defeat clears the cue"
  );
  assert.equal(
    shouldShowMirrorConductorThresholdCue({
      ...ready,
      finaleActive: true
    }),
    false,
    "finale clears the cue"
  );
});

test("exact health thresholds select the intended phase", () => {
  assert.equal(getMirrorConductorPhase(73), 1);
  assert.equal(getMirrorConductorPhase(72), 2);
  assert.equal(getMirrorConductorPhase(37), 2);
  assert.equal(getMirrorConductorPhase(36), 3);
});

test("burst damage cannot skip phase two after phase one unlocks", () => {
  assert.equal(
    applyMirrorConductorDamage(108, 999, 54.999),
    73
  );
  assert.equal(
    applyMirrorConductorDamage(73, 999, 55),
    37
  );
});

test("burst damage cannot skip phase three after phase two unlocks", () => {
  assert.equal(
    applyMirrorConductorDamage(37, 999, 59.999),
    37
  );
  assert.equal(
    applyMirrorConductorDamage(37, 999, 60),
    1
  );
});

test("defeat remains locked until the phase-three window completes", () => {
  assert.equal(
    applyMirrorConductorDamage(1, 999, 69.999),
    1
  );
  assert.equal(
    applyMirrorConductorDamage(1, 999, 70),
    0
  );
});
