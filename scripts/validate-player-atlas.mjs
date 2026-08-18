import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const project = process.cwd();

const atlasPath = path.join(
  project,
  "public/assets/atlases/impressario.json",
);

const imagePath = path.join(
  project,
  "public/assets/atlases/impressario.png",
);

const specPath = path.join(
  project,
  "assets/source/characters/impressario/player-animation-spec.json",
);

function fail(message) {
  console.error(`Player-Atlas ungültig: ${message}`);
  process.exit(1);
}

for (const file of [atlasPath, imagePath, specPath]) {
  if (!fs.existsSync(file)) {
    fail(`Datei fehlt: ${file}`);
  }
}

const atlas = JSON.parse(
  fs.readFileSync(atlasPath, "utf8"),
);

const spec = JSON.parse(
  fs.readFileSync(specPath, "utf8"),
);

if (!atlas.frames || typeof atlas.frames !== "object") {
  fail("frames fehlen");
}

if (!atlas.meta || !Array.isArray(atlas.meta.frameTags)) {
  fail("meta.frameTags fehlen");
}

const frameEntries = Array.isArray(atlas.frames)
  ? atlas.frames.map((frame, index) => [String(index), frame])
  : Object.entries(atlas.frames);

if (frameEntries.length === 0) {
  fail("Atlas enthält keine Frames");
}

const expectedWidth = Number(spec.canvas.width);
const expectedHeight = Number(spec.canvas.height);

for (const [frameName, frame] of frameEntries) {
  if (!frame.sourceSize) {
    fail(`Frame ${frameName} enthält keine sourceSize`);
  }

  const width = Number(frame.sourceSize.w);
  const height = Number(frame.sourceSize.h);

  if (width !== expectedWidth || height !== expectedHeight) {
    fail(
      `Frame ${frameName}: ${width}x${height}; erwartet ` +
      `${expectedWidth}x${expectedHeight}`,
    );
  }

  if (frame.rotated) {
    fail(`Frame ${frameName} wurde rotiert`);
  }
}

const tags = new Map();

for (const tag of atlas.meta.frameTags) {
  if (
    typeof tag.name !== "string" ||
    !Number.isInteger(tag.from) ||
    !Number.isInteger(tag.to)
  ) {
    fail("Ungültige Tag-Metadaten");
  }

  if (tags.has(tag.name)) {
    fail(`Tag doppelt vorhanden: ${tag.name}`);
  }

  tags.set(tag.name, tag);
}

for (const [name, definition] of Object.entries(spec.requiredTags)) {
  const tag = tags.get(name);

  if (!tag) {
    fail(`Pflicht-Tag fehlt: ${name}`);
  }

  const frameCount = Math.abs(tag.to - tag.from) + 1;

  if (frameCount < definition.minimumFrames) {
    fail(
      `${name}: ${frameCount} Frames; ` +
      `Minimum ${definition.minimumFrames}`,
    );
  }
}

if (
  Number.isInteger(spec.totalFrames) &&
  frameEntries.length !== spec.totalFrames
) {
  fail(
    `${frameEntries.length} Frames vorhanden; ` +
    `${spec.totalFrames} erwartet`,
  );
}

if (
  Number.isInteger(spec.requiredTagCount) &&
  tags.size !== spec.requiredTagCount
) {
  fail(
    `${tags.size} Tags vorhanden; ` +
    `${spec.requiredTagCount} erwartet`,
  );
}

for (const [name, definition] of Object.entries(spec.requiredTags)) {
  const tag = tags.get(name);

  if (
    Number.isInteger(definition.from) &&
    tag.from !== definition.from
  ) {
    fail(
      `${name}: Startframe ${tag.from}; ` +
      `${definition.from} erwartet`,
    );
  }

  if (
    Number.isInteger(definition.to) &&
    tag.to !== definition.to
  ) {
    fail(
      `${name}: Endframe ${tag.to}; ` +
      `${definition.to} erwartet`,
    );
  }
}

for (const name of tags.keys()) {
  if (!(name in spec.requiredTags)) {
    fail(`Unerwarteter Tag: ${name}`);
  }
}

console.log(
  `Player-Atlas gültig: ${frameEntries.length} Frames, ` +
  `${tags.size} Tags, ${expectedWidth}x${expectedHeight}px`,
);

for (const [name, definition] of Object.entries(spec.requiredTags)) {
  const tag = tags.get(name);
  const frameCount = Math.abs(tag.to - tag.from) + 1;

  console.log(
    `  ${name}: ${frameCount} Frames ` +
    `(empfohlen ${definition.recommendedFrames})`,
  );
}
