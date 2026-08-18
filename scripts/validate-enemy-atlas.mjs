import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const specPath = path.join(
  root,
  "assets/source/characters/enemies/enemy-animation-spec.json"
);
const atlasPath = path.join(
  root,
  "public/assets/atlases/enemies.json"
);
const pngPath = path.join(
  root,
  "public/assets/atlases/enemies.png"
);

for (const file of [specPath, atlasPath, pngPath]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));

if (spec.frameWidth !== 64 || spec.frameHeight !== 64) {
  throw new Error("Enemy frame dimensions must be 64x64.");
}

if (spec.frameCount !== 318 || spec.tagCount !== 58) {
  throw new Error(
    `Expected spec totals 318/58, got ${spec.frameCount}/${spec.tagCount}.`
  );
}

const frameEntries = Array.isArray(atlas.frames)
  ? atlas.frames.map((entry) => [
      entry.filename ?? entry.name,
      entry,
    ])
  : Object.entries(atlas.frames ?? {});

if (frameEntries.length !== spec.frameCount) {
  throw new Error(
    `Expected ${spec.frameCount} frames, found ${frameEntries.length}.`
  );
}

const frameNames = new Set();

for (const [name, entry] of frameEntries) {
  if (!name || frameNames.has(name)) {
    throw new Error(`Duplicate or empty frame name: ${String(name)}`);
  }

  frameNames.add(name);

  const frame = entry.frame;

  if (
    !frame ||
    frame.w !== spec.frameWidth ||
    frame.h !== spec.frameHeight
  ) {
    throw new Error(
      `Frame ${name} is not ${spec.frameWidth}x${spec.frameHeight}.`
    );
  }

  if (entry.trimmed === true) {
    throw new Error(
      `Frame ${name} is trimmed; fixed runtime pivots require untrimmed frames.`
    );
  }
}

const exportedTags = atlas.meta?.frameTags ?? atlas.meta?.frameTags ?? [];

if (exportedTags.length !== spec.tagCount) {
  throw new Error(
    `Expected ${spec.tagCount} frame tags, found ${exportedTags.length}.`
  );
}

const exportedByName = new Map(
  exportedTags.map((tag) => [tag.name, tag])
);

let expectedCursor = 0;

for (const [name, expected] of Object.entries(spec.requiredTags)) {
  const actual = exportedByName.get(name);

  if (!actual) {
    throw new Error(`Missing required tag: ${name}`);
  }

  if (
    actual.from !== expected.from ||
    actual.to !== expected.to
  ) {
    throw new Error(
      `${name}: expected ${expected.from}-${expected.to}, ` +
      `got ${actual.from}-${actual.to}.`
    );
  }

  if (expected.from !== expectedCursor) {
    throw new Error(
      `${name}: non-contiguous range, expected start ${expectedCursor}.`
    );
  }

  expectedCursor = expected.to + 1;
}

if (expectedCursor !== spec.frameCount) {
  throw new Error(
    `Tag ranges cover ${expectedCursor}, expected ${spec.frameCount}.`
  );
}

const png = fs.readFileSync(pngPath);

if (
  png.length < 24 ||
  png.toString("ascii", 1, 4) !== "PNG"
) {
  throw new Error("enemies.png is not a valid PNG file.");
}

const imageWidth = png.readUInt32BE(16);
const imageHeight = png.readUInt32BE(20);

if (
  imageWidth < spec.frameWidth ||
  imageHeight < spec.frameHeight ||
  imageWidth > 16384 ||
  imageHeight > 16384
) {
  throw new Error(
    `Invalid atlas sheet dimensions: ${imageWidth}x${imageHeight}.`
  );
}

const counts = new Map();

for (const expected of Object.values(spec.requiredTags)) {
  counts.set(
    expected.archetype,
    (counts.get(expected.archetype) ?? 0) +
      expected.to - expected.from + 1
  );
}

console.log(
  `Enemy atlas valid: ${frameEntries.length} frames, ` +
  `${exportedTags.length} tags, 64x64px.`
);

console.table(
  [...counts.entries()].map(([archetype, frames]) => ({
    archetype,
    frames,
  }))
);
