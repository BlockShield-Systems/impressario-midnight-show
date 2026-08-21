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

if (collisions.length !== 296) {
  throw new Error(
    `Expected 296 collisions, got ${collisions.length}.`
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

const galleryGauntletCollisions =
  collisions.filter(
    entity =>
      entity.__worldX >= 19456 &&
      entity.__worldX < 23552
  );

if (galleryGauntletCollisions.length !== 24) {
  throw new Error(
    "Expected 24 authored GalleryGauntlet collisions, " +
    `got ${galleryGauntletCollisions.length}.`
  );
}

for (const [x, y, width, height] of [
  [19456, 480, 256, 32],
  [19936, 480, 448, 32],
  [20448, 480, 256, 32],
  [21120, 480, 1344, 32],
  [23424, 352, 128, 32],
  [19456, 688, 4096, 32]
]) {
  if (
    !galleryGauntletCollisions.some(
      entity =>
        entity.__worldX === x &&
        entity.__worldY === y &&
        entity.width === width &&
        entity.height === height
    )
  ) {
    throw new Error(
      `GalleryGauntlet collision ${x},${y},${width},${height} is missing.`
    );
  }
}

const spotlightVaultCollisions =
  collisions.filter(
    entity =>
      entity.__worldX >= 23552 &&
      entity.__worldX < 27984
  );

if (spotlightVaultCollisions.length !== 21) {
  throw new Error(
    "Expected 21 authored SpotlightVault collisions, " +
    `got ${spotlightVaultCollisions.length}.`
  );
}

for (const [x, y, width, height] of [
  [23552, 352, 192, 32],
  [24000, 448, 1856, 32],
  [25856, 448, 768, 32],
  [26624, 416, 448, 32],
  [27776, 480, 208, 32],
  [23552, 688, 4432, 32]
]) {
  if (
    !spotlightVaultCollisions.some(
      entity =>
        entity.__worldX === x &&
        entity.__worldY === y &&
        entity.width === width &&
        entity.height === height
    )
  ) {
    throw new Error(
      `SpotlightVault collision ${x},${y},${width},${height} is missing.`
    );
  }
}

const cardSanctumCollisions =
  collisions.filter(
    entity =>
      entity.__worldX >= 27984 &&
      entity.__worldX < 31664
  );

if (cardSanctumCollisions.length !== 24) {
  throw new Error(
    "Expected 24 authored CardSanctum collisions, " +
    `got ${cardSanctumCollisions.length}.`
  );
}

for (const [x, y, width, height] of [
  [27984, 480, 256, 32],
  [28240, 528, 432, 32],
  [29408, 288, 24, 240],
  [29568, 240, 24, 272],
  [31216, 480, 448, 32],
  [27984, 688, 3680, 32]
]) {
  if (
    !cardSanctumCollisions.some(
      entity =>
        entity.__worldX === x &&
        entity.__worldY === y &&
        entity.width === width &&
        entity.height === height
    )
  ) {
    throw new Error(
      `CardSanctum collision ${x},${y},${width},${height} is missing.`
    );
  }
}

const royalBoxCollisions =
  collisions.filter(
    entity =>
      entity.__worldX >= 31664 &&
      entity.__worldX < 35344
  );

if (royalBoxCollisions.length !== 24) {
  throw new Error(
    "Expected 24 authored RoyalBox collisions, " +
    `got ${royalBoxCollisions.length}.`
  );
}

for (const [x, y, width, height] of [
  [31664, 480, 336, 32],
  [32000, 528, 384, 32],
  [32896, 480, 448, 32],
  [33376, 288, 24, 240],
  [34912, 480, 432, 32],
  [31664, 688, 3680, 32]
]) {
  if (
    !royalBoxCollisions.some(
      entity =>
        entity.__worldX === x &&
        entity.__worldY === y &&
        entity.width === width &&
        entity.height === height
    )
  ) {
    throw new Error(
      `RoyalBox collision ${x},${y},${width},${height} is missing.`
    );
  }
}

const mirrorCoreCollisions =
  collisions.filter(
    entity =>
      entity.__worldX >= 35344 &&
      entity.__worldX < 39200
  );

const expectedMirrorCoreCollisions = [
  [35344, 480, 304, 32],
  [35648, 528, 320, 32],
  [35968, 480, 224, 32],
  [36210, 512, 320, 32],
  [36530, 480, 302, 32],
  [36832, 512, 320, 32],
  [37152, 480, 192, 32],
  [37362, 480, 430, 32],
  [37792, 528, 448, 32],
  [38258, 480, 462, 32],
  [38720, 512, 352, 32],
  [39090, 480, 110, 32],
  [35456, 384, 160, 16],
  [35648, 304, 144, 16],
  [35808, 400, 160, 16],
  [36000, 272, 160, 16],
  [36256, 384, 176, 16],
  [36544, 336, 176, 16],
  [36848, 368, 176, 16],
  [37136, 320, 192, 16],
  [37424, 352, 192, 16],
  [37744, 304, 208, 16],
  [38064, 368, 176, 16],
  [38384, 320, 192, 16],
  [38688, 368, 176, 16],
  [38944, 304, 128, 16],
  [36320, 288, 24, 224],
  [38192, 288, 24, 240],
  [35344, 688, 3856, 32]
];

if (
  mirrorCoreCollisions.length !==
  expectedMirrorCoreCollisions.length
) {
  throw new Error(
    "Expected 29 authored MirrorCore collisions, " +
    `got ${mirrorCoreCollisions.length}.`
  );
}

for (const [x, y, width, height] of
  expectedMirrorCoreCollisions) {
  if (
    !mirrorCoreCollisions.some(
      entity =>
        entity.__worldX === x &&
        entity.__worldY === y &&
        entity.width === width &&
        entity.height === height
    )
  ) {
    throw new Error(
      `MirrorCore collision ${x},${y},${width},${height} is missing.`
    );
  }
}

const conductorApproachCollisions =
  collisions.filter(
    entity =>
      entity.__worldX >= 39200 &&
      entity.__worldX < 44672
  );

const expectedConductorApproachCollisions = [
  [39200, 480, 400, 32],
  [39600, 512, 400, 32],
  [40000, 528, 416, 32],
  [40416, 496, 432, 32],
  [40848, 464, 432, 32],
  [41280, 496, 416, 32],
  [41696, 528, 448, 32],
  [42144, 496, 448, 32],
  [42592, 464, 432, 32],
  [43024, 496, 432, 32],
  [43456, 528, 448, 32],
  [43904, 496, 384, 32],
  [44288, 480, 384, 32],
  [39504, 368, 160, 16],
  [39808, 320, 176, 16],
  [40144, 384, 160, 16],
  [40464, 336, 176, 16],
  [40784, 288, 192, 16],
  [41136, 352, 176, 16],
  [41472, 304, 192, 16],
  [41824, 368, 176, 16],
  [42144, 320, 192, 16],
  [42496, 272, 192, 16],
  [42848, 336, 176, 16],
  [43168, 288, 192, 16],
  [43520, 352, 176, 16],
  [43840, 304, 192, 16],
  [44192, 352, 160, 16],
  [44384, 288, 160, 16],
  [44512, 400, 160, 16],
  [39200, 688, 5472, 32]
];

if (
  conductorApproachCollisions.length !==
  expectedConductorApproachCollisions.length
) {
  throw new Error(
    "Expected 31 authored ConductorApproach collisions, " +
    `got ${conductorApproachCollisions.length}.`
  );
}

for (const [x, y, width, height] of
  expectedConductorApproachCollisions) {
  if (
    !conductorApproachCollisions.some(
      entity =>
        entity.__worldX === x &&
        entity.__worldY === y &&
        entity.width === width &&
        entity.height === height
    )
  ) {
    throw new Error(
      `ConductorApproach collision ${x},${y},${width},${height} is missing.`
    );
  }
}

const mirrorConductorCollisions =
  collisions.filter(
    entity =>
      entity.__worldX >= 44672 &&
      entity.__worldX < 49824
  );

const expectedMirrorConductorCollisions = [
  [44672, 480, 448, 32],
  [45120, 520, 4224, 32],
  [49344, 480, 480, 32],
  [45472, 400, 256, 16],
  [46048, 352, 256, 16],
  [46624, 416, 256, 16],
  [47200, 352, 288, 16],
  [47840, 416, 256, 16],
  [48416, 352, 256, 16],
  [48992, 400, 256, 16],
  [44672, 688, 5152, 32]
];

if (
  mirrorConductorCollisions.length !==
  expectedMirrorConductorCollisions.length
) {
  throw new Error(
    "Expected 11 authored MirrorConductor collisions, " +
    `got ${mirrorConductorCollisions.length}.`
  );
}

for (const [x, y, width, height] of
  expectedMirrorConductorCollisions) {
  if (
    !mirrorConductorCollisions.some(
      entity =>
        entity.__worldX === x &&
        entity.__worldY === y &&
        entity.width === width &&
        entity.height === height
    )
  ) {
    throw new Error(
      `MirrorConductor collision ${x},${y},${width},${height} is missing.`
    );
  }
}

for (const [label, x, y, width, height] of [
  ["MirrorCore exit", 39090, 480, 110, 32],
  ["ConductorApproach exit", 44288, 480, 384, 32],
  ["MirrorConductor entry", 44672, 480, 448, 32],
  ["MirrorConductor world end", 49344, 480, 480, 32]
]) {
  if (
    !collisions.some(
      entity =>
        entity.__worldX === x &&
        entity.__worldY === y &&
        entity.width === width &&
        entity.height === height
    )
  ) {
    throw new Error(
      `${label} collision ${x},${y},${width},${height} is missing.`
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
  "section.lightColor",
  "section.lightSpacing"
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
  "src/world/MirrorCoreSystem.ts",
  "src/world/MirrorConductorSystem.ts",
  "src/world/MirrorConductorVisuals.ts"
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
  "296 collisions, 11 LDtk-driven lighting sections, " +
  "exact MirrorConductor geometry and world end."
);
