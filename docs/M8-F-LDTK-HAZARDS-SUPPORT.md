# Milestone 8-F: LDtk hazards and support pickups

Milestone 8-F moves hazard and healing-rose placement from
hard-coded TypeScript data into native LDtk entities.

## Source and runtime

Authoritative source:

- assets/levels/impressario-world.ldtk

Entity types:

- HazardAnchor
- SupportPickup

Generator and generated runtime:

- scripts/sync-ldtk-hazards.mjs
- src/world/WorldHazards.ts

Runtime exports:

- WORLD_HAZARDS
- WORLD_SUPPORT_PICKUPS
- getWorldHazards(group, kind)
- getWorldSupportPickups(group)

Generated runtime files must not be edited manually.

## Inventory

Hazards:

- Spike: 15
- Pendulum: 2
- Blade: 8
- Laser: 4
- Total: 29

Hazard groups:

- Gallery: 4
- CardSanctum: 8
- RoyalBox: 13
- MirrorCore: 4

Support pickups:

- RoyalBox: 4
- MirrorCore: 4
- Total: 8

## Migrated consumers

Hazards:

- src/world/GalleryHazardSystem.ts
- src/world/CardSanctumHazardSystem.ts
- src/world/RoyalBoxHazardSystem.ts
- src/world/MirrorCoreSystem.ts

Supports:

- src/world/RoyalBoxSupportSystem.ts
- src/world/MirrorCoreSystem.ts

## Runtime ownership

LDtk owns placement and static configuration.

TypeScript continues to own activation, movement, collision,
damage, knockback, laser timing, reset behavior, healing,
rendering, boss mechanics and finale effects.

## Validation commands

- npm run levels:sync
- npm run levels:validate
- npm run world:validate
- npm run typecheck

Hazard validator:

- scripts/validate-world-hazards.mjs
