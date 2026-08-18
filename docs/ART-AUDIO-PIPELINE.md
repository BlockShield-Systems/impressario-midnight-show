# IMPRESSARIO – M7A Asset Pipeline

## Spieler-Masterdatei

Pfad:

    assets/source/characters/impressario/impressario.aseprite

Eigenschaften:

    Canvas:       128 x 128 px
    Farbmodus:    RGBA
    Hintergrund:  transparent
    Facing:       rechts
    Fußpunkt:     X 64 / Y 98

Pflicht-Tags:

- idle
- run
- jump_start
- rise
- fall

Mindestanzahl der Frames:

- idle: 4
- run: 6
- jump_start: 2
- rise: 2
- fall: 2

Player-Atlas exportieren:

    npm run assets:player

Erzeugte Dateien:

    public/assets/atlases/impressario.png
    public/assets/atlases/impressario.json

Atlas separat validieren:

    npm run assets:player:validate

## Audio

Masterformat:

    WAV
    48 kHz
    24 Bit

Quellordner:

    assets/source/audio/music
    assets/source/audio/ambience
    assets/source/audio/sfx/player
    assets/source/audio/sfx/enemies
    assets/source/audio/sfx/magic
    assets/source/audio/ui

Audio exportieren:

    npm run assets:audio

Runtime-Ausgaben:

    public/assets/audio/ogg
    public/assets/audio/mp3

## Toolchain prüfen

    npm run assets:check

## Komplette Asset-Pipeline

Sobald die Aseprite-Masterdatei existiert:

    npm run assets:build

## Technische Grenzen

Die Asset-Pipeline verändert nicht:

- PlayerController
- 18 x 30 Physics Body
- Fixed Timestep
- Kollisionssystem
- Combat-Hitboxen
- Checkpoints
- Leaderboard
- Finale
