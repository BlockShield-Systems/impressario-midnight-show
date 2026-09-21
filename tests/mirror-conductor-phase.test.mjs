import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PickupRespawnState
} from "../src/magic/GrandCardState.ts";
import {
  MIRROR_CONDUCTOR_ARENA_BOUNDS,
  MIRROR_CONDUCTOR_ARENA_WALLS,
  MIRROR_CONDUCTOR_INITIAL_HEALTH,
  MIRROR_CONDUCTOR_MOVEMENT_WAYPOINTS,
  MIRROR_CONDUCTOR_PLATFORMS,
  MIRROR_CONDUCTOR_SHIELD_REARM_SECONDS,
  MirrorConductorCheckpointState,
  MirrorConductorMovementCycle,
  MirrorConductorShieldCycle,
  applyMirrorConductorDamage,
  getMirrorConductorPhase,
  getMirrorConductorPosition,
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
    /distance <= 190 &&[\s\S]*this\.shieldCycle\.canBreak\([\s\S]*this\.conductor\.breakShield\(\)/
  );
});

test("movement cycle is frame-step independent, pause-preserving, and bounded", () => {
  const singleStep =
    new MirrorConductorMovementCycle();
  const splitSteps =
    new MirrorConductorMovementCycle();
  const expectedElapsed = 5.75;

  const singlePosition =
    singleStep.update(expectedElapsed);
  let splitPosition = splitSteps.update(0);

  for (const delta of [
    0.5,
    0.25,
    1,
    0.125,
    2,
    0.375,
    1.5
  ]) {
    splitPosition = splitSteps.update(delta);
  }

  assert.equal(
    splitSteps.elapsedSeconds,
    expectedElapsed
  );
  assert.ok(
    Math.abs(splitPosition.x - singlePosition.x) < 1e-9
  );
  assert.ok(
    Math.abs(splitPosition.y - singlePosition.y) < 1e-9
  );

  const beforePause = { ...splitPosition };
  splitPosition = splitSteps.update(30, false);
  assert.deepEqual(splitPosition, beforePause);
  assert.equal(
    splitSteps.elapsedSeconds,
    expectedElapsed
  );

  for (let time = 0; time <= 16; time += 0.01) {
    const position = getMirrorConductorPosition(time);
    assert.ok(
      position.x >= MIRROR_CONDUCTOR_ARENA_BOUNDS.left &&
      position.x <= MIRROR_CONDUCTOR_ARENA_BOUNDS.right,
      `boss x ${position.x} escaped at ${time}`
    );
  }

  for (
    let index = 0;
    index < MIRROR_CONDUCTOR_MOVEMENT_WAYPOINTS.length;
    index += 1
  ) {
    assert.deepEqual(
      getMirrorConductorPosition(index * 2),
      MIRROR_CONDUCTOR_MOVEMENT_WAYPOINTS[index]
    );
  }
});

test("every adjacent platform route is dash-free with at least five pixels margin", () => {
  const movement = {
    maxRunSpeed: 190,
    gravity: 1600,
    jumpSpeed: 455,
    doubleJumpSpeed: 420
  };
  const expectedHorizontalMargins = [
    18.237,
    42.692,
    11.186,
    102.858,
    13.343,
    42.692,
    15.325,
    64.835,
    8.087,
    56.692,
    15.325,
    90.095
  ];
  const singleJumpRise =
    movement.jumpSpeed ** 2 /
    (2 * movement.gravity);
  const doubleJumpRise =
    movement.doubleJumpSpeed ** 2 /
    (2 * movement.gravity);

  for (
    let index = 0;
    index < MIRROR_CONDUCTOR_PLATFORMS.length - 1;
    index += 1
  ) {
    const from = MIRROR_CONDUCTOR_PLATFORMS[index];
    const to = MIRROR_CONDUCTOR_PLATFORMS[index + 1];
    const gap = to.x - (from.x + from.width);
    const verticalChange = to.y - from.y;
    let airtime;

    if (verticalChange >= 0) {
      airtime =
        (movement.jumpSpeed +
          Math.sqrt(
            movement.jumpSpeed ** 2 +
            2 * movement.gravity * verticalChange
          )) /
        movement.gravity;
    } else {
      const ascent = -verticalChange;
      const verticalMargin =
        singleJumpRise + doubleJumpRise - ascent;
      assert.ok(
        verticalMargin >= 5,
        `route ${index} vertical margin ${verticalMargin.toFixed(3)}px`
      );
      airtime =
        movement.jumpSpeed / movement.gravity +
        (movement.doubleJumpSpeed +
          Math.sqrt(
            movement.doubleJumpSpeed ** 2 -
            2 * movement.gravity *
              (ascent - singleJumpRise)
          )) /
          movement.gravity;
    }

    const horizontalMargin =
      movement.maxRunSpeed * airtime - gap;
    assert.ok(
      Math.abs(
        horizontalMargin -
        expectedHorizontalMargins[index]
      ) < 0.001,
      `route ${index} margin changed to ${horizontalMargin.toFixed(3)}px`
    );
    assert.ok(
      horizontalMargin >= 5,
      `route ${index} horizontal margin ${horizontalMargin.toFixed(3)}px`
    );
  }
});

test("shield requires movement and re-arms deterministically without paused time", () => {
  const cycle = new MirrorConductorShieldCycle();
  cycle.reset(100);

  assert.equal(cycle.canBreak(100), false);
  assert.equal(cycle.canBreak(227.999), false);
  assert.equal(cycle.canBreak(228), true);

  cycle.noteShieldBroken();
  assert.equal(
    cycle.rearmSecondsRemaining,
    MIRROR_CONDUCTOR_SHIELD_REARM_SECONDS
  );
  assert.equal(cycle.update(6, 300), false);
  assert.equal(cycle.update(60, 300, false), false);
  assert.equal(cycle.rearmSecondsRemaining, 6);
  assert.equal(cycle.update(5.999, 300), false);
  assert.equal(cycle.update(0.001, 300), true);
  assert.equal(cycle.displacementAnchorX, 300);
  assert.equal(cycle.canBreak(300), false);
  assert.equal(cycle.canBreak(428), true);
});

test("arena walls close on checkpoint restore and open before and after the fight", async () => {
  const source = await readFile(
    new URL(
      "../src/world/MirrorConductorSystem.ts",
      import.meta.url
    ),
    "utf8"
  );
  const mainSource = await readFile(
    new URL("../src/main.ts", import.meta.url),
    "utf8"
  );

  assert.equal(MIRROR_CONDUCTOR_ARENA_WALLS.length, 2);
  assert.match(
    source,
    /this\.setArenaWallsActive\(false\);[\s\S]*this\.beginFreshRun\(\);/
  );
  assert.match(
    source,
    /if \(checkpoint\) \{[\s\S]*restorePhaseCheckpoint\([\s\S]*this\.setArenaWallsActive\(true\);/
  );
  assert.match(
    source,
    /private startBoss\(\): void \{[\s\S]*this\.setArenaWallsActive\(true\);/
  );
  assert.match(
    source,
    /private completeBoss\(\): void \{[\s\S]*this\.setArenaWallsActive\(false\);/
  );
  assert.match(
    source,
    /private clearFinaleRunState\(\): void \{\s*this\.setArenaWallsActive\(false\);/
  );
  assert.match(
    mainSource,
    /candidate\.x === solid\.x[\s\S]*candidate\.height === solid\.height/
  );

  for (const phase of [2, 3]) {
    const checkpoint =
      new MirrorConductorCheckpointState();
    checkpoint.capture(phase, 3, 3, {});
    assert.ok(
      checkpoint.restore(),
      `phase-${phase} death restores walls with its checkpoint`
    );
  }

  assert.ok(
    MIRROR_CONDUCTOR_ARENA_WALLS[0].x > 45120,
    "left wall is inactive before start, leaving the entry floor traversable"
  );
  assert.ok(
    MIRROR_CONDUCTOR_ARENA_WALLS[1].x < 49824,
    "right wall removal after completeBoss leaves the world end reachable"
  );
});
