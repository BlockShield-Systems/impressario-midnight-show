import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PickupRespawnState
} from "../src/magic/GrandCardState.ts";
import {
  MIRROR_CONDUCTOR_INITIAL_HEALTH,
  MirrorConductorCheckpointState,
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

test("phase checkpoint restores its exact snapshot and restarts the phase window", () => {
  const state =
    new MirrorConductorCheckpointState();
  const snapshot = state.capture(
    3,
    2,
    1,
    {
      ConductorCardLeft: 3.25,
      ConductorCardRight: 0,
      ConductorRoseLeft: 9.5,
      ConductorRoseRight: 1.75
    }
  );

  assert.deepEqual(snapshot, {
    phase: 3,
    bossHealth: 36,
    playerHealth: 2,
    grandCardCharges: 1,
    dropTimerRemainders: {
      ConductorCardLeft: 3.25,
      ConductorCardRight: 0,
      ConductorRoseLeft: 9.5,
      ConductorRoseRight: 1.75
    },
    spawnX: 49104,
    spawnY: 370,
    phaseElapsed: 0,
    shielded: true
  });
  assert.equal(
    applyMirrorConductorDamage(
      snapshot.bossHealth,
      999,
      snapshot.phaseElapsed
    ),
    1,
    "phase three must restart its 70-second minimum window"
  );
});

test("drop timers freeze during pause and never rewind across repeated deaths", () => {
  const drops = new PickupRespawnState();
  const checkpoint =
    new MirrorConductorCheckpointState();
  const ids = [
    "ConductorCardLeft",
    "ConductorCardRight",
    "ConductorRoseLeft",
    "ConductorRoseRight"
  ];

  drops.collect("ConductorCardLeft", 8);
  drops.collect("ConductorRoseLeft", 14);
  drops.update(3);
  const beforePause = drops.snapshot(ids);
  drops.update(30, false);
  assert.deepEqual(drops.snapshot(ids), beforePause);

  checkpoint.capture(
    2,
    3,
    2,
    drops.snapshot(ids)
  );
  drops.update(2);
  checkpoint.preserveDropTimers(
    drops.snapshot(ids)
  );
  const firstDeath = checkpoint.restore();
  assert.equal(
    firstDeath?.dropTimerRemainders
      .ConductorCardLeft,
    3
  );
  assert.equal(
    firstDeath?.dropTimerRemainders
      .ConductorRoseLeft,
    9
  );

  drops.update(1);
  checkpoint.preserveDropTimers(
    drops.snapshot(ids)
  );
  const secondDeath = checkpoint.restore();
  assert.equal(
    secondDeath?.dropTimerRemainders
      .ConductorCardLeft,
    2,
    "death cannot rewind a card timer"
  );
  assert.equal(
    secondDeath?.dropTimerRemainders
      .ConductorRoseLeft,
    8,
    "death cannot rewind a heart timer"
  );
});

test("a second run starts phase one after the first run reached phase three", () => {
  const state =
    new MirrorConductorCheckpointState();

  state.capture(3, 1, 0, {
    ConductorRoseLeft: 8
  });
  assert.equal(state.restore()?.phase, 3);

  state.beginRun();
  assert.equal(state.restore(), null);
  assert.equal(
    getMirrorConductorPhase(
      MIRROR_CONDUCTOR_INITIAL_HEALTH
    ),
    1
  );
});

test("runtime clears phase state at fresh entry, section exit, and boss defeat", async () => {
  const source = await readFile(
    new URL(
      "../src/world/MirrorConductorSystem.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /!this\.wasInsideSection &&\s*insideSection[\s\S]*this\.beginFreshRun\(\)/
  );
  assert.match(
    source,
    /this\.wasInsideSection &&\s*!insideSection[\s\S]*this\.clearFinaleRunState\(\)/
  );
  assert.match(
    source,
    /this\.bossDefeated = true;[\s\S]*this\.clearFinaleRunState\(\)/
  );
  assert.match(
    source,
    /restorePhaseCheckpoint\([\s\S]*this\.shielded = checkpoint\.shielded;[\s\S]*checkpoint\.phaseElapsed;/
  );
  assert.match(
    source,
    /this\.elapsed = 0;[\s\S]*this\.projectiles\.length = 0;[\s\S]*restorePhaseCheckpoint/
  );
  assert.match(
    source,
    /if \(distance <= 190\) \{\s*this\.conductor\.breakShield\(\);/
  );
});
