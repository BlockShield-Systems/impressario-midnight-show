import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMirrorConductorDamage,
  getMirrorConductorPhase
} from "../src/world/MirrorConductorPhase.ts";

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
