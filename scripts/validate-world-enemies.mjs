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
  Stagehand: 7,
  CardThrower: 4,
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

if (spawns.length !== 26) {
  throw new Error(
    `Expected 26 enemy spawns, got ${
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
    id.startsWith("MainStage") &&
    (
      x < 10464 ||
      x >= 13744 ||
      left < 10464 ||
      right > 13744
    )
  ) {
    throw new Error(
      `${id} is outside the MainStage interval.`
    );
  }

  if (
    group === "ShadowAcrobat" &&
    (
      x < 19456 ||
      x >= 23552 ||
      left < 19456 ||
      right > 23552
    )
  ) {
    throw new Error(
      `${id} is outside the GalleryGauntlet interval.`
    );
  }

  if (
    group === "LightWraith" &&
    (
      x < 23552 ||
      x >= 27984 ||
      left < 23552 ||
      right > 27984
    )
  ) {
    throw new Error(
      `${id} is outside the SpotlightVault interval.`
    );
  }

  if (
    group === "CardSentry" &&
    (
      x < 27984 ||
      x >= 31664 ||
      left < 27984 ||
      right > 31664
    )
  ) {
    throw new Error(
      `${id} is outside the CardSanctum interval.`
    );
  }

  if (
    group === "RoyalEcho" &&
    (
      x < 31664 ||
      x >= 35344 ||
      left < 31664 ||
      right > 35344
    )
  ) {
    throw new Error(
      `${id} is outside the RoyalBox interval.`
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
    (
      x < 35344 ||
      x >= 39200 ||
      left < 35344 ||
      right > 39200
    )
  ) {
    throw new Error(
      `${id} is outside the MirrorCore interval.`
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

for (const id of [
  "GalleryShadowAcrobatA",
  "GalleryShadowAcrobatB"
]) {
  if (!ids.has(id)) {
    throw new Error(
      `GalleryGauntlet enemy ${id} is missing.`
    );
  }
}

for (
  const [id, x, y, left, right, phase] of [
    [
      "VaultLightWraithA",
      24448,
      280,
      24128,
      24912,
      0
    ],
    [
      "VaultLightWraithB",
      25312,
      256,
      24944,
      25792,
      Math.PI
    ]
  ]
) {
  const entity = spawns.find(
    candidate =>
      fieldValue(candidate, "Identifier") === id
  );

  if (
    !entity ||
    entity.px?.[0] !== x ||
    entity.px?.[1] !== y ||
    fieldValue(entity, "PatrolLeft") !== left ||
    fieldValue(entity, "PatrolRight") !== right ||
    fieldValue(entity, "Phase") !== phase
  ) {
    throw new Error(
      `SpotlightVault enemy ${id} does not match its authored LDtk values.`
    );
  }
}

for (
  const [id, x, y, phase] of [
    ["SanctumCardSentryA", 28624, 288, 0],
    [
      "SanctumCardSentryB",
      29952,
      300,
      Math.PI
    ],
    [
      "SanctumCardSentryC",
      31008,
      272,
      Math.PI / 2
    ]
  ]
) {
  const entity = spawns.find(
    candidate =>
      fieldValue(candidate, "Identifier") === id
  );

  if (
    !entity ||
    entity.px?.[0] !== x ||
    entity.px?.[1] !== y ||
    fieldValue(entity, "PatrolLeft") !== x ||
    fieldValue(entity, "PatrolRight") !== x ||
    fieldValue(entity, "Phase") !== phase
  ) {
    throw new Error(
      `CardSanctum enemy ${id} does not match its authored LDtk values.`
    );
  }
}

for (
  const [id, kind, x, y, left, right, phase] of [
    [
      "RoyalEchoDuelistA",
      "duelist",
      32112,
      496,
      32032,
      32384,
      0
    ],
    [
      "RoyalEchoCasterA",
      "caster",
      32608,
      304,
      32496,
      32736,
      Math.PI / 2
    ],
    [
      "RoyalEchoDuelistB",
      "duelist",
      33024,
      448,
      32928,
      33312,
      Math.PI
    ],
    [
      "RoyalEchoCasterB",
      "caster",
      34144,
      256,
      34032,
      34320,
      Math.PI * 1.5
    ]
  ]
) {
  const entity = spawns.find(
    candidate =>
      fieldValue(candidate, "Identifier") === id
  );

  if (
    !entity ||
    fieldValue(entity, "Kind") !== kind ||
    entity.px?.[0] !== x ||
    entity.px?.[1] !== y ||
    fieldValue(entity, "PatrolLeft") !== left ||
    fieldValue(entity, "PatrolRight") !== right ||
    fieldValue(entity, "Phase") !== phase
  ) {
    throw new Error(
      `RoyalBox enemy ${id} does not match its authored LDtk values.`
    );
  }
}

for (
  const [id, kind, x, y, left, right, phase] of [
    [
      "MirrorCoreDuelist",
      "duelist",
      36384,
      482,
      36256,
      36528,
      0
    ],
    [
      "MirrorCoreCasterA",
      "caster",
      36688,
      270,
      36560,
      36816,
      Math.PI / 2
    ],
    [
      "MirrorCoreMime",
      "mime",
      36928,
      482,
      36864,
      37120,
      Math.PI
    ],
    [
      "MirrorCoreCasterB",
      "caster",
      37184,
      250,
      37136,
      37328,
      Math.PI * 1.5
    ]
  ]
) {
  const entity = spawns.find(
    candidate =>
      fieldValue(candidate, "Identifier") === id
  );

  if (
    !entity ||
    fieldValue(entity, "Kind") !== kind ||
    entity.px?.[0] !== x ||
    entity.px?.[1] !== y ||
    fieldValue(entity, "PatrolLeft") !== left ||
    fieldValue(entity, "PatrolRight") !== right ||
    fieldValue(entity, "Phase") !== phase
  ) {
    throw new Error(
      `MirrorCore enemy ${id} does not match its authored LDtk values.`
    );
  }
}

const mainStageIds = [
  "MainStageStagehandA",
  "MainStageStagehandB",
  "MainStageCardThrowerA",
  "MainStageStagehandC",
  "MainStageCardThrowerB",
  "MainStageStagehandD"
];

for (const id of mainStageIds) {
  if (!ids.has(id)) {
    throw new Error(
      `MainStage enemy ${id} is missing.`
    );
  }
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
  "26 spawns, 7 consumers."
);
