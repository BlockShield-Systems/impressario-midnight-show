export const MOVEMENT_ENVIRONMENT_FOREGROUND_DEPTH = 8;
export const MOVEMENT_TUTORIAL_MARKER_DEPTH = 9;
export const MOVEMENT_TUTORIAL_SIGNAGE_DEPTH = 10;

export const MOVEMENT_TUTORIAL_SIGNS = [
  {
    x: 110,
    title: "MOVE",
    hint: "A / D"
  },
  {
    x: 690,
    title: "JUMP",
    hint: "SPACE"
  },
  {
    x: 1270,
    title: "DOUBLE",
    hint: "SPACE ×2"
  },
  {
    x: 1900,
    title: "WALL",
    hint: "HOLD + JUMP"
  },
  {
    x: 2550,
    title: "DASH",
    hint: "SHIFT"
  },
  {
    x: 4420,
    title: "FINALE",
    hint: "CHAIN THE MOVES"
  }
] as const;

export const OPENING_CONTROL_INSTRUCTIONS = [
  "MOVEMENT REHEARSAL",
  "",
  "A / D or arrows   Move",
  "Space             Jump / Double Jump",
  "Shift             Dash",
  "J                 Cane Attack",
  "S or down         Fast Fall",
  "",
  "Gamepad: Left Stick / A / RT or B"
] as const;
