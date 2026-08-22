import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isLocalDevelopmentHostname
} from "../src/leaderboard/LocalEnvironment.ts";
import {
  INITIAL_PLAYER_ROUTE,
  MOVEMENT_ENVIRONMENT_FOREGROUND_DEPTH,
  MOVEMENT_SECTION_LABELS,
  MOVEMENT_TUTORIAL_MARKER_DEPTH,
  MOVEMENT_TUTORIAL_SIGNAGE_DEPTH,
  MOVEMENT_TUTORIAL_SIGNS,
  OPENING_CONTROL_INSTRUCTIONS,
  OPENING_CONTROL_PANEL,
  OPENING_TUTORIAL_SUBTITLE,
  OPENING_TUTORIAL_TITLE,
  rectanglesOverlap,
  tutorialMarkerBounds,
  tutorialSignBounds
} from "../src/world/MovementTutorial.ts";
import {
  WORLD_HEIGHT,
  WORLD_ONE_WAY_PLATFORMS,
  WORLD_SECTIONS,
  WORLD_SOLIDS,
  WORLD_WALL_JUMP_SURFACES
} from "../src/world/WorldLayout.ts";
import {
  WORLD_CHECKPOINTS,
  getWorldCheckpoint
} from "../src/world/WorldGameplay.ts";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("local development host detection is explicit and production-safe", () => {
  for (const hostname of [
    "localhost",
    "LOCALHOST.",
    "game.localhost",
    "127.0.0.1",
    "127.12.34.56",
    "::1",
    "[::1]",
    "0:0:0:0:0:0:0:1"
  ]) {
    assert.equal(
      isLocalDevelopmentHostname(hostname),
      true,
      `${hostname} should be local`
    );
  }

  for (const hostname of [
    "impressario-midnight-show.contact-541.workers.dev",
    "preview.example.com",
    "localhost.example.com",
    "127.999.0.1",
    "128.0.0.1"
  ]) {
    assert.equal(
      isLocalDevelopmentHostname(hostname),
      false,
      `${hostname} should not be local`
    );
  }
});

test("player identity copy and same-origin production payload remain compatible", async () => {
  const client = await source("src/leaderboard/LeaderboardClient.ts");
  const worker = await source("worker/src/index.ts");
  const migration = await source("worker/migrations/0001_initial.sql");

  assert.match(client, /Enter your player name and begin the show\./);
  assert.match(client, /"PLAYER NAME"/);
  assert.doesNotMatch(client, /stage name|stageName/i);
  assert.match(client, /const API_BASE = "\/api"/);
  assert.match(client, /JSON\.stringify\(\{\s*playerName,\s*turnstileToken/s);
  assert.match(worker, /body\.playerName/);
  assert.match(worker, /playerName:\s*run\.player_name/s);
  assert.match(migration, /player_name TEXT NOT NULL/);
});

test("ranked startup coordinates early events and completion without delaying game boot", async () => {
  const client = await source(
    "src/leaderboard/LeaderboardClient.ts"
  );

  assert.match(
    client,
    /private readonly pendingEvents:\s*RunEvent\[\] = \[\]/
  );
  assert.match(
    client,
    /if \(this\.rankedRunPending\) \{\s*this\.pendingEvents\.push\(event\)/s
  );
  assert.match(
    client,
    /this\.onlineRun = true;\s*this\.flushPendingEvents\(\)/s
  );
  assert.match(
    client,
    /await this\.sessionInitialization;[\s\S]*?this\.flushPendingEvents\(\);\s*await this\.eventQueue;[\s\S]*?\/finish/
  );
  assert.match(
    client,
    /if \(this\.finishing\) \{\s*return;\s*\}\s*this\.finishing = true/s
  );
  assert.match(
    client,
    /if \(this\.gameStarted\) \{\s*return;\s*\}\s*this\.gameStarted = true/s
  );

  const startGameIndex = client.indexOf(
    "this.startGame?.();"
  );
  const sessionIndex = client.indexOf(
    "this.sessionInitialization ="
  );

  assert.ok(startGameIndex >= 0);
  assert.ok(sessionIndex > startGameIndex);
  assert.doesNotMatch(
    client.slice(startGameIndex, sessionIndex),
    /await\b/,
    "game construction must remain inside transient user activation"
  );
});

test("environment rendering removes repeated full-world textures", async () => {
  const environment = await source(
    "src/world/EnvironmentTileRenderer.ts"
  );
  const main = await source("src/main.ts");

  assert.equal(
    (environment.match(/\.add\.tileSprite\(/g) ?? []).length,
    0,
    "the repeated environment raster must not return"
  );
  assert.doesNotMatch(environment, /spritesheet|TEXTURE_URL|TEXTURE_KEY/);
  assert.doesNotMatch(environment, /createParallaxLayer|createMaterialLayers/);
  assert.doesNotMatch(environment, /createCollisionVisualsForSection/);
  assert.doesNotMatch(environment, /WORLD_WIDTH|WORLD_HEIGHT|WORLD_SOLIDS/);
  assert.doesNotMatch(main, /EnvironmentTileRenderer\.preload/);

  assert.equal(
    (main.match(/new EnvironmentTileRenderer\(/g) ?? []).length,
    1,
    "the environment renderer must initialize once"
  );
  assert.equal(
    (main.match(/new MovementRehearsalVisuals\(/g) ?? []).length,
    1,
    "MovementRehearsal visuals must initialize once"
  );
  assert.equal(
    (main.match(/new Phaser\.Game\(\{/g) ?? []).length,
    1,
    "the application must create one Phaser game"
  );
  assert.match(main, /type: Phaser\.WEBGL/);
});

test("MovementRehearsal alone restricts camera and lower fall recovery", async () => {
  const movement = WORLD_SECTIONS.find(
    section => section.id === "MovementRehearsal"
  );
  const combat = WORLD_SECTIONS.find(
    section => section.id === "CombatRehearsal"
  );

  assert.ok(movement);
  assert.ok(combat);
  assert.equal(movement.startX, 0);
  assert.equal(movement.endX, combat.startX);
  assert.equal(WORLD_HEIGHT, 720);

  const movementSolids = WORLD_SOLIDS.filter(solid =>
    solid.x < movement.endX
  );
  const laterSolids = WORLD_SOLIDS.filter(solid =>
    solid.x >= movement.endX
  );

  assert.equal(
    movementSolids.some(solid => solid.y >= 512),
    false,
    "the unintended lower fallback route must be absent only from MovementRehearsal"
  );
  assert.equal(
    laterSolids.some(solid => solid.y >= 512),
    true,
    "later authored lower geometry must remain intact"
  );
  assert.ok(
    movementSolids.some(solid =>
      solid.x === 1680 && solid.y === 402 &&
      solid.width === 136 && solid.height === 20
    )
  );
  assert.ok(
    movementSolids.some(solid =>
      solid.x === 1840 && solid.y === 370 &&
      solid.width === 176 && solid.height === 20
    )
  );

  for (const checkpoint of WORLD_CHECKPOINTS) {
    const supportingSolid = WORLD_SOLIDS.find(solid =>
      checkpoint.x >= solid.x &&
      checkpoint.x <= solid.x + solid.width &&
      solid.y >= checkpoint.y + 30 &&
      solid.y - checkpoint.y <= 64
    );

    assert.ok(
      supportingSolid,
      `${checkpoint.id} must retain authored supporting geometry`
    );
  }

  const main = await source("src/main.ts");
  const bounds = await source("src/world/MovementRouteBounds.ts");

  assert.match(main, /restrictToMovementRoute\s*\?\s*MOVEMENT_ROUTE_CAMERA_HEIGHT\s*:\s*WORLD_HEIGHT/s);
  assert.match(main, /this\.updateCameraBounds\(\)/);
  assert.match(bounds, /WORLD_SECTIONS\.find/);
  assert.match(bounds, /MOVEMENT_ROUTE_CAMERA_HEIGHT = 360/);
  assert.match(bounds, /playerY > MOVEMENT_ROUTE_FALL_OUT_Y/);
  assert.doesNotMatch(bounds, /5376/);
  assert.doesNotMatch(main, /skipMissedFrames:\s*true/);
});

test("Mirror Conductor threshold cue has section-owned lifecycle cleanup", async () => {
  const system = await source(
    "src/world/MirrorConductorSystem.ts"
  );

  assert.equal(
    (
      system.match(
        /"CROSS THE THRESHOLD WHEN READY"/g
      ) ?? []
    ).length,
    1,
    "the cue must have one owner and cannot be duplicated"
  );
  assert.match(
    system,
    /shouldShowMirrorConductorThresholdCue\(\{\s*insideSection,\s*bossStarted: this\.bossStarted,\s*bossDefeated: this\.bossDefeated,\s*finaleActive: this\.finaleActive,\s*controlsLocked:\s*this\.playerHealth\.controlsLocked,\s*playerX: this\.player\.x,\s*thresholdX:\s*MIRROR_CONDUCTOR_THRESHOLD_X\s*\}\)/s
  );
  assert.match(
    system,
    /private clearThresholdCue\(\): void \{\s*this\.hud\s*\.setText\(""\)\s*\.setVisible\(false\)/s
  );
  assert.match(
    system,
    /public resetAfterDeath\(\): void[\s\S]*?this\.clearThresholdCue\(\)/
  );
  assert.match(
    system,
    /private startBoss\(\): void[\s\S]*?this\.clearThresholdCue\(\)/
  );
});

test("opening tutorial has one readable control presentation outside the player route", async () => {
  assert.ok(
    MOVEMENT_ENVIRONMENT_FOREGROUND_DEPTH <
      MOVEMENT_TUTORIAL_MARKER_DEPTH
  );
  assert.ok(
    MOVEMENT_TUTORIAL_MARKER_DEPTH <
      MOVEMENT_TUTORIAL_SIGNAGE_DEPTH
  );
  assert.ok(MOVEMENT_TUTORIAL_SIGNAGE_DEPTH < 20);

  assert.deepEqual(
    MOVEMENT_TUTORIAL_SIGNS.map(({ title }) => title),
    [
      "JUMP",
      "DOUBLE JUMP",
      "DROP THROUGH",
      "WALL JUMP",
      "AIR DASH",
      "FINALE"
    ]
  );

  for (const required of [
    "MOVE",
    "JUMP / DOUBLE JUMP",
    "DASH",
    "FAST FALL",
    "CANE ATTACK",
    "GAMEPAD"
  ]) {
    assert.ok(
      OPENING_CONTROL_INSTRUCTIONS.some(line =>
        line.includes(required)
      ),
      `missing ${required} instruction`
    );
  }

  const movePresentations =
    OPENING_CONTROL_INSTRUCTIONS.filter(line =>
      /\bMOVE\b/.test(line)
    ).length +
    MOVEMENT_TUTORIAL_SIGNS.filter(sign =>
      sign.title === "MOVE"
    ).length;

  assert.equal(
    movePresentations,
    1,
    "the opening must not regain a competing MOVE sign"
  );

  const openingElements = [
    ["Act I title", OPENING_TUTORIAL_TITLE],
    ["subtitle", OPENING_TUTORIAL_SUBTITLE],
    ["control panel", OPENING_CONTROL_PANEL]
  ];

  for (
    let firstIndex = 0;
    firstIndex < openingElements.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < openingElements.length;
      secondIndex += 1
    ) {
      const [firstName, first] =
        openingElements[firstIndex];
      const [secondName, second] =
        openingElements[secondIndex];

      assert.equal(
        rectanglesOverlap(first, second),
        false,
        `${firstName} overlaps ${secondName}`
      );
    }
  }

  for (const [name, rectangle] of openingElements) {
    assert.equal(
      rectanglesOverlap(
        rectangle,
        INITIAL_PLAYER_ROUTE
      ),
      false,
      `${name} overlaps the initial player route`
    );
  }

  const spawn = getWorldCheckpoint("InitialSpawn");

  assert.ok(
    spawn.x >= INITIAL_PLAYER_ROUTE.x &&
      spawn.x + 18 <=
        INITIAL_PLAYER_ROUTE.x +
          INITIAL_PLAYER_ROUTE.width &&
      spawn.y >= INITIAL_PLAYER_ROUTE.y &&
      spawn.y + 30 <=
        INITIAL_PLAYER_ROUTE.y +
          INITIAL_PLAYER_ROUTE.height,
    "initial route must contain the full spawn body"
  );

  const tutorialRectangles = [
    ...openingElements,
    ...MOVEMENT_TUTORIAL_SIGNS.flatMap(sign => [
      [
        `${sign.title} sign`,
        tutorialSignBounds(sign)
      ],
      [
        `${sign.title} marker`,
        tutorialMarkerBounds(sign)
      ]
    ]),
    ...MOVEMENT_SECTION_LABELS.map(label => [
      `${label.text} label`,
      label
    ])
  ];

  for (const [name, rectangle] of tutorialRectangles) {
    for (const solid of [
      ...WORLD_SOLIDS,
      ...WORLD_ONE_WAY_PLATFORMS,
      ...WORLD_WALL_JUMP_SURFACES
    ]) {
      assert.equal(
        rectanglesOverlap(rectangle, solid),
        false,
        `${name} overlaps solid ${JSON.stringify(solid)}`
      );
    }
  }

  const main = await source("src/main.ts");
  const visuals = await source("src/world/MovementRehearsalVisuals.ts");

  assert.match(main, /OPENING_CONTROL_INSTRUCTIONS\.join/);
  assert.match(main, /OPENING_CONTROL_PANEL\.x/);
  assert.match(main, /MOVEMENT_SECTION_LABELS/);
  assert.match(main, /\.setScrollFactor\(1\)\s*\.setDepth\(\s*MOVEMENT_TUTORIAL_SIGNAGE_DEPTH/s);
  assert.match(visuals, /MOVEMENT_TUTORIAL_SIGNS/);
  assert.match(visuals, /OPENING_TUTORIAL_TITLE\.x/);
  assert.doesNotMatch(visuals, /title:\s*"MOVE"/);
});
