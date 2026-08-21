import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const read = relativePath =>
  fs.readFileSync(
    path.join(root, relativePath),
    "utf8"
  );

const project = JSON.parse(
  read(
    "assets/levels/impressario-world.ldtk"
  )
);

const level = project.levels?.find(
  candidate =>
    candidate.identifier === "ImpressarioWorld"
);

if (!level) {
  throw new Error(
    "ImpressarioWorld is missing."
  );
}

if (
  Number(level.pxWid) !== 49824 ||
  Number(level.pxHei) !== 720
) {
  throw new Error(
    `Unexpected world size: ${level.pxWid}x${level.pxHei}.`
  );
}

const layer = level.layerInstances?.find(
  candidate =>
    candidate.__identifier === "Entities"
);

if (!layer) {
  throw new Error(
    "Entities layer is missing."
  );
}

const collisions =
  layer.entityInstances.filter(
    entity =>
      entity.__identifier === "CollisionRect"
  );

const sections =
  layer.entityInstances.filter(
    entity =>
      entity.__identifier === "Section"
  );

if (collisions.length !== 431) {
  throw new Error(
    `Expected 431 collisions, got ${collisions.length}.`
  );
}

const grandGalleryCollisions =
  collisions.filter(
    entity =>
      entity.__worldX >= 13744 &&
      entity.__worldX < 19456
  );

if (grandGalleryCollisions.length !== 23) {
  throw new Error(
    "Expected 23 authored GrandGallery collisions, " +
    `got ${grandGalleryCollisions.length}.`
  );
}

for (const [x, y, width, height] of [
  [13744, 326, 1248, 34],
  [14992, 358, 768, 34],
  [15760, 326, 1152, 34],
  [16912, 374, 832, 34],
  [17744, 326, 976, 34],
  [13744, 640, 5712, 32]
]) {
  if (
    !grandGalleryCollisions.some(
      entity =>
        entity.__worldX === x &&
        entity.__worldY === y &&
        entity.width === width &&
        entity.height === height
    )
  ) {
    throw new Error(
      `GrandGallery collision ${x},${y},${width},${height} is missing.`
    );
  }
}

if (sections.length !== 11) {
  throw new Error(
    `Expected 11 sections, got ${sections.length}.`
  );
}

const expectedSectionBounds = [
  ["MovementRehearsal", 0, 5376],
  ["CombatRehearsal", 5376, 5088],
  ["MainStage", 10464, 3280],
  ["GrandGallery", 13744, 5712],
  ["GalleryGauntlet", 19456, 4096],
  ["SpotlightVault", 23552, 4432],
  ["CardSanctum", 27984, 3680],
  ["RoyalBox", 31664, 3680],
  ["MirrorCore", 35344, 3856],
  ["ConductorApproach", 39200, 5472],
  ["MirrorConductor", 44672, 5152]
];

for (const [identifier, x, width] of expectedSectionBounds) {
  const section = sections.find(
    candidate => {
      const fields = new Map(
        candidate.fieldInstances.map(
          field => [field.__identifier, field.__value]
        )
      );

      return fields.get("Identifier") === identifier;
    }
  );

  if (
    !section ||
    section.__worldX !== x ||
    section.width !== width
  ) {
    throw new Error(
      `${identifier}: expected bounds ${x}..${x + width}.`
    );
  }
}

for (const section of sections) {
  const fields = new Map(
    section.fieldInstances.map(
      field => [
        field.__identifier,
        field.__value
      ]
    )
  );

  const identifier = String(
    fields.get("Identifier") ?? ""
  );

  const textureFrame = Number(
    fields.get("TextureFrame")
  );

  const lightColor = String(
    fields.get("LightColor") ?? ""
  );

  const lightSpacing = Number(
    fields.get("LightSpacing")
  );

  if (!identifier) {
    throw new Error(
      "Section Identifier is missing."
    );
  }

  if (
    !Number.isInteger(textureFrame) ||
    textureFrame < 0 ||
    textureFrame > 63
  ) {
    throw new Error(
      `${identifier}: invalid TextureFrame.`
    );
  }

  if (
    !/^#[0-9A-Fa-f]{6}$/.test(lightColor)
  ) {
    throw new Error(
      `${identifier}: invalid LightColor.`
    );
  }

  if (
    !Number.isInteger(lightSpacing) ||
    lightSpacing < 240 ||
    lightSpacing > 960
  ) {
    throw new Error(
      `${identifier}: invalid LightSpacing.`
    );
  }
}

const combat = read(
  "src/combat/CombatSystem.ts"
);

if (combat.includes("17280")) {
  throw new Error(
    "CombatSystem still contains legacy world width 17280."
  );
}

if (
  !combat.includes("WORLD_WIDTH") ||
  !combat.includes("WORLD_HEIGHT")
) {
  throw new Error(
    "CombatSystem does not use generated world bounds."
  );
}

const renderer = read(
  "src/world/EnvironmentTileRenderer.ts"
);

for (const forbidden of [
  "SECTION_FRAME",
  "SECTION_LIGHT",
  "18720"
]) {
  if (renderer.includes(forbidden)) {
    throw new Error(
      `Renderer contains duplicated metadata: ${forbidden}.`
    );
  }
}

for (const required of [
  "section.textureFrame",
  "section.lightColor",
  "section.lightSpacing",
  "WORLD_WIDTH"
]) {
  if (!renderer.includes(required)) {
    throw new Error(
      `Renderer is missing metadata usage: ${required}.`
    );
  }
}

const sourceFiles = [
  "src/main.ts",
  "src/combat/CombatSystem.ts",
  "src/world/EnvironmentTileRenderer.ts",
  "src/world/MirrorCoreSystem.ts"
];

for (const file of sourceFiles) {
  const source = read(file);

  if (source.includes("dist-does-not-exist")) {
    throw new Error(
      `${file} contains the obsolete failing import.`
    );
  }
}

console.log(
  "World runtime valid: 49824x720, " +
  "431 collisions, 11 LDtk-driven visual sections, " +
  "dynamic combat camera bounds."
);
