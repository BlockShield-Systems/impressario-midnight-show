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
  "SupportPickup",
  "GrandCardPickup"
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

const cardPickups = entities.filter(
  entity =>
    entity.__identifier === "GrandCardPickup"
);

if (hazards.length !== 36) {
  fail(
    `Expected 36 hazards, got ${hazards.length}.`
  );
}

if (supports.length !== 10) {
  fail(
    `Expected 10 supports, got ${supports.length}.`
  );
}

if (cardPickups.length !== 7) {
  fail(
    `Expected 7 Grand Card pickups, got ${cardPickups.length}.`
  );
}

const conductorApproachHazards = hazards.filter(
  entity =>
    entity.__worldX >= 39200 &&
    entity.__worldX < 44672
);

const conductorApproachSupports = supports.filter(
  entity =>
    entity.__worldX >= 39200 &&
    entity.__worldX < 44672
);

if (
  conductorApproachHazards.length !== 0 ||
  conductorApproachSupports.length !== 0
) {
  fail(
    "ConductorApproach must remain hazard-free and health-support-free."
  );
}

const mirrorConductorHazards = hazards.filter(
  entity =>
    entity.__worldX >= 44672 &&
    entity.__worldX < 49824
);

const mirrorConductorSupports = supports.filter(
  entity =>
    entity.__worldX >= 44672 &&
    entity.__worldX < 49824
);

const mirrorConductorCardPickups = cardPickups.filter(
  entity =>
    entity.__worldX >= 44672 &&
    entity.__worldX < 49824
);

if (
  mirrorConductorHazards.length !== 0 ||
  mirrorConductorSupports.length !== 0 ||
  mirrorConductorCardPickups.length !== 0
) {
  fail(
    "MirrorConductor must have zero LDtk hazards, supports, and card pickups; " +
    "its inventory and hazards are dedicated dynamic boss mechanics."
  );
}

const ids = [];

for (const entity of [
  ...hazards,
  ...supports,
  ...cardPickups
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

const cardSanctumHazards = new Map(
  hazards
    .filter(entity =>
      fieldMap(entity).get("Group") === "CardSanctum"
    )
    .map(entity => [
      fieldMap(entity).get("Identifier"),
      entity
    ])
);

for (
  const [
    id,
    x,
    y,
    width,
    travelX,
    travelY,
    speed,
    phase
  ] of [
    ["SanctumBladeA", 28496, 440, 16, 96, 0, 1.7, 0],
    [
      "SanctumBladeB",
      29760,
      392,
      16,
      0,
      88,
      1.5,
      Math.PI / 2
    ],
    [
      "SanctumBladeC",
      30288,
      400,
      16,
      112,
      0,
      1.9,
      Math.PI
    ],
    [
      "SanctumBladeD",
      31104,
      368,
      16,
      0,
      80,
      1.65,
      Math.PI / 4
    ],
    ["SanctumSpikeA", 28320, 528, 80, 0, 0, 0, 0],
    ["SanctumSpikeB", 28976, 512, 80, 0, 0, 0, 0],
    ["SanctumSpikeC", 30384, 528, 80, 0, 0, 0, 0],
    ["SanctumSpikeD", 30880, 512, 80, 0, 0, 0, 0]
  ]
) {
  const entity = cardSanctumHazards.get(id);
  const fields = entity ? fieldMap(entity) : null;

  if (
    !entity ||
    !fields ||
    entity.__worldX !== x ||
    entity.__worldY !== y ||
    entity.width !== width ||
    fields.get("TravelX") !== travelX ||
    fields.get("TravelY") !== travelY ||
    fields.get("Speed") !== speed ||
    fields.get("Phase") !== phase
  ) {
    fail(
      `${id} does not match its authored LDtk values.`
    );
  }
}

const royalBoxHazards = new Map(
  hazards
    .filter(entity =>
      fieldMap(entity).get("Group") === "RoyalBox"
    )
    .map(entity => [
      fieldMap(entity).get("Identifier"),
      entity
    ])
);

for (
  const [
    id,
    kind,
    x,
    y,
    width,
    height,
    travelX,
    travelY,
    speed,
    phase
  ] of [
    ["RoyalLaserA", "Laser", 32384, 240, 8, 288, 0, 0, 0, 0],
    ["RoyalSpikeA", "Spike", 32064, 528, 80, 16, 0, 0, 0, 0],
    ["RoyalBladeA", "Blade", 32416, 416, 16, 16, 96, 0, 1.8, 0],
    ["RoyalSpikeB", "Spike", 32544, 512, 80, 16, 0, 0, 0, 0],
    [
      "RoyalBladeB",
      "Blade",
      33248,
      400,
      16,
      16,
      0,
      80,
      1.6,
      Math.PI / 2
    ],
    ["RoyalLaserB", "Laser", 32992, 208, 8, 272, 0, 0, 0, 0.85],
    ["RoyalSpikeC", "Spike", 33504, 528, 80, 16, 0, 0, 0, 0],
    ["RoyalSpikeD", "Spike", 34096, 512, 80, 16, 0, 0, 0, 0],
    [
      "RoyalBladeC",
      "Blade",
      34256,
      400,
      16,
      16,
      96,
      0,
      2.05,
      Math.PI
    ],
    ["RoyalLaserC", "Laser", 33904, 224, 8, 288, 0, 0, 0, 1.55],
    ["RoyalSpikeE", "Spike", 34480, 480, 80, 16, 0, 0, 0, 0],
    [
      "RoyalBladeD",
      "Blade",
      35008,
      400,
      16,
      16,
      0,
      64,
      1.75,
      Math.PI / 4
    ],
    ["RoyalLaserD", "Laser", 34784, 208, 8, 272, 0, 0, 0, 0.35]
  ]
) {
  const entity = royalBoxHazards.get(id);
  const fields = entity ? fieldMap(entity) : null;

  if (
    !entity ||
    !fields ||
    fields.get("Kind") !== kind ||
    entity.__worldX !== x ||
    entity.__worldY !== y ||
    entity.width !== width ||
    entity.height !== height ||
    fields.get("TravelX") !== travelX ||
    fields.get("TravelY") !== travelY ||
    fields.get("Speed") !== speed ||
    fields.get("Phase") !== phase
  ) {
    fail(
      `${id} does not match its authored LDtk values.`
    );
  }
}

const royalBoxSupports = new Map(
  supports
    .filter(entity =>
      fieldMap(entity).get("Group") === "RoyalBox"
    )
    .map(entity => [
      fieldMap(entity).get("Identifier"),
      entity
    ])
);

for (const [id, x, y] of [
  ["RoyalRoseA", 31888, 448],
  ["RoyalRoseB", 32784, 272],
  ["RoyalRoseC", 33792, 320],
  ["RoyalRoseD", 35072, 352]
]) {
  const entity = royalBoxSupports.get(id);

  if (
    !entity ||
    entity.__worldX !== x ||
    entity.__worldY !== y
  ) {
    fail(
      `${id} does not match its authored LDtk values.`
    );
  }
}

const authoredCardPickups = new Map(
  cardPickups.map(entity => [
    fieldMap(entity).get("Identifier"),
    entity
  ])
);

for (const [id, group, x, y] of [
  ["RoyalCardA", "RoyalBox", 31952, 384],
  ["RoyalCardB", "RoyalBox", 34976, 384],
  ["CoreCardA", "MirrorCore", 35504, 384],
  ["CoreCardB", "MirrorCore", 36048, 272],
  ["CoreCardC", "MirrorCore", 36384, 384],
  ["CoreCardD", "MirrorCore", 37184, 320],
  ["ApproachCardA", "ConductorApproach", 44384, 288]
]) {
  const entity = authoredCardPickups.get(id);
  const fields = entity ? fieldMap(entity) : null;

  if (
    !entity ||
    !fields ||
    fields.get("Group") !== group ||
    entity.__worldX !== x ||
    entity.__worldY !== y
  ) {
    fail(
      `${id} does not match its authored LDtk values.`
    );
  }
}

const mirrorCoreHazards = new Map(
  hazards
    .filter(entity =>
      fieldMap(entity).get("Group") === "MirrorCore"
    )
    .map(entity => [
      fieldMap(entity).get("Identifier"),
      entity
    ])
);

for (const [id, x, y, width, height] of [
  ["CoreSpikeA", 36448, 496, 80, 16],
  ["CoreSpikeB", 36688, 464, 80, 16],
  ["CoreSpikeC", 36976, 496, 80, 16],
  ["CoreSpikeD", 37232, 464, 80, 16]
]) {
  const entity = mirrorCoreHazards.get(id);
  const fields = entity ? fieldMap(entity) : null;

  if (
    !entity ||
    !fields ||
    fields.get("Kind") !== "Spike" ||
    entity.__worldX !== x ||
    entity.__worldY !== y ||
    entity.width !== width ||
    entity.height !== height ||
    fields.get("TravelX") !== 0 ||
    fields.get("TravelY") !== 0 ||
    fields.get("Speed") !== 0 ||
    fields.get("Phase") !== 0
  ) {
    fail(
      `${id} does not match its authored LDtk values.`
    );
  }
}

const mirrorCoreSupports = new Map(
  supports
    .filter(entity =>
      fieldMap(entity).get("Group") === "MirrorCore"
    )
    .map(entity => [
      fieldMap(entity).get("Identifier"),
      entity
    ])
);

for (const [id, x, y] of [
  ["CoreRoseA", 35488, 480],
  ["CoreRoseB", 36096, 272],
  ["CoreRoseE", 36592, 336],
  ["CoreRoseF", 36944, 368],
  ["CoreRoseC", 37488, 352],
  ["CoreRoseD", 38976, 304]
]) {
  const entity = mirrorCoreSupports.get(id);

  if (
    !entity ||
    entity.__worldX !== x ||
    entity.__worldY !== y
  ) {
    fail(
      `${id} does not match its authored LDtk values.`
    );
  }
}

for (const entity of [
  ...hazards,
  ...supports,
  ...cardPickups
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

  if (
    group === "ConductorApproach" &&
    (x < 39200 || x >= 44672)
  ) {
    fail(`${id} is outside the ConductorApproach interval.`);
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
    MirrorCore: 6
  },
  "support group"
);

assertCounts(
  countBy(
    cardPickups,
    entity =>
      fieldMap(entity).get("Group")
  ),
  {
    RoyalBox: 2,
    MirrorCore: 4,
    ConductorApproach: 1
  },
  "Grand Card pickup group"
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
      'getWorldSupportPickups("RoyalBox")',
      "getWorldGrandCardPickups"
    ]
  ],
  [
    "src/world/MirrorCoreSystem.ts",
    [
      "getWorldHazards",
      "getWorldSupportPickups",
      "getWorldGrandCardPickups",
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

const mirrorCoreSource = read(
  "src/world/MirrorCoreSystem.ts"
);

for (const token of [
  "public readonly x: number",
  "35720",
  "36080",
  "originX: 35616",
  "originX: 35872",
  "originX: 36064",
  "35680",
  "35888",
  "36096",
  "KALEIDOSCOPE_CENTER_X",
  "isKaleidoscopeBeamDamaging",
  "projectile.x < MIRROR_CORE_START_X",
  "projectile.x >= MIRROR_CORE_END_X",
  "this.player.x >= MIRROR_CORE_START_X",
  "this.player.x < MIRROR_CORE_END_X"
]) {
  if (!mirrorCoreSource.includes(token)) {
    fail(
      `MirrorCoreSystem is missing bounded runtime token ${JSON.stringify(token)}.`
    );
  }
}

const kaleidoscopeTimingSource = read(
  "src/world/KaleidoscopeHazardTiming.ts"
);

for (const token of [
  "KALEIDOSCOPE_CENTER_X = 36768",
  "KALEIDOSCOPE_BEAM_LENGTH = 544",
  "KALEIDOSCOPE_ANGULAR_SPEED = 0.9",
  "KALEIDOSCOPE_OFF_SECONDS = 1.5",
  "KALEIDOSCOPE_TELEGRAPH_SECONDS = 0.65",
  "KALEIDOSCOPE_ACTIVE_SECONDS = 1.85"
]) {
  if (!kaleidoscopeTimingSource.includes(token)) {
    fail(
      `Kaleidoscope timing is missing ${JSON.stringify(token)}.`
    );
  }
}

for (const forbidden of [
  "class MirrorConductor",
  "BossView",
  "leaderboard.finishRun",
  "startFinale",
  "finaleCredits",
  "MIRROR_CORE_START_X - 80",
  "MIRROR_CORE_END_X + 80"
]) {
  if (mirrorCoreSource.includes(forbidden)) {
    fail(
      `MirrorCoreSystem retains forbidden ownership ${JSON.stringify(forbidden)}.`
    );
  }
}

const mirrorConductorSource = read(
  "src/world/MirrorConductorSystem.ts"
);

for (const token of [
  "MIRROR_CONDUCTOR_ARENA_BOUNDS.left",
  "MIRROR_CONDUCTOR_ARENA_BOUNDS.right",
  "this.player.x >= MIRROR_CONDUCTOR_START_X",
  "this.player.x < MIRROR_CONDUCTOR_END_X",
  "projectile.x < ARENA_LEFT",
  "projectile.x > ARENA_RIGHT",
  "projectile.y < 0",
  "projectile.y > 688",
  "if (this.bossStarted)",
  "this.updateProjectiles(deltaSeconds)",
  "this.updateHazards(deltaSeconds)",
  "this.conductor.isDefeated",
  'movement.beamState === "active"',
  "MIRROR_CONDUCTOR_BEAM_REACH",
  "beamOriginX",
  "AUDIO_EVENTS.hazardTelegraph",
  "if (phase === 3)",
  "MirrorConductorFloorHazardState",
  'floor.damagingSide === "left"',
  "this.floorHazard.markDamageApplied()",
  "MIRROR_CONDUCTOR_PHASE_THREE_PROJECTILE_CAP",
  "projectile.spawnDelay",
  "45160",
  "47232",
  "2072",
  '"floor-warning"',
  'id: "ConductorCardLeft"',
  'id: "ConductorCardRight"',
  'id: "ConductorRoseLeft"',
  'id: "ConductorRoseRight"',
  "HEALTH_PICKUP_RESPAWN_SECONDS = 14",
  "private spawnCardPickups()",
  "private clearCardPickups()",
  "private updateCardPickups()",
  "private updateHealthPickups(",
  "this.clearCardPickups()"
]) {
  if (!mirrorConductorSource.includes(token)) {
    fail(
      `MirrorConductorSystem is missing bounded dynamic hazard token ${JSON.stringify(token)}.`
    );
  }
}

const conductorApproachSource = read(
  "src/world/ConductorApproachVisuals.ts"
);

for (const forbidden of [
  "BossProjectile",
  "updateHazards",
  "floor-warning",
  "leaderboard.finishRun",
  "BossView"
]) {
  if (conductorApproachSource.includes(forbidden)) {
    fail(
      `ConductorApproach retains boss hazard ownership ${JSON.stringify(forbidden)}.`
    );
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
  "WORLD_GRAND_CARD_PICKUPS",
  "getWorldHazards",
  "getWorldSupportPickups",
  "getWorldGrandCardPickups"
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
  "36 hazards, 10 supports, 7 Grand Card pickups, " +
  "zero MirrorConductor static inventory, " +
  "bounded dedicated dynamic boss hazards."
);
