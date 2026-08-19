import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const project = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "assets/levels/impressario-world.ldtk"
    ),
    "utf8"
  )
);

const expected = {
  Stagehand: 3,
  CardThrower: 2,
  ShadowAcrobat: 2,
  LightWraith: 2,
  CardSentry: 3,
  RoyalEcho: 4,
  MirrorCore: 4
};

const consumers = {
  Stagehand:
    "src/enemies/StagehandSystem.ts",
  CardThrower:
    "src/enemies/CardThrowerSystem.ts",
  ShadowAcrobat:
    "src/enemies/ShadowAcrobatSystem.ts",
  LightWraith:
    "src/enemies/LightWraithSystem.ts",
  CardSentry:
    "src/enemies/CardSentrySystem.ts",
  RoyalEcho:
    "src/enemies/RoyalEchoSystem.ts",
  MirrorCore:
    "src/world/MirrorCoreSystem.ts"
};

if (project.jsonVersion !== "1.5.3") {
  throw new Error(
    `Unexpected LDtk version ${
      project.jsonVersion
    }.`
  );
}

const definition =
  project.defs?.entities?.find(
    value =>
      value.identifier === "EnemySpawn"
  );

if (!definition) {
  throw new Error(
    "EnemySpawn definition is missing."
  );
}

const expectedFields = [
  "Identifier",
  "Group",
  "Kind",
  "PatrolLeft",
  "PatrolRight",
  "Phase"
];

const fields =
  definition.fieldDefs?.map(
    value => value.identifier
  ) ?? [];

if (
  fields.length !== expectedFields.length ||
  expectedFields.some(
    value => !fields.includes(value)
  )
) {
  throw new Error(
    `Invalid EnemySpawn fields: ${
      fields.join(", ")
    }.`
  );
}

const level = project.levels?.find(
  value =>
    value.identifier ===
    "ImpressarioWorld"
);

const layer = level?.layerInstances?.find(
  value =>
    value.__identifier === "Entities"
);

if (!level || !layer) {
  throw new Error(
    "ImpressarioWorld Entities layer is missing."
  );
}

const fieldValue = (
  entity,
  identifier
) => {
  const field =
    entity.fieldInstances.find(
      value =>
        value.__identifier === identifier
    );

  if (!field) {
    throw new Error(
      `EnemySpawn missing ${identifier}.`
    );
  }

  return field.__value;
};

const spawns =
  layer.entityInstances.filter(
    entity =>
      entity.__identifier ===
      "EnemySpawn"
  );

if (spawns.length !== 20) {
  throw new Error(
    `Expected 20 enemy spawns, got ${
      spawns.length
    }.`
  );
}

const ids = new Set();
const counts = new Map();

for (const entity of spawns) {
  const id = String(
    fieldValue(entity, "Identifier")
  );

  const group = String(
    fieldValue(entity, "Group")
  );

  const kind = String(
    fieldValue(entity, "Kind")
  );

  const x = Number(entity.px?.[0]);
  const y = Number(entity.px?.[1]);

  const left = Number(
    fieldValue(entity, "PatrolLeft")
  );

  const right = Number(
    fieldValue(entity, "PatrolRight")
  );

  const phase = Number(
    fieldValue(entity, "Phase")
  );

  if (!id || ids.has(id)) {
    throw new Error(
      `Invalid or duplicate enemy ID ${id}.`
    );
  }

  ids.add(id);

  if (!(group in expected)) {
    throw new Error(
      `Unknown enemy group ${group}.`
    );
  }

  if (
    ![x, y, left, right, phase].every(
      Number.isFinite
    )
  ) {
    throw new Error(
      `${id} contains invalid numbers.`
    );
  }

  if (
    x < 0 ||
    x > level.pxWid ||
    y < 0 ||
    y > level.pxHei
  ) {
    throw new Error(
      `${id} is outside the world.`
    );
  }

  if (left > x || right < x) {
    throw new Error(
      `${id} is outside patrol bounds.`
    );
  }

  if (
    group === "RoyalEcho" &&
    !["duelist", "caster"].includes(kind)
  ) {
    throw new Error(
      `${id} has invalid RoyalEcho kind.`
    );
  }

  if (
    group === "MirrorCore" &&
    ![
      "duelist",
      "caster",
      "mime"
    ].includes(kind)
  ) {
    throw new Error(
      `${id} has invalid MirrorCore kind.`
    );
  }

  counts.set(
    group,
    (counts.get(group) ?? 0) + 1
  );
}

for (
  const [group, expectedCount] of
  Object.entries(expected)
) {
  const actual =
    counts.get(group) ?? 0;

  if (actual !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} ${group}, got ${actual}.`
    );
  }

  const consumer =
    consumers[group];

  const source = fs.readFileSync(
    path.join(root, consumer),
    "utf8"
  );

  if (
    !source.includes(
      `getWorldEnemySpawns("${group}")`
    )
  ) {
    throw new Error(
      `${consumer} does not consume ${group}.`
    );
  }
}

const runtime = fs.readFileSync(
  path.join(
    root,
    "src/world/WorldEnemies.ts"
  ),
  "utf8"
);

if (
  !runtime.includes(
    "WORLD_ENEMY_SPAWNS"
  ) ||
  !runtime.includes(
    "getWorldEnemySpawns"
  )
) {
  throw new Error(
    "Generated enemy runtime is incomplete."
  );
}

console.log(
  "LDtk enemy runtime valid: " +
  "20 spawns, 7 consumers."
);
