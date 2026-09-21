import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PickupRespawnState
} from "../src/magic/GrandCardState.ts";
import {
  MIRROR_CONDUCTOR_ANCHORS,
  MIRROR_CONDUCTOR_ARENA_BOUNDS,
  MIRROR_CONDUCTOR_ARENA_WALLS,
  MIRROR_CONDUCTOR_BEAM_ACTIVE_SECONDS,
  MIRROR_CONDUCTOR_BEAM_ACTIVE_START,
  MIRROR_CONDUCTOR_BEAM_REACH,
  MIRROR_CONDUCTOR_BEAM_TELEGRAPH_SECONDS,
  MIRROR_CONDUCTOR_BEAM_TELEGRAPH_START,
  MIRROR_CONDUCTOR_CHECKPOINT_GRAND_CARD_CHARGES,
  MIRROR_CONDUCTOR_CHECKPOINT_PLAYER_HEALTH,
  MIRROR_CONDUCTOR_FLOOR_CYCLE_SECONDS,
  MIRROR_CONDUCTOR_FLOOR_DAMAGE_SECONDS,
  MIRROR_CONDUCTOR_FLOOR_SAFE_SECONDS,
  MIRROR_CONDUCTOR_FLOOR_TELEGRAPH_SECONDS,
  MIRROR_CONDUCTOR_HOLD_SECONDS,
  MIRROR_CONDUCTOR_INITIAL_HEALTH,
  MIRROR_CONDUCTOR_MOVEMENT_CYCLE_SECONDS,
  MIRROR_CONDUCTOR_PHASE_THREE_PROJECTILE_CAP,
  MIRROR_CONDUCTOR_PHASE_THREE_PROJECTILES,
  MIRROR_CONDUCTOR_PHASE_THREE_SHIELD_REARM_SECONDS,
  MIRROR_CONDUCTOR_PLATFORMS,
  MIRROR_CONDUCTOR_SHIELD_REARM_SECONDS,
  MIRROR_CONDUCTOR_TELEGRAPH_SECONDS,
  MIRROR_CONDUCTOR_TRAVEL_SECONDS,
  MirrorConductorCheckpointState,
  MirrorConductorFloorHazardState,
  MirrorConductorMovementCycle,
  MirrorConductorShieldCycle,
  applyMirrorConductorDamage,
  getMirrorConductorBeamState,
  getMirrorConductorPhase,
  getMirrorConductorProjectileProfile,
  getMirrorConductorShieldRearmSeconds,
  shouldShowMirrorConductorThresholdCue
} from "../src/world/MirrorConductorPhase.ts";
import {
  WORLD_SOLIDS
} from "../src/world/WorldLayout.ts";

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

test("phase checkpoint restores full resources and restarts the phase window", () => {
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
    playerHealth:
      MIRROR_CONDUCTOR_CHECKPOINT_PLAYER_HEALTH,
    grandCardCharges:
      MIRROR_CONDUCTOR_CHECKPOINT_GRAND_CARD_CHARGES,
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

  const phaseTwo =
    new MirrorConductorCheckpointState().capture(
      2,
      1,
      0,
      { ConductorCardLeft: 6 }
    );
  assert.equal(
    phaseTwo.playerHealth,
    MIRROR_CONDUCTOR_CHECKPOINT_PLAYER_HEALTH
  );
  assert.equal(
    phaseTwo.grandCardCharges,
    MIRROR_CONDUCTOR_CHECKPOINT_GRAND_CARD_CHARGES
  );
  assert.equal(phaseTwo.bossHealth, 72);
  assert.equal(
    phaseTwo.dropTimerRemainders.ConductorCardLeft,
    6,
    "resource refill must not rewind pickup timers"
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

test("anchored movement cycle is deterministic, pause-preserving, stationary on holds, and bounded", () => {
  const singleStep =
    new MirrorConductorMovementCycle();
  const splitSteps =
    new MirrorConductorMovementCycle();
  const expectedElapsed = 26.75;

  const singlePosition =
    singleStep.update(expectedElapsed);
  let splitPosition = splitSteps.update(0);

  for (const delta of [
    3,
    1,
    6.677,
    3,
    1,
    6.83,
    3,
    1,
    1.243
  ]) {
    splitPosition = splitSteps.update(delta);
  }

  assert.ok(
    Math.abs(
      splitSteps.elapsedSeconds - expectedElapsed
    ) < 1e-9
  );
  assert.equal(splitPosition.state, singlePosition.state);
  assert.equal(
    splitPosition.anchorIndex,
    singlePosition.anchorIndex
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
  assert.ok(
    Math.abs(
      splitSteps.elapsedSeconds - expectedElapsed
    ) < 1e-9
  );

  const cycle = new MirrorConductorMovementCycle();

  for (
    let index = 0;
    index < MIRROR_CONDUCTOR_ANCHORS.length;
    index += 1
  ) {
    const anchor = MIRROR_CONDUCTOR_ANCHORS[index];
    const holdStart = cycle.current;
    assert.equal(holdStart.state, "hold");
    assert.equal(holdStart.anchorIndex, index);
    assert.equal(holdStart.x, anchor.x);
    assert.equal(holdStart.y, anchor.y);

    const held = cycle.update(
      MIRROR_CONDUCTOR_HOLD_SECONDS - 1e-6
    );
    assert.equal(held.state, "hold");
    assert.equal(held.x, anchor.x);
    assert.equal(held.y, anchor.y);

    const telegraph = cycle.update(1e-6);
    assert.equal(telegraph.state, "telegraph");
    assert.equal(telegraph.x, anchor.x);
    assert.equal(telegraph.y, anchor.y);

    const travel = cycle.update(
      MIRROR_CONDUCTOR_TELEGRAPH_SECONDS
    );
    assert.equal(travel.state, "travel");
    cycle.update(
      MIRROR_CONDUCTOR_TRAVEL_SECONDS[index]
    );
  }

  const expectedPeakSpeeds = [
    262.393,
    263.543,
    308.773,
    257.592
  ];

  for (
    let index = 0;
    index < MIRROR_CONDUCTOR_ANCHORS.length;
    index += 1
  ) {
    const start = MIRROR_CONDUCTOR_ANCHORS[index];
    const end =
      MIRROR_CONDUCTOR_ANCHORS[
        (index + 1) % MIRROR_CONDUCTOR_ANCHORS.length
      ];
    const distance = Math.hypot(
      end.x - start.x,
      end.y - start.y
    );
    const peakSpeed =
      1.5 * distance /
      MIRROR_CONDUCTOR_TRAVEL_SECONDS[index];
    assert.ok(
      Math.abs(peakSpeed - expectedPeakSpeeds[index]) < 0.001,
      `leg ${index} peak changed to ${peakSpeed.toFixed(3)}px/s`
    );
    assert.ok(
      MIRROR_CONDUCTOR_TELEGRAPH_SECONDS +
        MIRROR_CONDUCTOR_TRAVEL_SECONDS[index] >= 2.5,
      `leg ${index} must regenerate 30 SHOW from zero`
    );
  }

  assert.ok(
    Math.abs(
      MIRROR_CONDUCTOR_MOVEMENT_CYCLE_SECONDS -
      43.11231578947368
    ) < 1e-9
  );

  const sampler = new MirrorConductorMovementCycle();
  const sampleStep = 1 / 240;

  for (
    let elapsed = 0;
    elapsed <
      MIRROR_CONDUCTOR_MOVEMENT_CYCLE_SECONDS * 2;
    elapsed += sampleStep
  ) {
    const position = sampler.update(sampleStep);
    assert.ok(
      position.x >= MIRROR_CONDUCTOR_ARENA_BOUNDS.left &&
      position.x + 42 <= MIRROR_CONDUCTOR_ARENA_BOUNDS.right,
      `boss body escaped at ${elapsed.toFixed(3)}`
    );
  }
});

test("beam timing is hold-scoped, deterministic, bounded, and pause-preserving", () => {
  assert.ok(
    Math.abs(
      MIRROR_CONDUCTOR_BEAM_TELEGRAPH_START - 2.05
    ) < 1e-12
  );
  assert.ok(
    Math.abs(
      MIRROR_CONDUCTOR_BEAM_ACTIVE_START - 2.7
    ) < 1e-12
  );
  assert.equal(
    MIRROR_CONDUCTOR_BEAM_TELEGRAPH_SECONDS,
    0.65
  );
  assert.equal(
    MIRROR_CONDUCTOR_BEAM_ACTIVE_SECONDS,
    0.3
  );
  assert.equal(MIRROR_CONDUCTOR_BEAM_REACH, 480);

  const preservedCoordinates = [
    { id: "card-left", x: 45920, y: 520, anchors: ["A"] },
    { id: "card-right", x: 48544, y: 520, anchors: ["C", "D"] },
    { id: "heart-left", x: 46176, y: 352, anchors: ["A"] },
    { id: "heart-right", x: 47968, y: 416, anchors: ["D"] },
    { id: "phase-2-spawn", x: 45584, y: 370, anchors: [] },
    { id: "phase-3-spawn", x: 49104, y: 370, anchors: [] }
  ];

  for (const anchor of MIRROR_CONDUCTOR_ANCHORS) {
    const originX = anchor.x + 21;
    assert.ok(
      originX - MIRROR_CONDUCTOR_BEAM_REACH >=
        MIRROR_CONDUCTOR_ARENA_BOUNDS.left
    );
    assert.ok(
      originX + MIRROR_CONDUCTOR_BEAM_REACH <=
        MIRROR_CONDUCTOR_ARENA_BOUNDS.right
    );
    assert.ok(anchor.y > 96);
  }

  for (const coordinate of preservedCoordinates) {
    const containingAnchors =
      MIRROR_CONDUCTOR_ANCHORS
        .filter(anchor =>
          Math.hypot(
            coordinate.x - (anchor.x + 21),
            coordinate.y - (anchor.y + 32)
          ) <= MIRROR_CONDUCTOR_BEAM_REACH
        )
        .map(anchor => anchor.id);
    assert.deepEqual(
      containingAnchors,
      coordinate.anchors,
      `${coordinate.id} beam footprint changed`
    );
  }

  assert.equal(
    getMirrorConductorBeamState("hold", 0),
    "off"
  );
  assert.equal(
    getMirrorConductorBeamState(
      "hold",
      MIRROR_CONDUCTOR_BEAM_TELEGRAPH_START - 1e-6
    ),
    "off"
  );
  assert.equal(
    getMirrorConductorBeamState(
      "hold",
      MIRROR_CONDUCTOR_BEAM_TELEGRAPH_START
    ),
    "telegraph"
  );
  assert.equal(
    getMirrorConductorBeamState(
      "hold",
      MIRROR_CONDUCTOR_BEAM_ACTIVE_START - 1e-6
    ),
    "telegraph"
  );
  assert.equal(
    getMirrorConductorBeamState(
      "hold",
      MIRROR_CONDUCTOR_BEAM_ACTIVE_START
    ),
    "active"
  );
  assert.equal(
    getMirrorConductorBeamState("telegraph", 2.7),
    "off"
  );
  assert.equal(
    getMirrorConductorBeamState("travel", 2.7),
    "off"
  );

  const cycle = new MirrorConductorMovementCycle();
  cycle.update(
    MIRROR_CONDUCTOR_BEAM_TELEGRAPH_START - 0.001
  );
  const beforePause = cycle.current;
  assert.deepEqual(cycle.update(10, false), beforePause);
  assert.equal(
    cycle.update(0.001).beamTelegraphStarted,
    true
  );
});

test("every anchor has clear jump geometry and the corrected air-up overlap window", () => {
  const launches = [
    { surfaceY: 352, platform: [46048, 352, 256, 16] },
    { surfaceY: 352, platform: [47200, 352, 288, 16] },
    { surfaceY: 352, platform: [48416, 352, 256, 16] },
    { surfaceY: 520, platform: [45120, 520, 4224, 32] }
  ];
  const maximumRise =
    455 ** 2 / (2 * 1600) +
    420 ** 2 / (2 * 1600);
  const expectedOverlap = 39.8203125;
  const expectedDwell = 0.4462079812150383;

  for (
    let index = 0;
    index < MIRROR_CONDUCTOR_ANCHORS.length;
    index += 1
  ) {
    const anchor = MIRROR_CONDUCTOR_ANCHORS[index];
    const launch = launches[index];
    const playerCenterX = anchor.x + 12;
    const hitbox = {
      x: playerCenterX - 8,
      y: launch.surfaceY - maximumRise - 70,
      width: 34,
      height: 40
    };
    const boss = {
      x: anchor.x,
      y: anchor.y,
      width: 42,
      height: 64
    };
    const overlapX = Math.min(
      hitbox.x + hitbox.width,
      boss.x + boss.width
    ) - Math.max(hitbox.x, boss.x);
    const overlapY = Math.min(
      hitbox.y + hitbox.height,
      boss.y + boss.height
    ) - Math.max(hitbox.y, boss.y);

    assert.equal(overlapX, 34);
    assert.ok(
      Math.abs(overlapY - expectedOverlap) < 1e-9,
      `anchor ${anchor.id} overlap ${overlapY}`
    );

    const corridorTop =
      launch.surfaceY - 189.8203125;
    const bodyLeft = playerCenterX - 9;
    const bodyRight = playerCenterX + 9;
    const blockers = WORLD_SOLIDS.filter(
      solid =>
        solid.x < bodyRight &&
        solid.x + solid.width > bodyLeft &&
        solid.y < launch.surfaceY &&
        solid.y + solid.height > corridorTop
    );
    assert.deepEqual(
      blockers,
      [],
      `anchor ${anchor.id} jump arc must be clear`
    );
    assert.deepEqual(
      launch.platform,
      index === 3
        ? [45120, 520, 4224, 32]
        : [
            MIRROR_CONDUCTOR_PLATFORMS[
              index === 0 ? 2 : index === 1 ? 6 : 10
            ].x,
            launch.surfaceY,
            MIRROR_CONDUCTOR_PLATFORMS[
              index === 0 ? 2 : index === 1 ? 6 : 10
            ].width,
            16
          ]
    );
  }

  const firstJumpRise = 455 ** 2 / (2 * 1600);
  const dwellDiscriminant =
    420 ** 2 -
    2 * 1600 * (80 - firstJumpRise);
  const dwellSeconds =
    Math.sqrt(dwellDiscriminant) / 800;
  assert.ok(
    Math.abs(dwellSeconds - expectedDwell) < 1e-12
  );
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

  cycle.noteShieldBroken();
  assert.equal(
    cycle.update(12, 500, true, true),
    false,
    "an expired timer cannot re-arm during a vulnerable HOLD"
  );
  assert.equal(cycle.rearmSecondsRemaining, 0);
  assert.equal(
    cycle.update(0.5, 500, true, true),
    false,
    "a hit after the break remains unshielded for the full HOLD"
  );
  assert.equal(
    cycle.update(0.001, 500, true, false),
    true,
    "deferred re-arm applies after HOLD ends"
  );
  assert.equal(cycle.displacementAnchorX, 500);
});

test("phase-three shield re-arm starts at its break and never leaks into earlier phases", () => {
  assert.equal(
    getMirrorConductorShieldRearmSeconds(1),
    MIRROR_CONDUCTOR_SHIELD_REARM_SECONDS
  );
  assert.equal(
    getMirrorConductorShieldRearmSeconds(2),
    MIRROR_CONDUCTOR_SHIELD_REARM_SECONDS
  );
  assert.equal(
    getMirrorConductorShieldRearmSeconds(3),
    MIRROR_CONDUCTOR_PHASE_THREE_SHIELD_REARM_SECONDS
  );

  const cycle = new MirrorConductorShieldCycle();
  cycle.reset(100);
  cycle.noteShieldBroken(
    getMirrorConductorShieldRearmSeconds(3)
  );
  assert.equal(cycle.update(17.999, 300), false);
  assert.ok(
    cycle.rearmSecondsRemaining >= 0.001 - 1e-9
  );
  assert.equal(
    cycle.update(0.001, 300, true, true),
    false,
    "HOLD deferral cannot shorten the eighteen-second window"
  );
  assert.ok(
    cycle.rearmSecondsRemaining !== null &&
    cycle.rearmSecondsRemaining <= 1e-9
  );
  assert.equal(
    cycle.update(0.001, 300, true, false),
    true
  );

  cycle.reset(500);
  assert.equal(
    cycle.rearmSecondsRemaining,
    null,
    "fresh runs cannot inherit phase-three shield timing"
  );
});

test("phase-three floor timing covers pickups, pauses safely, warns after suppression, and damages once", () => {
  const leftRoundTrip =
    Math.sqrt(2 * 56 / 1600) +
    96 / 190 +
    (455 - Math.sqrt(455 ** 2 - 2 * 1600 * 56)) /
      1600;
  const firstJumpRise = 455 ** 2 / (2 * 1600);
  const rightJumpTime =
    455 / 1600 +
    (420 -
      Math.sqrt(
        420 ** 2 -
        2 * 1600 * (72 - firstJumpRise)
      )) /
      1600;
  const rightRoundTrip =
    Math.sqrt(2 * 72 / 1600) +
    416 / 190 +
    rightJumpTime;

  assert.ok(Math.abs(leftRoundTrip - 0.9499581182661192) < 1e-12);
  assert.ok(Math.abs(rightRoundTrip - 2.791858621784668) < 1e-12);
  assert.ok(
    MIRROR_CONDUCTOR_FLOOR_SAFE_SECONDS >=
      rightRoundTrip + 1
  );
  assert.equal(
    MIRROR_CONDUCTOR_FLOOR_TELEGRAPH_SECONDS,
    0.65
  );
  assert.ok(
    Math.abs(
      MIRROR_CONDUCTOR_FLOOR_DAMAGE_SECONDS /
      MIRROR_CONDUCTOR_FLOOR_SAFE_SECONDS -
      1.35 / 1.85
    ) < 1e-12
  );
  assert.ok(
    Math.abs(
      MIRROR_CONDUCTOR_FLOOR_CYCLE_SECONDS -
      7.20889058903294
    ) < 1e-12
  );

  const single = new MirrorConductorFloorHazardState();
  const split = new MirrorConductorFloorHazardState();
  const singleSnapshot = single.update(5.25, false);
  let splitSnapshot = split.current;

  for (const delta of [1, 0.25, 2, 2]) {
    splitSnapshot = split.update(delta, false);
  }

  assert.deepEqual(splitSnapshot, singleSnapshot);
  const beforePause = split.current;
  assert.deepEqual(
    split.update(30, false, false),
    beforePause
  );

  const right = new MirrorConductorFloorHazardState();
  right.update(
    MIRROR_CONDUCTOR_FLOOR_CYCLE_SECONDS,
    false
  );
  right.update(
    MIRROR_CONDUCTOR_FLOOR_SAFE_SECONDS +
      MIRROR_CONDUCTOR_FLOOR_TELEGRAPH_SECONDS,
    false
  );
  assert.equal(right.current.side, "right");
  assert.equal(right.current.phase, "damage");
  assert.equal(right.current.damagingSide, "right");

  const fullHold = new MirrorConductorFloorHazardState();
  fullHold.update(
    MIRROR_CONDUCTOR_FLOOR_CYCLE_SECONDS,
    false
  );
  fullHold.update(
    MIRROR_CONDUCTOR_FLOOR_SAFE_SECONDS +
      MIRROR_CONDUCTOR_FLOOR_TELEGRAPH_SECONDS,
    false
  );
  const suppressed = fullHold.update(
    MIRROR_CONDUCTOR_HOLD_SECONDS,
    true
  );
  assert.notEqual(
    suppressed.damagingSide,
    "right",
    "anchor-D floor must stay safe for the full HOLD"
  );

  right.update(0.5, true);
  const resumed = right.update(0, false);
  assert.equal(resumed.side, "right");
  assert.equal(resumed.phase, "safe");
  assert.equal(resumed.phaseElapsed, 0);
  assert.equal(resumed.damagingSide, null);

  right.update(
    MIRROR_CONDUCTOR_FLOOR_SAFE_SECONDS,
    false
  );
  assert.equal(right.current.phase, "telegraph");
  assert.equal(right.current.telegraphStarted, false);
  right.update(
    MIRROR_CONDUCTOR_FLOOR_TELEGRAPH_SECONDS - 1e-6,
    false
  );
  assert.equal(right.current.phase, "telegraph");
  right.update(1e-6, false);
  assert.equal(right.current.phase, "damage");
  assert.equal(right.canDamage("right"), true);
  right.markDamageApplied();
  assert.equal(
    right.canDamage("right"),
    false,
    "one floor window can remove at most one heart"
  );
});

test("phase-three projectile profile limits every sampled in-flight count", () => {
  assert.deepEqual(
    getMirrorConductorProjectileProfile(1),
    {
      volleySize: 1,
      intervalSeconds: 1.15,
      staggerSeconds: 0,
      speed: 230,
      lifetimeSeconds: 4
    }
  );
  assert.deepEqual(
    getMirrorConductorProjectileProfile(2),
    {
      volleySize: 2,
      intervalSeconds: 0.9,
      staggerSeconds: 0,
      speed: 230,
      lifetimeSeconds: 4
    }
  );
  assert.deepEqual(
    getMirrorConductorProjectileProfile(3),
    MIRROR_CONDUCTOR_PHASE_THREE_PROJECTILES
  );

  const profile =
    MIRROR_CONDUCTOR_PHASE_THREE_PROJECTILES;
  assert.equal(
    profile.speed * profile.lifetimeSeconds,
    460
  );
  assert.equal(
    profile.speed * profile.staggerSeconds,
    57.5
  );
  assert.ok(
    190 * profile.staggerSeconds > 18
  );
  assert.ok(
    profile.volleySize /
      profile.intervalSeconds *
      profile.lifetimeSeconds <= 5
  );

  const shotTimes = [];
  for (
    let volley = 0;
    volley < 30;
    volley += profile.intervalSeconds
  ) {
    for (
      let shot = 0;
      shot < profile.volleySize;
      shot += 1
    ) {
      shotTimes.push(
        volley + shot * profile.staggerSeconds
      );
    }
  }
  shotTimes.sort((left, right) => left - right);

  const expirations = [];
  let shotIndex = 0;
  let maximumInFlight = 0;

  for (let time = 0; time <= 30; time += 1 / 240) {
    for (
      let index = expirations.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (expirations[index] <= time + 1e-9) {
        expirations.splice(index, 1);
      }
    }

    while (
      shotIndex < shotTimes.length &&
      shotTimes[shotIndex] <= time + 1e-9
    ) {
      if (
        expirations.length <
        MIRROR_CONDUCTOR_PHASE_THREE_PROJECTILE_CAP
      ) {
        expirations.push(
          shotTimes[shotIndex] +
          profile.lifetimeSeconds
        );
      }
      shotIndex += 1;
    }

    maximumInFlight = Math.max(
      maximumInFlight,
      expirations.length
    );
  }

  assert.ok(
    maximumInFlight <=
      MIRROR_CONDUCTOR_PHASE_THREE_PROJECTILE_CAP
  );
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
