# M8-C — LDtk Visual Metadata and Coordinate Hardening

## Purpose

M8-C removes duplicated visual-section configuration from the Phaser
renderer and makes LDtk authoritative for section texture and lighting
metadata.

The world remains 18720 × 720 with 141 collision rectangles and
11 contiguous sections.

## LDtk section fields

Every Section entity now defines:

- Identifier
- TextureFrame
- LightColor
- LightSpacing

TextureFrame selects the base frame from
impressario-environment.png.

LightColor is a six-digit hexadecimal color.

LightSpacing controls the maximum horizontal spacing between authored
section lights.

## Runtime generation

Run npm run levels:sync.

This reads assets/levels/impressario-world.ldtk and generates
src/world/WorldLayout.ts.

The generated runtime contains collision rectangles, section bounds,
texture frames, light colors and light spacing.

Do not edit WorldLayout.ts manually.

## Validation

Run npm run levels:validate, npm run typecheck and npm run build.

The validator rejects stale generated layout data, missing sections,
invalid visual metadata, unexpected collision counts, legacy 17280
combat-camera bounds, duplicated renderer metadata and the obsolete
failing Node import.

The broken Playwright audio E2E test is not part of this validation.

## Camera-bound fix

CombatSystem previously restored the camera to a hard-coded world width
of 17280 after an encounter. The world is now 18720 pixels wide, so the
camera could be prevented from reaching the expanded boss approach.

CombatSystem now restores generated WORLD_WIDTH and WORLD_HEIGHT bounds.
