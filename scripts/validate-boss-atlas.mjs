import fs from "node:fs";

const specPath =
  "assets/source/characters/boss/boss-animation-spec.json";

const atlasPath =
  "public/assets/atlases/mirror-conductor.json";

const pngPath =
  "public/assets/atlases/mirror-conductor.png";

for (const path of [
  specPath,
  atlasPath,
  pngPath,
]) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing file: ${path}`);
  }
}

const spec = JSON.parse(
  fs.readFileSync(specPath, "utf8")
);

const atlas = JSON.parse(
  fs.readFileSync(atlasPath, "utf8")
);

const frames = Array.isArray(atlas.frames)
  ? atlas.frames
  : Object.entries(atlas.frames ?? {})
      .map(([filename, value]) => ({
        filename,
        ...value,
      }));

if (
  spec.frameWidth !== 128 ||
  spec.frameHeight !== 128
) {
  throw new Error(
    "Boss frame dimensions must be 128x128."
  );
}

if (
  frames.length !== 171 ||
  spec.frameCount !== 171
) {
  throw new Error(
    `Expected 171 frames, found ${frames.length}.`
  );
}

for (const entry of frames) {
  if (
    entry.frame?.w !== 128 ||
    entry.frame?.h !== 128
  ) {
    throw new Error(
      `Invalid frame size: ${entry.filename}`
    );
  }

  if (entry.trimmed === true) {
    throw new Error(
      `Trimmed frame is forbidden: ${entry.filename}`
    );
  }
}

const exportedTags =
  atlas.meta?.frameTags ?? [];

if (
  exportedTags.length !== 21 ||
  spec.tagCount !== 21
) {
  throw new Error(
    `Expected 21 tags, found ${exportedTags.length}.`
  );
}

const byName = new Map(
  exportedTags.map(tag => [
    tag.name,
    tag,
  ])
);

let cursor = 0;

for (
  const [name, expected] of
  Object.entries(spec.requiredTags)
) {
  const actual = byName.get(name);

  if (!actual) {
    throw new Error(
      `Missing boss tag: ${name}`
    );
  }

  if (
    actual.from !== expected.from ||
    actual.to !== expected.to
  ) {
    throw new Error(
      `${name}: expected ` +
      `${expected.from}-${expected.to}, got ` +
      `${actual.from}-${actual.to}.`
    );
  }

  if (expected.from !== cursor) {
    throw new Error(
      `${name}: expected contiguous start ${cursor}.`
    );
  }

  cursor = expected.to + 1;
}

if (cursor !== 171) {
  throw new Error(
    `Boss tags cover ${cursor} frames instead of 171.`
  );
}

const png = fs.readFileSync(pngPath);

if (
  png.length < 24 ||
  png.toString("ascii", 1, 4) !== "PNG"
) {
  throw new Error(
    "mirror-conductor.png is not a valid PNG."
  );
}

const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);

if (
  width > 16384 ||
  height > 16384
) {
  throw new Error(
    `Boss atlas exceeds texture limits: ${width}x${height}.`
  );
}

console.log(
  "Boss atlas valid: " +
  "171 frames, 21 tags, 128x128px."
);

console.table(
  Object.entries(spec.requiredTags)
    .map(([tag, value]) => ({
      tag,
      frames: value.to - value.from + 1,
      range: `${value.from}-${value.to}`,
      durationMs: value.frameDurationMs,
      repeat: value.repeat,
    }))
);
