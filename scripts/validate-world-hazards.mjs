import fs from "node:fs";

const read = path =>
  fs.readFileSync(path, "utf8");

const fail = message => {
  throw new Error(message);
};

const fieldMap = entity =>
  new Map(
    (entity.fieldInstances ?? []).map(
      field => [
        field.__identifier,
        field.__value
      ]
    )
  );

const countBy = (values, selector) => {
  const result = new Map();

  for (const value of values) {
    const key = selector(value);
    result.set(
      key,
      (result.get(key) ?? 0) + 1
    );
  }

  return result;
};

const assertCounts = (
  actual,
  expected,
  label
) => {
  for (
    const [key, wanted] of
    Object.entries(expected)
  ) {
    const found = actual.get(key) ?? 0;

    if (found !== wanted) {
      fail(
        `Expected ${wanted} ${label} ${key}, got ${found}.`
      );
    }
  }

  const actualTotal =
    [...actual.values()].reduce(
      (sum, value) => sum + value,
      0
    );

  const expectedTotal =
    Object.values(expected).reduce(
      (sum, value) => sum + value,
      0
    );

  if (actualTotal !== expectedTotal) {
    fail(
      `Unexpected ${label} values: expected ${expectedTotal}, got ${actualTotal}.`
    );
  }
};

const ldtk = JSON.parse(
  read("assets/levels/impressario-world.ldtk")
);

if (ldtk.jsonVersion !== "1.5.3") {
  fail(
    `Expected LDtk 1.5.3, got ${ldtk.jsonVersion}.`
  );
}

const definitions =
  ldtk.defs?.entities ?? [];

for (const identifier of [
  "HazardAnchor",
  "SupportPickup"
]) {
  const matches = definitions.filter(
    definition =>
      definition.identifier === identifier
  );

  if (matches.length !== 1) {
    fail(
      `Expected one ${identifier} definition, got ${matches.length}.`
    );
  }
}

const entities =
  (ldtk.levels ?? []).flatMap(
    level =>
      (level.layerInstances ?? []).flatMap(
        layer =>
          layer.entityInstances ?? []
      )
  );

const hazards = entities.filter(
  entity =>
    entity.__identifier === "HazardAnchor"
);

const supports = entities.filter(
  entity =>
    entity.__identifier === "SupportPickup"
);

if (hazards.length !== 36) {
  fail(
    `Expected 36 hazards, got ${hazards.length}.`
  );
}

if (supports.length !== 8) {
  fail(
    `Expected 8 supports, got ${supports.length}.`
  );
}

const ids = [];

for (const entity of [
  ...hazards,
  ...supports
]) {
  const fields = fieldMap(entity);
  const id = fields.get("Identifier");
  const group = fields.get("Group");
  const x = Number(entity.px?.[0]);
  const y = Number(entity.px?.[1]);

  if (
    typeof id !== "string" ||
    id.length === 0
  ) {
    fail(
      `${entity.__identifier} has an invalid Identifier.`
    );
  }

  if (
    typeof group !== "string" ||
    group.length === 0
  ) {
    fail(`${id} has an invalid Group.`);
  }

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    fail(`${id} has invalid coordinates.`);
  }

  ids.push(id);
}

if (new Set(ids).size !== ids.length) {
  fail("Hazard/support identifiers are not unique.");
}

const mainStageHazards = new Map(
  hazards
    .filter(entity =>
      fieldMap(entity).get("Group") === "MainStage"
    )
    .map(entity => [
      fieldMap(entity).get("Identifier"),
      entity
    ])
);

for (const [id, x, y, width] of [
  ["MainStageRiggingA", 11616, 48, 16],
  ["MainStageFootlightsA", 12144, 326, 80],
  ["MainStageRiggingB", 12736, 42, 16],
  ["MainStageFootlightsB", 13040, 326, 88]
]) {
  const entity = mainStageHazards.get(id);

  if (
    !entity ||
    entity.__worldX !== x ||
    entity.__worldY !== y ||
    entity.width !== width
  ) {
    fail(
      `${id} does not match its authored LDtk bounds.`
    );
  }
}

for (const entity of [
  ...hazards,
  ...supports
]) {
  const fields = fieldMap(entity);
  const id = fields.get("Identifier");
  const group = fields.get("Group");
  const x = entity.__worldX;

  if (
    group === "MainStage" &&
    (x < 10464 || x >= 13744)
  ) {
    fail(`${id} is outside the MainStage interval.`);
  }

  if (
    group === "Gallery" &&
    (x < 19456 || x >= 23552)
  ) {
    fail(`${id} is outside the GalleryGauntlet interval.`);
  }

  if (
    group === "CardSanctum" &&
    (x < 27984 || x >= 31664)
  ) {
    fail(`${id} is outside the CardSanctum interval.`);
  }

  if (
    group === "RoyalBox" &&
    (x < 31664 || x >= 35344)
  ) {
    fail(`${id} is outside the RoyalBox interval.`);
  }

  if (
    group === "MirrorCore" &&
    (x < 35344 || x >= 39200)
  ) {
    fail(`${id} is outside the MirrorCore interval.`);
  }
}

assertCounts(
  countBy(
    hazards,
    entity =>
      fieldMap(entity).get("Kind")
  ),
  {
    Spike: 20,
    Pendulum: 4,
    Blade: 8,
    Laser: 4
  },
  "hazard kind"
);

assertCounts(
  countBy(
    hazards,
    entity =>
      fieldMap(entity).get("Group")
  ),
  {
    CombatRehearsal: 3,
    MainStage: 4,
    Gallery: 4,
    CardSanctum: 8,
    RoyalBox: 13,
    MirrorCore: 4
  },
  "hazard group"
);

assertCounts(
  countBy(
    supports,
    entity =>
      fieldMap(entity).get("Group")
  ),
  {
    RoyalBox: 4,
    MirrorCore: 4
  },
  "support group"
);

const consumers = [
  [
    "src/world/CombatRehearsalHazardSystem.ts",
    [
      "getWorldHazards",
      '"CombatRehearsal"',
      '"Spike"'
    ]
  ],
  [
    "src/world/MainStageHazardSystem.ts",
    [
      "getWorldHazards",
      '"MainStage"',
      '"Pendulum"',
      '"Spike"'
    ]
  ],
  [
    "src/world/GalleryHazardSystem.ts",
    [
      "getWorldHazards",
      '"Gallery"',
      '"Pendulum"',
      '"Spike"'
    ]
  ],
  [
    "src/world/CardSanctumHazardSystem.ts",
    [
      "getWorldHazards",
      '"CardSanctum"',
      '"Blade"',
      '"Spike"'
    ]
  ],
  [
    "src/world/RoyalBoxHazardSystem.ts",
    [
      "getWorldHazards",
      '"RoyalBox"',
      '"Blade"',
      '"Laser"',
      '"Spike"'
    ]
  ],
  [
    "src/world/RoyalBoxSupportSystem.ts",
    [
      'getWorldSupportPickups("RoyalBox")'
    ]
  ],
  [
    "src/world/MirrorCoreSystem.ts",
    [
      "getWorldHazards",
      "getWorldSupportPickups",
      '"MirrorCore"',
      '"Spike"'
    ]
  ]
];

for (const [file, tokens] of consumers) {
  const source = read(file);

  for (const token of tokens) {
    if (!source.includes(token)) {
      fail(
        `${file} is missing ${JSON.stringify(token)}.`
      );
    }
  }
}

const legacyData = [
  [
    "src/world/GalleryHazardSystem.ts",
    "x: 6915,"
  ],
  [
    "src/world/CardSanctumHazardSystem.ts",
    "originX: 9950,"
  ],
  [
    "src/world/RoyalBoxHazardSystem.ts",
    "x: 12270,"
  ],
  [
    "src/world/RoyalBoxSupportSystem.ts",
    "{ x: 12135, y: 298 }"
  ],
  [
    "src/world/MirrorCoreSystem.ts",
    "[14530, 294]"
  ]
];

for (const [file, token] of legacyData) {
  if (read(file).includes(token)) {
    fail(
      `${file} still contains legacy data ${JSON.stringify(token)}.`
    );
  }
}

const runtime = read(
  "src/world/WorldHazards.ts"
);

for (const token of [
  "WORLD_HAZARDS",
  "WORLD_SUPPORT_PICKUPS",
  "getWorldHazards",
  "getWorldSupportPickups"
]) {
  if (!runtime.includes(token)) {
    fail(
      `WorldHazards runtime is missing ${token}.`
    );
  }
}

const pkg = JSON.parse(
  read("package.json")
);

for (const name of [
  "levels:sync",
  "levels:validate",
  "world:validate"
]) {
  if (
    !pkg.scripts?.[name]?.includes(
      "hazards"
    )
  ) {
    fail(
      `${name} lacks hazard integration.`
    );
  }
}

console.log(
  "LDtk hazard runtime valid: " +
  "36 hazards, 8 supports, " +
  "6 hazard consumers, " +
  "2 support consumers."
);
