import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isLocalDevelopmentHostname
} from "../src/leaderboard/LocalEnvironment.ts";
import {
  MOVEMENT_ENVIRONMENT_FOREGROUND_DEPTH,
  MOVEMENT_TUTORIAL_MARKER_DEPTH,
  MOVEMENT_TUTORIAL_SIGNAGE_DEPTH,
  MOVEMENT_TUTORIAL_SIGNS,
  OPENING_CONTROL_INSTRUCTIONS
} from "../src/world/MovementTutorial.ts";

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

test("all opening tutorial instructions share a world-space signage layer above scenery", async () => {
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
    ["MOVE", "JUMP", "DOUBLE", "WALL", "DASH", "FINALE"]
  );

  for (const required of [
    "Move",
    "Jump / Double Jump",
    "Dash",
    "Gamepad"
  ]) {
    assert.ok(
      OPENING_CONTROL_INSTRUCTIONS.some(line =>
        line.includes(required)
      ),
      `missing ${required} instruction`
    );
  }

  const main = await source("src/main.ts");
  const visuals = await source("src/world/MovementRehearsalVisuals.ts");

  assert.match(main, /OPENING_CONTROL_INSTRUCTIONS\.join/);
  assert.match(main, /\.setScrollFactor\(1\)\s*\.setDepth\(\s*MOVEMENT_TUTORIAL_SIGNAGE_DEPTH/s);
  assert.match(visuals, /MOVEMENT_TUTORIAL_SIGNS/);
  assert.match(visuals, /MOVEMENT_TUTORIAL_SIGNAGE_DEPTH/);
  assert.match(
    main,
    /OPENING_CONTROL_INSTRUCTIONS\.join\([\s\S]*?\.setScrollFactor\(1\)[\s\S]*?MOVEMENT_TUTORIAL_SIGNAGE_DEPTH/
  );
});
