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
  rectanglesOverlap
} from "../src/world/MovementTutorial.ts";
import {
  WORLD_SOLIDS
} from "../src/world/WorldLayout.ts";
import {
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
    (main.match(/new Phaser\.Game\(config\)/g) ?? []).length,
    1,
    "the application must create one Phaser game"
  );
  assert.match(main, /type: Phaser\.WEBGL/);
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
    ["JUMP", "DOUBLE", "WALL", "DASH", "FINALE"]
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
    ...MOVEMENT_TUTORIAL_SIGNS.map(sign => [
      `${sign.title} sign`,
      {
        x: sign.x - sign.width / 2,
        y: sign.y,
        width: sign.width,
        height: sign.height
      }
    ]),
    ...MOVEMENT_SECTION_LABELS.map(label => [
      `${label.text} label`,
      label
    ])
  ];

  for (const [name, rectangle] of tutorialRectangles) {
    for (const solid of WORLD_SOLIDS) {
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
