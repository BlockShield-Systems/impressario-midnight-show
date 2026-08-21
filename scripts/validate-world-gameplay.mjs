import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const read = file =>
  fs.readFileSync(
    path.join(root, file),
    "utf8"
  );

const project = JSON.parse(
  read(
    "assets/levels/impressario-world.ldtk"
  )
);

const level =
  project.levels.find(
    value =>
      value.identifier ===
      "ImpressarioWorld"
  );

const layer =
  level?.layerInstances?.find(
    value =>
      value.__identifier ===
      "Entities"
  );

if (!level || !layer) {
  throw new Error(
    "ImpressarioWorld Entities layer is missing."
  );
}

const checkpoints =
  layer.entityInstances.filter(
    value =>
      value.__identifier ===
      "Checkpoint"
  );

const gates =
  layer.entityInstances.filter(
    value =>
      value.__identifier ===
      "GameplayGate"
  );

const fieldValue = (
  entity,
  identifier
) => entity.fieldInstances.find(
  field => field.__identifier === identifier
)?.__value;

const assertEntity = (
  entities,
  identifier,
  x,
  y,
  width,
  height
) => {
  const entity = entities.find(
    candidate =>
      fieldValue(candidate, "Identifier") === identifier
  );

  if (
    !entity ||
    entity.__worldX !== x ||
    entity.__worldY !== y ||
    entity.width !== width ||
    entity.height !== height
  ) {
    throw new Error(
      `${identifier} does not match its authored LDtk bounds.`
    );
  }
};

if (
  checkpoints.length !== 15 ||
  gates.length !== 19
) {
  throw new Error(
    "Expected 15 checkpoints and 19 gates; " +
    `got ${checkpoints.length} and ${
      gates.length
    }.`
  );
}

assertEntity(
  checkpoints,
  "MainStage",
  10528,
  296,
  16,
  16
);
assertEntity(
  checkpoints,
  "MainStageClear",
  13552,
  296,
  16,
  16
);
assertEntity(
  checkpoints,
  "GrandGallery",
  13824,
  296,
  16,
  16
);
assertEntity(
  checkpoints,
  "GalleryGauntlet",
  19488,
  450,
  16,
  16
);
assertEntity(
  checkpoints,
  "GauntletMidpoint",
  20512,
  450,
  16,
  16
);
assertEntity(
  checkpoints,
  "SpotlightVault",
  23600,
  322,
  16,
  16
);
assertEntity(
  checkpoints,
  "CardSanctum",
  28032,
  450,
  16,
  16
);
assertEntity(
  checkpoints,
  "RoyalBox",
  31744,
  450,
  16,
  16
);
assertEntity(
  checkpoints,
  "MirrorCore",
  35424,
  450,
  16,
  16
);
assertEntity(
  checkpoints,
  "MirrorRelays",
  36128,
  450,
  16,
  16
);
assertEntity(
  checkpoints,
  "CoreChamber",
  37424,
  450,
  16,
  16
);
assertEntity(
  checkpoints,
  "MirrorConductor",
  44752,
  450,
  16,
  16
);
assertEntity(gates, "MainStageLeft", 10704, 0, 18, 326);
assertEntity(gates, "MainStageWave", 12096, 0, 18, 326);
assertEntity(gates, "MainStageExit", 13472, 0, 18, 326);
assertEntity(gates, "GalleryGauntletLeft", 19904, 0, 18, 688);
assertEntity(gates, "GalleryGauntletMid", 20416, 0, 18, 688);
assertEntity(gates, "GalleryGauntletSecondLeft", 21088, 0, 18, 688);
assertEntity(gates, "GalleryGauntletExit", 22480, 0, 18, 688);
assertEntity(gates, "SpotlightVaultLeft", 24000, 0, 18, 688);
assertEntity(gates, "SpotlightVaultRight", 25856, 0, 18, 688);
assertEntity(gates, "CardSanctumExit", 31584, 0, 18, 688);
assertEntity(gates, "RoyalBoxExit", 35264, 0, 18, 688);
assertEntity(gates, "MirrorRelay", 36192, 0, 18, 688);
assertEntity(gates, "MirrorBoss", 37344, 0, 18, 688);
assertEntity(gates, "MirrorExit", 39072, 0, 18, 688);
assertEntity(
  gates,
  "MirrorConductorEntrance",
  45120,
  0,
  18,
  688
);
assertEntity(
  gates,
  "MirrorConductorResolution",
  49344,
  0,
  18,
  688
);

for (const [identifier, triggerX] of [
  ["MirrorCore", 35392],
  ["MirrorRelays", 36112],
  ["CoreChamber", 37376],
  ["MirrorConductor", 44704]
]) {
  const checkpoint = checkpoints.find(
    candidate =>
      fieldValue(candidate, "Identifier") === identifier
  );

  if (
    !checkpoint ||
    fieldValue(checkpoint, "TriggerX") !== triggerX
  ) {
    throw new Error(
      `${identifier} does not match its authored trigger.`
    );
  }
}

const conductorApproachCheckpoints =
  checkpoints.filter(
    checkpoint =>
      checkpoint.__worldX >= 39200 &&
      checkpoint.__worldX < 44672
  );

const conductorApproachGates =
  gates.filter(
    gate =>
      gate.__worldX < 44672 &&
      gate.__worldX + gate.width > 39200
  );

if (
  conductorApproachCheckpoints.length !== 0 ||
  conductorApproachGates.length !== 0
) {
  throw new Error(
    "ConductorApproach must remain a checkpoint-free and gate-free traversal."
  );
}

const main =
  read("src/main.ts");

const mainStage =
  read(
    "src/world/MainStageEncounterSystem.ts"
  );

const spotlightVault =
  read(
    "src/world/SpotlightVaultEncounterSystem.ts"
  );

const cardSanctum =
  read(
    "src/world/CardSanctumEncounterSystem.ts"
  );

const royalBox =
  read(
    "src/world/RoyalBoxEncounterSystem.ts"
  );

const health =
  read(
    "src/player/PlayerHealthSystem.ts"
  );

const mirror =
  read(
    "src/world/MirrorCoreSystem.ts"
  );

const mirrorConductor =
  read(
    "src/world/MirrorConductorSystem.ts"
  );

const mirrorConductorVisuals =
  read(
    "src/world/MirrorConductorVisuals.ts"
  );

const runtime =
  read(
    "src/world/WorldGameplay.ts"
  );

for (const required of [
  "WORLD_CHECKPOINTS",
  "WORLD_GATES",
  "getWorldCheckpoint",
  "getWorldGate"
]) {
  if (!runtime.includes(required)) {
    throw new Error(
      `Generated runtime is missing ${required}.`
    );
  }
}

const legacyCheckpoint =
  /setCheckpoint\(\s*\d+\s*,\s*\d+\s*,/;

if (
  legacyCheckpoint.test(main) ||
  legacyCheckpoint.test(mirror) ||
  legacyCheckpoint.test(mirrorConductor)
) {
  throw new Error(
    "Legacy numeric setCheckpoint call remains."
  );
}

for (const required of [
  'createWorldGate("CombatTutorialExit")',
  'createWorldGate("CombatArenaLeft")',
  'createWorldGate("CombatArenaRight")'
]) {
  if (!main.includes(required)) {
    throw new Error(
      `main.ts is missing ${required}.`
    );
  }
}

for (const required of [
  'createGate("MainStageLeft")',
  'createGate("MainStageWave")',
  'createGate("MainStageExit")'
]) {
  if (!mainStage.includes(required)) {
    throw new Error(
      `MainStageEncounterSystem.ts is missing ${required}.`
    );
  }
}

for (const required of [
  'createGate("SpotlightVaultLeft")',
  'createGate("SpotlightVaultRight")'
]) {
  if (!spotlightVault.includes(required)) {
    throw new Error(
      `SpotlightVaultEncounterSystem.ts is missing ${required}.`
    );
  }
}

for (const required of [
  'createGate("CardSanctumExit")'
]) {
  if (!cardSanctum.includes(required)) {
    throw new Error(
      `CardSanctumEncounterSystem.ts is missing ${required}.`
    );
  }
}

for (const required of [
  'createGate("RoyalBoxExit")'
]) {
  if (!royalBox.includes(required)) {
    throw new Error(
      `RoyalBoxEncounterSystem.ts is missing ${required}.`
    );
  }
}

for (const required of [
  'createWorldGate("MirrorRelay")',
  'createWorldGate("MirrorBoss")',
  'createWorldGate("MirrorExit")',
  'getWorldCheckpoint("MirrorCore")',
  'getWorldCheckpoint("MirrorRelays")',
  'getWorldCheckpoint("CoreChamber")',
  "MIRROR_CORE_START_X",
  "MIRROR_CORE_END_X"
]) {
  if (!mirror.includes(required)) {
    throw new Error(
      `MirrorCoreSystem is missing ${required}.`
    );
  }
}

for (const forbidden of [
  "class MirrorConductor",
  "BossView",
  "leaderboard.finishRun",
  "startFinale",
  "finaleCredits",
  "THE MIRROR CONDUCTOR"
]) {
  if (mirror.includes(forbidden)) {
    throw new Error(
      `MirrorCoreSystem retains later-Section ownership: ${forbidden}.`
    );
  }
}

if (
  !main.includes('import { MirrorCoreVisuals }') ||
  !main.includes("new MirrorCoreVisuals(this)")
) {
  throw new Error(
    "main.ts does not construct MirrorCoreVisuals."
  );
}

if (
  !main.includes('import { ConductorApproachVisuals }') ||
  !main.includes("new ConductorApproachVisuals(this)")
) {
  throw new Error(
    "main.ts does not construct ConductorApproachVisuals."
  );
}

for (const required of [
  'import { MirrorConductorSystem }',
  'import { MirrorConductorVisuals }',
  "new MirrorConductorVisuals(this)",
  "new MirrorConductorSystem(",
  "this.mirrorConductorSystem.update(",
  "this.mirrorConductorSystem?.resetAfterDeath()"
]) {
  if (!main.includes(required)) {
    throw new Error(
      `main.ts is missing MirrorConductor integration ${required}.`
    );
  }
}

for (const required of [
  "export const MIRROR_CONDUCTOR_START_X = 44672",
  "export const MIRROR_CONDUCTOR_END_X = 49824",
  'createWorldGate(\n    "MirrorConductorEntrance"',
  'createWorldGate(\n    "MirrorConductorResolution"',
  'getWorldCheckpoint(\n        "MirrorConductor"',
  "private health = 108",
  "if (this.health <= 72)",
  "if (this.health <= 36)",
  "1: 55",
  "2: 60",
  "3: 70",
  "public receiveRangedHit(",
  "this.magicSystem.castsPerformed",
  "combatSystem.registerTarget(this.conductor)",
  "this.player.x >= 45312",
  "this.player.x < MIRROR_CONDUCTOR_END_X",
  "this.playerHealth.fallOut()",
  "ARENA_RIGHT - ARENA_LEFT",
  "WORLD_WIDTH",
  "WORLD_HEIGHT",
  "private finaleSubmitted = false",
  "if (!this.finaleSubmitted)",
  "!this.conductor.isDefeated"
]) {
  if (!mirrorConductor.includes(required)) {
    throw new Error(
      `MirrorConductorSystem is missing ${JSON.stringify(required)}.`
    );
  }
}

for (const required of [
  "const START_X = 44672",
  "const END_X = 49824",
  "[45472, 400, 256]",
  "[46048, 352, 256]",
  "[46624, 416, 256]",
  "[47200, 352, 288]",
  "[47840, 416, 256]",
  "[48416, 352, 256]",
  "[48992, 400, 256]"
]) {
  if (!mirrorConductorVisuals.includes(required)) {
    throw new Error(
      `MirrorConductorVisuals is missing ${JSON.stringify(required)}.`
    );
  }
}

const sourceCallCount = (
  read("src/world/MirrorConductorSystem.ts").match(
    /leaderboard\.finishRun\(\)/g
  ) ?? []
).length;

const earlierCallCount = [
  main,
  mirror,
  read("src/world/ConductorApproachVisuals.ts")
].reduce(
  (count, source) =>
    count +
    (source.match(/leaderboard\.finishRun\(\)/g) ?? []).length,
  0
);

if (
  sourceCallCount !== 1 ||
  earlierCallCount !== 0
) {
  throw new Error(
    "Expected exactly one leaderboard.finishRun() call in MirrorConductorSystem."
  );
}

const conductorApproach = read(
  "src/world/ConductorApproachVisuals.ts"
);

for (const forbidden of [
  "BossView",
  "leaderboard.finishRun",
  "startFinale",
  "finaleCredits",
  "class MirrorConductor"
]) {
  if (conductorApproach.includes(forbidden)) {
    throw new Error(
      `ConductorApproach retains later-Section ownership: ${forbidden}.`
    );
  }
}

if (
  !health.includes(
    "checkpoint: WorldCheckpoint"
  ) ||
  !health.includes(
    'getWorldCheckpoint(\n      "InitialSpawn"'
  )
) {
  throw new Error(
    "PlayerHealthSystem does not use generated checkpoints."
  );
}

console.log(
  "World gameplay runtime valid: " +
  "15 LDtk checkpoints, 19 LDtk gates, " +
  "dedicated defeat-gated MirrorConductor finale."
);
