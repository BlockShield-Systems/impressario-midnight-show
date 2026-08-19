# Milestone 8-D — LDtk Gameplay Anchors

M8-D moves stable progression coordinates into LDtk.

## LDtk entities

Checkpoint contains:

- Identifier
- DisplayName
- TriggerX
- entity position as respawn position

GameplayGate contains:

- Identifier
- entity rectangle as collision bounds

## Generated runtime

The command `npm run levels:sync` generates
`src/world/WorldGameplay.ts`.

The generated runtime exports typed checkpoint and gate identifiers,
WORLD_CHECKPOINTS, WORLD_GATES, getWorldCheckpoint() and getWorldGate().

## Runtime consumers

- src/main.ts
- src/player/PlayerHealthSystem.ts
- src/world/MirrorCoreSystem.ts

## Scope

Enemy spawns, hazards, moving platforms, visual markers, audio transitions
and boss choreography remain system-owned. They require separate schemas.

The audio transition at X 17840 remains independent from the
MirrorConductor section boundary at X 17863 because it is an intentional
audio lead-in.

## Validation

Run the following commands:

    npm run levels:validate
    npm run typecheck
    npm run build
