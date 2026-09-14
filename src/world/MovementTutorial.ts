export const MOVEMENT_ENVIRONMENT_FOREGROUND_DEPTH = 8;
export const MOVEMENT_TUTORIAL_MARKER_DEPTH = 9;
export const MOVEMENT_TUTORIAL_SIGNAGE_DEPTH = 10;

export interface TutorialRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const OPENING_TUTORIAL_TITLE = {
  x: 34,
  y: 42,
  width: 226,
  height: 29
} as const satisfies TutorialRectangle;

export const OPENING_TUTORIAL_SUBTITLE = {
  x: 34,
  y: 78,
  width: 210,
  height: 23
} as const satisfies TutorialRectangle;

export const OPENING_CONTROL_PANEL = {
  x: 280,
  y: 108,
  width: 256,
  height: 96
} as const satisfies TutorialRectangle;

export const INITIAL_PLAYER_ROUTE = {
  x: 64,
  y: 258,
  width: 536,
  height: 68
} as const satisfies TutorialRectangle;

export const MOVEMENT_TUTORIAL_SIGNS = [
  {
    x: 690,
    y: 238,
    width: 56,
    height: 36,
    title: "JUMP",
    hint: "SPACE"
  },
  {
    x: 1270,
    y: 242,
    width: 78,
    height: 38,
    title: "DOUBLE",
    hint: "SPACE ×2"
  },
  {
    x: 1900,
    y: 238,
    width: 88,
    height: 36,
    title: "WALL",
    hint: "HOLD + JUMP"
  },
  {
    x: 2550,
    y: 238,
    width: 64,
    height: 36,
    title: "DASH",
    hint: "SHIFT"
  },
  {
    x: 4320,
    y: 238,
    width: 112,
    height: 36,
    title: "FINALE",
    hint: "CHAIN THE MOVES"
  }
] as const;

export const MOVEMENT_SECTION_LABELS = [
  {
    x: 680,
    y: 88,
    width: 72,
    height: 30,
    text: "WALL-JUMP\nSHAFT",
    align: "center"
  },
  {
    x: 930,
    y: 249,
    width: 66,
    height: 16,
    text: "AIR-DASH",
    align: "left"
  },
  {
    x: 1530,
    y: 80,
    width: 116,
    height: 16,
    text: "FAST-FALL TUNNEL",
    align: "left"
  },
  {
    x: 2070,
    y: 132,
    width: 84,
    height: 30,
    text: "TO COMBAT\nREHEARSAL →",
    align: "center"
  }
] as const;

export const OPENING_CONTROL_INSTRUCTIONS = [
  "CONTROL CUES",
  "A / D · ARROWS   MOVE",
  "SPACE            JUMP / DOUBLE JUMP",
  "SHIFT            DASH",
  "S / DOWN         FAST FALL",
  "J                CANE ATTACK",
  "GAMEPAD          STICK · A · RT / B"
] as const;

export function rectanglesOverlap(
  first: TutorialRectangle,
  second: TutorialRectangle
): boolean {
  return first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;
}
