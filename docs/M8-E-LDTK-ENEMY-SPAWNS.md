# Milestone 8-E — LDtk Enemy Spawns

Enemy spawn positions, patrol bounds, kinds and phases are authored as
native `EnemySpawn` entities in the LDtk `Entities` layer.

The generator `scripts/sync-ldtk-enemies.mjs` creates
`src/world/WorldEnemies.ts`.

Migrated runtime consumers:

- StagehandSystem
- CardThrowerSystem
- ShadowAcrobatSystem
- LightWraithSystem
- CardSentrySystem
- RoyalEchoSystem
- MirrorCoreSystem

Spawn totals:

- Stagehand: 3
- CardThrower: 2
- ShadowAcrobat: 2
- LightWraith: 2
- CardSentry: 3
- RoyalEcho: 4
- MirrorCore: 4
- Total: 20

Hazards, relays, roses, moving platforms and the boss position remain
outside M8-E.
