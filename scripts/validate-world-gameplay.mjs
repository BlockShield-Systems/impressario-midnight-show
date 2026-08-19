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

if (
  checkpoints.length !== 11 ||
  gates.length !== 9
) {
  throw new Error(
    "Expected 11 checkpoints and 9 gates; " +
    `got ${checkpoints.length} and ${
      gates.length
    }.`
  );
}

const main =
  read("src/main.ts");

const health =
  read(
    "src/player/PlayerHealthSystem.ts"
  );

const mirror =
  read(
    "src/world/MirrorCoreSystem.ts"
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
  legacyCheckpoint.test(mirror)
) {
  throw new Error(
    "Legacy numeric setCheckpoint call remains."
  );
}

for (const required of [
  'createWorldGate("MainStageLeft")',
  'createWorldGate("MainStageRight")',
  'createWorldGate("SpotlightVaultLeft")',
  'createWorldGate("SpotlightVaultRight")',
  'createWorldGate("CardSanctumExit")',
  'createWorldGate("RoyalBoxExit")'
]) {
  if (!main.includes(required)) {
    throw new Error(
      `main.ts is missing ${required}.`
    );
  }
}

for (const required of [
  'createWorldGate("MirrorRelay")',
  'createWorldGate("MirrorBoss")',
  'createWorldGate("MirrorExit")'
]) {
  if (!mirror.includes(required)) {
    throw new Error(
      `MirrorCoreSystem is missing ${required}.`
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
  "11 LDtk checkpoints, 9 LDtk gates, " +
  "typed checkpoint API."
);
