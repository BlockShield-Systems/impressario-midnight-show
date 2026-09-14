# Impressario – The Midnight Show

Movement-Greybox für den Contest-Build.

## Voraussetzungen

- Node.js >= 22.12
- npm

## Development

Befehle:

    npm install
    npm run dev

Browser:

    http://localhost:5173

## Production-Build

Befehle:

    npm run build
    npm run preview

## Steuerung

- Bewegung: A/D, Pfeiltasten oder Left Stick
- Sprung/Double Jump: Space, W oder Gamepad A
- Dash: Shift, K, Gamepad RT oder B
- Fast Fall: S, Pfeil runter oder Stick runter
- Pause: P (Escape schließt ein geöffnetes Pausenmenü)

## Aktueller Umfang

- kinematischer AABB-Controller
- Fixed Timestep mit 120 Hz
- variable Sprunghöhe
- Coyote Time
- Jump Buffer
- Double Jump
- Ground-/Air-Dash
- Fast Fall
- Wall Slide
- Wall Jump
- Tastatur- und Gamepad-Input
- Kamera und Movement-Testlevel
- generierte Greybox-Grafik
