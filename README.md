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
- Dash: Shift, K, Gamepad B oder RT
- Fast Fall: S, Pfeil runter, Left Stick runter oder D-Pad runter
- Nahkampfangriff: J oder Gamepad X
- Grand Card: L oder Gamepad Y
- Spotlight: K oder Gamepad RB
- Pause: P oder Gamepad Start/Menu (Escape schließt ein geöffnetes Pausenmenü)

Main Menu, Pause Menu und Claim-Code-Prüfung haben derzeit keine Gamepad-Navigation. Spielername und Claim-Code erfordern Tastatur- beziehungsweise Plattform-Texteingabe.

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
