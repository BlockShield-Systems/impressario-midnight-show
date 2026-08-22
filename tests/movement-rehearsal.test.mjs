import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { KinematicCollisionWorld } from "../src/player/KinematicCollisionWorld.ts";
import { MOVEMENT } from "../src/player/MovementConfig.ts";
import { MovementInputEdges } from "../src/player/MovementInputEdges.ts";
import { PlayerController } from "../src/player/PlayerController.ts";
import { PlayerRespawnState } from "../src/player/PlayerRespawnState.ts";
import { FIXED_TIMESTEP_SECONDS } from "../src/runtime/FixedStepTiming.ts";
import {
  hasClearedDroppedPlatform,
  shouldLandOnOneWayPlatform,
  shouldStartOneWayDrop
} from "../src/player/OneWayPlatformPolicy.ts";
import {
  MOVEMENT_DECORATIVE_COLUMNS,
  MOVEMENT_TUTORIAL_SIGNS,
  rectanglesOverlap,
  tutorialMarkerBounds,
  tutorialSignBounds
} from "../src/world/MovementTutorial.ts";
import {
  WORLD_ONE_WAY_PLATFORMS,
  WORLD_SECTIONS,
  WORLD_SOLIDS,
  WORLD_WALL_JUMP_SURFACES
} from "../src/world/WorldLayout.ts";
import {
  WORLD_CHECKPOINTS,
  WORLD_GATES,
  getWorldCheckpoint
} from "../src/world/WorldGameplay.ts";
import { isBelowMovementRoute } from "../src/world/MovementRouteBounds.ts";
import { getWorldSection } from "../src/world/SectionOwnership.ts";

const root = new URL("../", import.meta.url);
const body = (x, y) => ({
  x,
  y,
  width: MOVEMENT.bodyWidth,
  height: MOVEMENT.bodyHeight
});
const rect = (x, y, width, height) => ({ x, y, width, height });

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function maximumDoubleJumpRise() {
  const step = 1 / 120;
  let best = 0;

  for (let secondJump = 1; secondJump < 120; secondJump += 1) {
    let y = 0;
    let velocityY = -MOVEMENT.jumpSpeed;
    let minimumY = 0;

    for (let stepIndex = 0; stepIndex < 240; stepIndex += 1) {
      if (stepIndex === secondJump) {
        velocityY = -MOVEMENT.doubleJumpSpeed;
      }
      velocityY += MOVEMENT.gravity * step;
      y += velocityY * step;
      minimumY = Math.min(minimumY, y);
      if (stepIndex > secondJump && velocityY >= 0) break;
    }

    best = Math.max(best, -minimumY);
  }

  return best;
}

function maximumNoDashRange() {
  const step = 1 / 120;
  let best = 0;

  for (let firstJump = 0; firstJump <= 13; firstJump += 1) {
    for (let secondJump = firstJump + 1; secondJump < 180; secondJump += 1) {
      let y = 0;
      let velocityY = 0;
      let elapsed = 0;

      for (let index = 0; index < 360; index += 1) {
        if (index === firstJump) velocityY = -MOVEMENT.jumpSpeed;
        if (index === secondJump) velocityY = -MOVEMENT.doubleJumpSpeed;
        velocityY = Math.min(
          velocityY + MOVEMENT.gravity * step,
          MOVEMENT.maxFallSpeed
        );
        y += velocityY * step;
        elapsed += step;
        if (index > 0 && y >= 0) {
          best = Math.max(best, MOVEMENT.maxRunSpeed * elapsed);
          break;
        }
      }
    }
  }

  return best;
}

test("one-way collision passes upward and provides stable descending support", () => {
  const platform = rect(100, 100, 100, 14);
  const world = new KinematicCollisionWorld([], [platform]);
  const rising = body(120, 112);
  const risingContacts = world.move(rising, 0, -30);

  assert.equal(rising.y, 82);
  assert.equal(risingContacts.ceiling, false);
  assert.equal(risingContacts.grounded, false);

  const falling = body(120, 60);
  const landing = world.move(falling, 0, 20);
  assert.equal(falling.y, 70);
  assert.equal(landing.grounded, true);
  assert.equal(landing.groundedOneWay, platform);

  const stable = world.move(falling, 0, 1);
  assert.equal(falling.y, 70);
  assert.equal(stable.groundedOneWay, platform);
});

test("drop-through ignores exactly one platform and restores collision after clear", () => {
  const upper = rect(100, 100, 100, 14);
  const lower = rect(100, 150, 100, 14);
  const world = new KinematicCollisionWorld([], [upper, lower]);
  const dropping = body(120, 105);
  const caught = world.move(dropping, 0, 25, upper);

  assert.equal(caught.groundedOneWay, lower);
  assert.equal(dropping.y, 120);
  assert.equal(hasClearedDroppedPlatform(dropping, upper), true);

  const beside = body(201, 70);
  assert.equal(hasClearedDroppedPlatform(beside, upper), true);
  const notClear = body(120, 100);
  assert.equal(hasClearedDroppedPlatform(notClear, upper), false);

  assert.equal(shouldStartOneWayDrop(true, true, upper), true);
  assert.equal(shouldStartOneWayDrop(false, true, upper), false);
  assert.equal(shouldStartOneWayDrop(true, false, upper), false);
  assert.equal(shouldStartOneWayDrop(true, true, null), false);
});

test("ordinary floors, walls, wall-jump surfaces, and gates remain fully solid", () => {
  const floor = rect(0, 100, 100, 20);
  const wall = rect(100, 0, 20, 120);
  const gate = rect(160, 0, 18, 120);
  const world = new KinematicCollisionWorld([floor, wall], []);

  const falling = body(20, 60);
  assert.equal(world.move(falling, 0, 30).grounded, true);
  assert.equal(falling.y, 70);

  const running = body(70, 50);
  assert.equal(world.move(running, 30, 0).wallRight, true);
  assert.equal(running.x, 82);

  world.addSolid(gate);
  const gateRunner = body(130, 50);
  assert.equal(world.move(gateRunner, 30, 0).wallRight, true);
  assert.equal(gateRunner.x, 142);
  world.removeSolid(gate);
  assert.equal(world.move(gateRunner, 5, 0).wallRight, false);
});

test("movement input edges are consumed once for keyboard and gamepad producers", () => {
  const edges = new MovementInputEdges();
  edges.queueJump();
  edges.queueDash();
  assert.deepEqual(edges.snapshot(false), {
    jumpPressed: false,
    dashPressed: false
  });
  assert.deepEqual(edges.snapshot(true), {
    jumpPressed: true,
    dashPressed: true
  });
  assert.deepEqual(edges.snapshot(true), {
    jumpPressed: false,
    dashPressed: false
  });
  edges.queueJump();
  edges.queueJump();
  assert.equal(edges.snapshot(true).jumpPressed, true);
  assert.equal(edges.snapshot(true).jumpPressed, false);
});

test("drop edge suppresses jump and dash, attack remains independently keyed, and respawn clears state", async () => {
  const controller = await source("src/player/PlayerController.ts");
  const combat = await source("src/combat/CombatSystem.ts");
  const health = await source("src/player/PlayerHealthSystem.ts");
  const respawn = await source("src/player/PlayerRespawnState.ts");

  assert.match(controller, /if \(droppingThrough\)[\s\S]*?jumpBufferTimer = 0/);
  assert.match(controller, /input\.dashPressed &&\s*!droppingThrough/);
  assert.match(controller, /resetTransientState\(\)[\s\S]*?droppedOneWay = null/);
  assert.match(health, /beginRespawn\(\)[\s\S]*?respawnState\.beginRespawn\(\)/);
  assert.match(respawn, /beginRespawn\(\)[\s\S]*?player\.resetTransientState\(\)/);
  assert.match(combat, /event\.code === "KeyJ"/);
  assert.doesNotMatch(combat, /event\.code === "Space"/);
});

test("semantic metadata keeps decoration, one-way rails, walls, and combat gates distinct", () => {
  assert.equal(WORLD_ONE_WAY_PLATFORMS.length, 7);
  assert.equal(WORLD_WALL_JUMP_SURFACES.length, 8);
  assert.ok(MOVEMENT_DECORATIVE_COLUMNS.every(column => column.collision === "none"));

  for (const column of MOVEMENT_DECORATIVE_COLUMNS) {
    assert.equal(
      [...WORLD_SOLIDS, ...WORLD_ONE_WAY_PLATFORMS, ...WORLD_WALL_JUMP_SURFACES]
        .some(collider => collider.x === column.x && collider.y === column.y &&
          collider.width === column.width && collider.height === column.height),
      false
    );
  }

  const movementEnd = WORLD_SECTIONS.find(section => section.id === "MovementRehearsal").endX;
  assert.equal(WORLD_GATES.some(gate => gate.x < movementEnd), false);
  assert.deepEqual(WORLD_GATES[0], {
    id: "CombatTutorialExit",
    x: 6672,
    y: 0,
    width: 18,
    height: 640
  });
});

test("tutorial order, mechanics, signs, and directional markers match clear routes", () => {
  assert.deepEqual(MOVEMENT_TUTORIAL_SIGNS.map(sign => sign.id), [
    "jump", "double-jump", "drop-through", "wall-jump", "dash", "finale"
  ]);

  for (const sign of MOVEMENT_TUTORIAL_SIGNS) {
    assert.ok(sign.requiredMechanics.length > 0);
    assert.equal(rectanglesOverlap(tutorialSignBounds(sign), sign.route), false);
    assert.equal(rectanglesOverlap(tutorialMarkerBounds(sign), sign.route), false);
  }

  assert.equal(MOVEMENT_TUTORIAL_SIGNS.find(sign => sign.id === "jump").direction, "up");
  assert.equal(MOVEMENT_TUTORIAL_SIGNS.find(sign => sign.id === "double-jump").direction, "up");
  assert.equal(MOVEMENT_TUTORIAL_SIGNS.find(sign => sign.id === "drop-through").direction, "down");
  assert.deepEqual(MOVEMENT_TUTORIAL_SIGNS.find(sign => sign.id === "finale").requiredMechanics,
    ["double-jump", "wall-jump", "dash"]);
});

test("authored rises and gaps truthfully require the named mechanics with margins", () => {
  const singleRise = MOVEMENT.jumpSpeed ** 2 / (2 * MOVEMENT.gravity);
  const doubleRise = maximumDoubleJumpRise();
  const noDash = maximumNoDashRange();
  const withDash = noDash +
    (MOVEMENT.dashSpeed - MOVEMENT.maxRunSpeed) * MOVEMENT.dashDuration;

  const jumpRise = 326 - 270;
  const doubleJumpRise = 310 - 238;
  const wallJumpRise = 370 - 230;
  const finaleDoubleRise = 326 - 246;
  const finaleWallRise = 246 - 112;
  const finaleDashGap = 4776 - (4448 + 112);

  assert.ok(jumpRise < singleRise);
  assert.ok(doubleJumpRise > singleRise && doubleJumpRise < doubleRise);
  assert.ok(wallJumpRise > doubleRise);
  assert.ok(finaleDoubleRise > singleRise && finaleDoubleRise < doubleRise);
  assert.ok(finaleWallRise > doubleRise);
  assert.ok(finaleDashGap > noDash && finaleDashGap < withDash);
  assert.ok(withDash - finaleDashGap >= 20);
});

test("MovementRehearsal transition and checkpoint ownership remain unchanged", () => {
  const movement = WORLD_SECTIONS.find(section => section.id === "MovementRehearsal");
  const combat = WORLD_SECTIONS.find(section => section.id === "CombatRehearsal");
  const combatEntry = WORLD_CHECKPOINTS.find(checkpoint => checkpoint.id === "CombatEntry");

  assert.equal(movement.startX, 0);
  assert.equal(movement.endX, 5376);
  assert.equal(combat.startX, 5376);
  assert.deepEqual(combatEntry, {
    id: "CombatEntry",
    displayName: "Combat Rehearsal",
    triggerX: 5408,
    x: 5456,
    y: 296
  });
});

const DASH_LANDING_X = 3200;
const DASH_SECOND_JUMP_TICK = 22;
const FINALE_SECOND_JUMP_TICK = 22;
const DEFAULT_FINALE_DASH_TICK = 70;

function createReplayPlayer() {
  const world = new KinematicCollisionWorld(
    [
      ...WORLD_SOLIDS,
      ...WORLD_WALL_JUMP_SURFACES
    ],
    WORLD_ONE_WAY_PLATFORMS
  );
  const spawn = getWorldCheckpoint("InitialSpawn");
  return new PlayerController(
    world,
    spawn.x,
    spawn.y
  );
}

function touchingWallJumpSurface(player, snapshot) {
  return WORLD_WALL_JUMP_SURFACES.find(surface => {
    const verticalOverlap =
      player.y < surface.y + surface.height &&
      player.y + player.height > surface.y;
    const touchesLeft = snapshot.wallLeft &&
      Math.abs(player.x - (surface.x + surface.width)) < 0.01;
    const touchesRight = snapshot.wallRight &&
      Math.abs(player.x + player.width - surface.x) < 0.01;
    return verticalOverlap && (touchesLeft || touchesRight);
  }) ?? null;
}

function replayMovementRoute({
  dashTick,
  finaleDashTick = DEFAULT_FINALE_DASH_TICK
}) {
  const player = createReplayPlayer();
  const respawn = new PlayerRespawnState(player);
  const edges = new MovementInputEdges();
  const records = [];
  const wallJumpSurfaces = new Set();
  let phase = "approach";
  let lastJumpTick = -100;
  let lastWallJumpTick = -100;
  let dashJumpTick = null;
  let finaleJumpTick = null;
  let dashLanded = false;
  let finaleLanded = false;
  let checkpoint = respawn.currentCheckpoint;

  for (let tick = 0; tick < 7200; tick += 1) {
    const before = player.getDebugSnapshot();
    let moveX = 1;
    let jumpHeld = true;
    let downHeld = false;
    let queueJump = false;

    if (phase === "approach" && player.x >= 2940) {
      phase = "dash-settle";
    }

    if (phase === "dash-settle") {
      moveX = 0;
      jumpHeld = false;
      if (before.grounded) {
        phase = "dash";
        dashJumpTick = tick;
        queueJump = true;
        moveX = 1;
      }
    } else if (phase === "dash") {
      if (tick === dashJumpTick + DASH_SECOND_JUMP_TICK) {
        queueJump = true;
      }
      if (dashTick !== null && tick === dashJumpTick + dashTick) {
        edges.queueDash();
      }
      if (before.grounded && player.x + player.width > DASH_LANDING_X) {
        dashLanded = true;
        phase = "post-dash";
      }
    } else if (phase === "finale-settle") {
      jumpHeld = false;
      if (before.grounded && player.y < 230) {
        phase = "finale";
        finaleJumpTick = tick;
        queueJump = true;
      }
    } else if (phase === "finale") {
      if (tick === finaleJumpTick + FINALE_SECOND_JUMP_TICK) {
        queueJump = true;
      }
      if (tick === finaleJumpTick + finaleDashTick) {
        edges.queueDash();
      }
      if (before.grounded && player.x > 4776) {
        finaleLanded = true;
        phase = "finish";
      }
    } else {
      if (before.grounded && tick - lastJumpTick > 8) {
        queueJump = true;
      } else if (
        (before.wallLeft || before.wallRight) &&
        !before.grounded &&
        tick - lastWallJumpTick > 8
      ) {
        queueJump = true;
        lastWallJumpTick = tick;
        const surface = touchingWallJumpSurface(player, before);
        if (surface) {
          wallJumpSurfaces.add(
            `${surface.x},${surface.y},${surface.width},${surface.height}`
          );
        }
      } else if (
        before.jumpsUsed === 1 &&
        player.velocityY > -70 &&
        tick - lastJumpTick > 20
      ) {
        queueJump = true;
      }
    }

    if (phase === "post-dash" && player.x >= 4400) {
      phase = "finale-settle";
    }

    if (queueJump) {
      edges.queueJump();
      lastJumpTick = tick;
    }

    const edgeInput = edges.snapshot(true);
    const input = {
      moveX,
      downHeld,
      jumpHeld,
      ...edgeInput
    };

    player.fixedUpdate(
      FIXED_TIMESTEP_SECONDS,
      input
    );

    if (
      checkpoint.id === "InitialSpawn" &&
      player.x >= getWorldCheckpoint("CombatEntry").triggerX
    ) {
      checkpoint = getWorldCheckpoint("CombatEntry");
      respawn.setCheckpoint(checkpoint);
    }

    const after = player.getDebugSnapshot();
    const section = getWorldSection(player.x);
    const dead = isBelowMovementRoute(
      player.centerX,
      player.y
    );

    records.push({
      tick,
      simulationTime: tick * FIXED_TIMESTEP_SECONDS,
      input,
      x: player.x,
      y: player.y,
      velocityX: player.velocityX,
      velocityY: player.velocityY,
      grounded: after.grounded,
      jumpsUsed: after.jumpsUsed,
      dashActive: after.dashActive,
      contacts: {
        ceiling: after.ceiling,
        wallLeft: after.wallLeft,
        wallRight: after.wallRight,
        groundedOneWay: after.groundedOneWay
      },
      checkpoint: checkpoint.id,
      dead,
      respawning: respawn.controlsLocked,
      section: section?.id ?? null,
      phase
    });

    assert.ok(Number.isFinite(player.x));
    assert.ok(Number.isFinite(player.y));
    assert.ok(Number.isFinite(player.velocityX));
    assert.ok(Number.isFinite(player.velocityY));

    if (dead) {
      return {
        completed: false,
        dashLanded,
        finaleLanded,
        player,
        records,
        wallJumpSurfaces: [...wallJumpSurfaces],
        checkpoint
      };
    }

    if (
      player.x > 5420 &&
      section?.id === "CombatRehearsal"
    ) {
      return {
        completed: true,
        dashLanded,
        finaleLanded,
        player,
        records,
        wallJumpSurfaces: [...wallJumpSurfaces],
        checkpoint
      };
    }
  }

  return {
    completed: false,
    dashLanded,
    finaleLanded,
    player,
    records,
    wallJumpSurfaces: [...wallJumpSurfaces],
    checkpoint
  };
}

function replayOutcome(result) {
  const final = result.records.at(-1);
  return {
    completed: result.completed,
    dashLanded: result.dashLanded,
    finaleLanded: result.finaleLanded,
    x: Number(final.x.toFixed(6)),
    y: Number(final.y.toFixed(6)),
    tick: final.tick,
    checkpoint: final.checkpoint,
    section: final.section,
    wallJumpSurfaces: result.wallJumpSurfaces
  };
}

test("deterministic dash replay rejects the non-dash control and provides a practical timing window", () => {
  const control = replayMovementRoute({
    dashTick: null
  });
  assert.equal(control.completed, false);
  assert.equal(control.dashLanded, false);
  assert.equal(control.records.at(-1).dead, true);

  const successfulTicks = [];
  for (let dashTick = 10; dashTick <= 110; dashTick += 1) {
    const result = replayMovementRoute({ dashTick });
    if (result.dashLanded) {
      successfulTicks.push(dashTick);
    }
  }

  assert.ok(successfulTicks.length >= 3);
  const windows = [];
  for (const dashTick of successfulTicks) {
    const current = windows.at(-1);
    if (current && dashTick === current.at(-1) + 1) {
      current.push(dashTick);
    } else {
      windows.push([dashTick]);
    }
  }
  const practicalWindow = windows.sort(
    (left, right) => right.length - left.length
  )[0];
  const first = practicalWindow[0];
  const last = practicalWindow.at(-1);
  const windowMilliseconds =
    (last - first) * FIXED_TIMESTEP_SECONDS * 1000;
  assert.ok(practicalWindow.length >= 3);
  assert.ok(windowMilliseconds >= 100);

  for (const dashTick of [first, Math.floor((first + last) / 2), last]) {
    const result = replayMovementRoute({ dashTick });
    const landing = result.records.find(record =>
      record.grounded &&
      record.x + MOVEMENT.bodyWidth > DASH_LANDING_X
    );
    assert.equal(result.dashLanded, true);
    assert.ok(landing);
    assert.equal(landing.dead, false);
    assert.equal(landing.grounded, true);
    assert.equal(Number.isFinite(landing.velocityX), true);
    assert.ok(result.records.some(record =>
      record.tick > landing.tick &&
      record.input.moveX === 1
    ));
  }

  console.log(
    `DASH_SUCCESS_WINDOW_TICKS=${first}-${last};` +
    `DASH_SUCCESS_WINDOW_MS=${windowMilliseconds.toFixed(3)}`
  );
});

test("wall-jump, finale, and complete route replay are deterministic across three clean runs", () => {
  const routeDashTick = Array.from(
    { length: 101 },
    (_, index) => index + 10
  ).find(dashTick =>
    replayMovementRoute({ dashTick }).completed
  );
  assert.notEqual(routeDashTick, undefined);

  const runs = Array.from(
    { length: 3 },
    () => replayMovementRoute({
      dashTick: routeDashTick
    })
  );

  for (const run of runs) {
    assert.equal(run.completed, true);
    assert.equal(run.dashLanded, true);
    assert.equal(run.finaleLanded, true);
    assert.ok(run.wallJumpSurfaces.some(surface =>
      Number(surface.split(",")[0]) < 2200
    ));
    assert.ok(run.wallJumpSurfaces.some(surface =>
      Number(surface.split(",")[0]) >= 4160
    ));
    const finaleInputs = run.records.filter(record =>
      record.phase === "finale" &&
      (record.input.jumpPressed || record.input.dashPressed)
    );
    assert.deepEqual(
      finaleInputs.map(record =>
        record.input.dashPressed ? "dash" : "jump"
      ),
      ["jump", "jump", "dash"]
    );
    assert.equal(run.checkpoint.id, "CombatEntry");
    assert.equal(run.records.at(-1).section, "CombatRehearsal");
    assert.equal(run.records.at(-1).checkpoint, "CombatEntry");
    assert.ok(run.records.some(record => record.dashActive));
    assert.ok(run.records.some(record => record.jumpsUsed === 2));
    assert.ok(run.records.every(record => record.respawning === false));
  }

  assert.deepEqual(
    runs.map(replayOutcome),
    [replayOutcome(runs[0]), replayOutcome(runs[0]), replayOutcome(runs[0])]
  );
});

test("finale dash timing has a practical deterministic landing window", () => {
  const successfulTicks = [];
  for (let finaleDashTick = 10; finaleDashTick <= 110; finaleDashTick += 1) {
    const result = replayMovementRoute({
      dashTick: 43,
      finaleDashTick
    });
    if (result.finaleLanded) {
      successfulTicks.push(finaleDashTick);
    }
  }

  const windows = [];
  for (const dashTick of successfulTicks) {
    const current = windows.at(-1);
    if (current && dashTick === current.at(-1) + 1) {
      current.push(dashTick);
    } else {
      windows.push([dashTick]);
    }
  }
  const practicalWindow = windows.sort(
    (left, right) => right.length - left.length
  )[0] ?? [];
  const windowMilliseconds = practicalWindow.length > 0
    ? (practicalWindow.at(-1) - practicalWindow[0]) *
      FIXED_TIMESTEP_SECONDS * 1000
    : 0;

  assert.ok(practicalWindow.length >= 13);
  assert.ok(windowMilliseconds >= 100);
  console.log(
    `FINALE_SUCCESS_WINDOW_TICKS=${practicalWindow[0]}-` +
    `${practicalWindow.at(-1)};FINALE_SUCCESS_WINDOW_MS=` +
    windowMilliseconds.toFixed(3)
  );
});

test("failed deterministic attempt uses the production checkpoint respawn lifecycle", () => {
  const failedAttempt = replayMovementRoute({
    dashTick: null
  });
  const player = failedAttempt.player;
  const respawn = new PlayerRespawnState(player);
  let respawnTick = null;

  assert.equal(failedAttempt.completed, false);
  assert.equal(
    isBelowMovementRoute(player.centerX, player.y),
    true
  );
  assert.equal(respawn.beginRespawn(), true);

  for (let tick = 1; tick < 120; tick += 1) {
    if (
      respawn.update(FIXED_TIMESTEP_SECONDS)
    ) {
      respawnTick = tick;
      break;
    }
  }

  const spawn = getWorldCheckpoint("InitialSpawn");
  assert.notEqual(respawnTick, null);
  assert.equal(respawnTick, 91);
  assert.equal(player.x, spawn.x);
  assert.equal(player.y, spawn.y);
  assert.equal(player.velocityX, 0);
  assert.equal(player.velocityY, 0);
  assert.equal(respawn.currentCheckpoint.id, "InitialSpawn");
  assert.equal(respawn.controlsLocked, false);
});
