import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  WORLD_SECTIONS
} from "../src/world/WorldLayout.ts";
import {
  WORLD_GATES
} from "../src/world/WorldGameplay.ts";
const root = new URL("../", import.meta.url);

function getWorldSection(playerX) {
  return WORLD_SECTIONS.find(section =>
    playerX >= section.startX &&
    playerX < section.endX
  ) ?? null;
}

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("all ten contiguous boundaries have deterministic half-open ownership", () => {
  assert.equal(WORLD_SECTIONS.length, 11);

  for (let index = 0; index < WORLD_SECTIONS.length - 1; index += 1) {
    const left = WORLD_SECTIONS[index];
    const right = WORLD_SECTIONS[index + 1];
    const boundary = left.endX;

    assert.equal(boundary, right.startX);
    assert.equal(getWorldSection(boundary - 0.001)?.id, left.id);
    assert.equal(getWorldSection(boundary)?.id, right.id);
    assert.equal(getWorldSection(boundary + 0.001)?.id, right.id);
    assert.equal(WORLD_SECTIONS.indexOf(getWorldSection(boundary)), index + 1);
  }

  assert.equal(getWorldSection(-1), null);
  assert.equal(getWorldSection(Number.NaN), null);
  assert.equal(getWorldSection(WORLD_SECTIONS.at(-1).endX), null);
});

test("authored gates do not impose one-way section-boundary progression", () => {
  const boundaries = new Set(
    WORLD_SECTIONS.slice(0, -1).map(section => section.endX)
  );

  assert.deepEqual(
    WORLD_GATES.filter(gate => boundaries.has(gate.x)),
    []
  );
});

test("crossfade repair owns and cancels handle tweens before replacement", async () => {
  const music = await source("src/audio/MusicDirector.ts");

  assert.match(music, /this\.stopFadingHandles\(id\);[\s\S]*?this\.audio\.play\(id/);
  assert.match(music, /private readonly activeFades/);
  assert.match(music, /this\.cancelFade\(handle\);\s*handle\.stop\(\)/);
  assert.match(music, /Phaser\.Sound\.Events\.DESTROY,[\s\S]*?this\.cancelFade\(next\)/);
  assert.match(music, /onStop:\s*\(\) => \{\s*this\.activeFades\.delete/s);
});

test("QA traversal hook is compile-time guarded and ordinary source has no unconditional export", async () => {
  const main = await source("src/main.ts");

  assert.match(main, /VITE_QA_RUNTIME_INSPECTION/);
  assert.match(main, /if \(QA_RUNTIME_INSPECTION\) \{[\s\S]*?__IMPRESSARIO_BOUNDARY_QA__/);
  assert.doesNotMatch(main, /window\.__IMPRESSARIO_BOUNDARY_QA__\s*=/);
});
