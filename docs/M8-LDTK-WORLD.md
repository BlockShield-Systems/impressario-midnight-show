# M8 LDtk world pipeline

## Authoritative source

`assets/levels/impressario-world.ldtk` is the authoritative source for
static collision geometry and world-section bounds.

Do not edit `src/world/WorldLayout.ts` manually. It is generated.

## Workflow

1. Open `assets/levels/impressario-world.ldtk` in LDtk 1.5.3.
2. Edit `CollisionRect` entities.
3. Preserve contiguous `Section` entities.
4. Run:

   ```bash
   npm run levels:sync
   npm run levels:validate
   npm run typecheck
   npx vite build
   ```

## Current sections

- MovementRehearsal
- CombatRehearsal
- MainStage
- GrandGallery
- GalleryGauntlet
- SpotlightVault
- CardSanctum
- RoyalBox
- MirrorCore
- MirrorConductor

## Boss pacing

The three Mirror Conductor music tracks are approximately 90 seconds
each. Runtime minimum phase windows are:

- Phase 1: 55 seconds
- Phase 2: 60 seconds
- Phase 3: 70 seconds

Damage is still registered during a minimum window, but health cannot
cross the next phase boundary until that window expires. This prevents
an entire score from being skipped by high burst damage.

Music transitions are edge-triggered only by the two transition
animations, not by recurring idle/cast animation tags.

## Scope

M8-A migrates collision ownership without moving existing gameplay
coordinates. This keeps enemy, hazard, checkpoint and audio mappings
compatible.

Environment tilesets, texture layers, lighting entities and physical
section expansion are the next M8 package.
