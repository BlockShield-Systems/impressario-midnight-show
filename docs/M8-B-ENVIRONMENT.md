# M8-B Environment and world expansion

## World dimensions

The world was expanded from 17280 to 18720 pixels.

A new 1440-pixel `ConductorApproach` section now separates the Mirror
Core gauntlet from the Mirror Conductor arena.

The boss arena itself was shifted as one unit. Boss logic, collision
geometry, camera bounds and audio-zone thresholds remain aligned.

## Environment tileset

The deterministic source generator is:

`scripts/generate-environment-tiles.py`

It produces:

- `public/assets/world/impressario-environment.png`
- `assets/source/world/environment-tileset.json`

The tileset contains 64 tiles at 32x32 pixels and is also registered in
the LDtk project.

## Runtime rendering

`EnvironmentTileRenderer` adds:

- one low-cost parallax texture layer;
- one biome-specific material layer per section;
- upper and lower architectural trim;
- additive section lighting;
- no per-frame texture generation.

Static tile sprites are created once during scene initialization.

## Build

The normal production build performs:

1. LDtk runtime validation;
2. TypeScript type checking;
3. Vite production bundling.

It does not run the audio validator or Playwright audio test.
