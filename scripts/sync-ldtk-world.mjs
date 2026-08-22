import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const sourcePath = path.join(
  root,
  "assets/levels/impressario-world.ldtk"
);

const outputPath = path.join(
  root,
  "src/world/WorldLayout.ts"
);

const checkOnly =
  process.argv.includes("--check");

if (!fs.existsSync(sourcePath)) {
  throw new Error(
    `LDtk project missing: ${sourcePath}`
  );
}

const project = JSON.parse(
  fs.readFileSync(sourcePath, "utf8")
);

if (project.jsonVersion !== "1.5.3") {
  throw new Error(
    `Expected LDtk JSON 1.5.3, got ${
      String(project.jsonVersion)
    }.`
  );
}

const level = project.levels?.find(
  candidate =>
    candidate.identifier === "ImpressarioWorld"
);

if (!level) {
  throw new Error(
    "LDtk level ImpressarioWorld is missing."
  );
}

const layer = level.layerInstances?.find(
  candidate =>
    candidate.__identifier === "Entities"
);

if (!layer) {
  throw new Error(
    "LDtk Entities layer is missing."
  );
}

const readField = (
  entity,
  identifier
) => {
  const field = entity.fieldInstances?.find(
    candidate =>
      candidate.__identifier === identifier
  );

  if (!field) {
    throw new Error(
      `${entity.__identifier} is missing field ${identifier}.`
    );
  }

  return field.__value;
};

const readRectangles = identifier =>
  layer.entityInstances
    .filter(
      entity =>
        entity.__identifier === identifier
    )
    .map(entity => ({
      x: Number(entity.px?.[0]),
      y: Number(entity.px?.[1]),
      width: Number(entity.width),
      height: Number(entity.height)
    }))
    .sort(
      (left, right) =>
        left.x - right.x ||
        left.y - right.y ||
        left.width - right.width ||
        left.height - right.height
    );

const collisions =
  readRectangles("CollisionRect");
const oneWayPlatforms =
  readRectangles("OneWayPlatform");
const wallJumpSurfaces =
  readRectangles("WallJumpSurface");

if (collisions.length < 80) {
  throw new Error(
    `Expected at least 80 collisions, got ${collisions.length}.`
  );
}

if (oneWayPlatforms.length < 1) {
  throw new Error(
    "Expected authored one-way platforms."
  );
}

if (wallJumpSurfaces.length < 1) {
  throw new Error(
    "Expected authored wall-jump surfaces."
  );
}

const collisionKeys = new Set();

for (const collision of [
  ...collisions,
  ...oneWayPlatforms,
  ...wallJumpSurfaces
]) {
  const values = [
    collision.x,
    collision.y,
    collision.width,
    collision.height
  ];

  if (
    values.some(
      value =>
        !Number.isInteger(value) ||
        !Number.isFinite(value)
    )
  ) {
    throw new Error(
      "Collision contains non-integer values."
    );
  }

  if (
    collision.width <= 0 ||
    collision.height <= 0
  ) {
    throw new Error(
      "Collision has invalid dimensions."
    );
  }

  const key = values.join(":");

  if (collisionKeys.has(key)) {
    throw new Error(
      `Duplicate collision: ${key}`
    );
  }

  collisionKeys.add(key);
}

const parseColor = value => {
  const text = String(value);

  if (!/^#[0-9a-fA-F]{6}$/.test(text)) {
    throw new Error(
      `Invalid LDtk light color: ${text}`
    );
  }

  return Number.parseInt(
    text.slice(1),
    16
  );
};

const sections = layer.entityInstances
  .filter(
    entity =>
      entity.__identifier === "Section"
  )
  .map(entity => {
    const startX = Number(entity.px?.[0]);

    return {
      id: String(
        readField(
          entity,
          "Identifier"
        )
      ),
      startX,
      endX:
        startX +
        Number(entity.width),
      textureFrame: Number(
        readField(
          entity,
          "TextureFrame"
        )
      ),
      lightColor: parseColor(
        readField(
          entity,
          "LightColor"
        )
      ),
      lightSpacing: Number(
        readField(
          entity,
          "LightSpacing"
        )
      )
    };
  })
  .sort(
    (left, right) =>
      left.startX - right.startX
  );

if (sections.length !== 11) {
  throw new Error(
    `Expected 11 sections, got ${sections.length}.`
  );
}

const sectionIds = new Set();
let cursor = 0;

for (const section of sections) {
  if (!section.id) {
    throw new Error(
      "Section without Identifier."
    );
  }

  if (sectionIds.has(section.id)) {
    throw new Error(
      `Duplicate section identifier: ${section.id}`
    );
  }

  sectionIds.add(section.id);

  if (section.startX !== cursor) {
    throw new Error(
      `Section ${section.id} starts at ${
        section.startX
      }; expected ${cursor}.`
    );
  }

  if (section.endX <= section.startX) {
    throw new Error(
      `Section ${section.id} has invalid bounds.`
    );
  }

  if (
    !Number.isInteger(section.textureFrame) ||
    section.textureFrame < 0 ||
    section.textureFrame > 63
  ) {
    throw new Error(
      `Section ${section.id} has invalid texture frame.`
    );
  }

  if (
    !Number.isInteger(section.lightSpacing) ||
    section.lightSpacing < 240 ||
    section.lightSpacing > 960
  ) {
    throw new Error(
      `Section ${section.id} has invalid light spacing.`
    );
  }

  cursor = section.endX;
}

if (cursor !== Number(level.pxWid)) {
  throw new Error(
    `Sections end at ${cursor}; world ends at ${level.pxWid}.`
  );
}

const lines = [];

lines.push(
  "/* Generated by scripts/sync-ldtk-world.mjs. */",
  "/* Edit assets/levels/impressario-world.ldtk, not this file. */",
  "",
  `export const WORLD_WIDTH = ${Number(level.pxWid)};`,
  `export const WORLD_HEIGHT = ${Number(level.pxHei)};`,
  "",
  "export interface WorldSolid {",
  "  readonly x: number;",
  "  readonly y: number;",
  "  readonly width: number;",
  "  readonly height: number;",
  "}",
  "",
  "export interface WorldOneWayPlatform extends WorldSolid {}",
  "",
  "export interface WorldWallJumpSurface extends WorldSolid {}",
  "",
  "export interface WorldSection {",
  "  readonly id: string;",
  "  readonly startX: number;",
  "  readonly endX: number;",
  "  readonly textureFrame: number;",
  "  readonly lightColor: number;",
  "  readonly lightSpacing: number;",
  "}",
  "",
  "export const WORLD_SOLIDS: readonly WorldSolid[] = ["
);

for (const collision of collisions) {
  lines.push(
    "  { " +
      `x: ${collision.x}, ` +
      `y: ${collision.y}, ` +
      `width: ${collision.width}, ` +
      `height: ${collision.height} ` +
      "},"
  );
}

lines.push(
  "] as const;",
  "",
  "export const WORLD_ONE_WAY_PLATFORMS: readonly WorldOneWayPlatform[] = ["
);

for (const platform of oneWayPlatforms) {
  lines.push(
    "  { " +
      `x: ${platform.x}, ` +
      `y: ${platform.y}, ` +
      `width: ${platform.width}, ` +
      `height: ${platform.height} ` +
      "},"
  );
}

lines.push(
  "] as const;",
  "",
  "export const WORLD_WALL_JUMP_SURFACES: readonly WorldWallJumpSurface[] = ["
);

for (const surface of wallJumpSurfaces) {
  lines.push(
    "  { " +
      `x: ${surface.x}, ` +
      `y: ${surface.y}, ` +
      `width: ${surface.width}, ` +
      `height: ${surface.height} ` +
      "},"
  );
}

lines.push(
  "] as const;",
  "",
  "export const WORLD_SECTIONS: readonly WorldSection[] = ["
);

for (const section of sections) {
  lines.push(
    "  { " +
      `id: ${JSON.stringify(section.id)}, ` +
      `startX: ${section.startX}, ` +
      `endX: ${section.endX}, ` +
      `textureFrame: ${section.textureFrame}, ` +
      `lightColor: 0x${section.lightColor
        .toString(16)
        .padStart(6, "0")}, ` +
      `lightSpacing: ${section.lightSpacing} ` +
      "},"
  );
}

lines.push(
  "] as const;",
  ""
);

const generated = lines.join("\n");

if (checkOnly) {
  if (!fs.existsSync(outputPath)) {
    throw new Error(
      `Generated runtime file missing: ${outputPath}`
    );
  }

  const existing = fs.readFileSync(
    outputPath,
    "utf8"
  );

  if (existing !== generated) {
    throw new Error(
      "WorldLayout.ts is stale. Run npm run levels:sync."
    );
  }

  console.log(
    `LDtk runtime valid: ${
      collisions.length
    } solids, ${
      oneWayPlatforms.length
    } one-way platforms, ${
      wallJumpSurfaces.length
    } wall-jump surfaces, ${
      sections.length
    } sections, ${level.pxWid}x${level.pxHei}; ` +
    "visual metadata valid."
  );
} else {
  fs.writeFileSync(
    outputPath,
    generated,
    "utf8"
  );

  console.log(
    `Generated ${path.relative(
      root,
      outputPath
    )}: ${collisions.length} solids, ` +
    `${oneWayPlatforms.length} one-way platforms, ` +
    `${wallJumpSurfaces.length} wall-jump surfaces, ` +
    `${sections.length} visual sections.`
  );
}
