export const MOVEMENT_ENVIRONMENT_FOREGROUND_DEPTH = 8;
export const MOVEMENT_TUTORIAL_MARKER_DEPTH = 9;
export const MOVEMENT_TUTORIAL_SIGNAGE_DEPTH = 10;

export interface TutorialRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type TutorialDirection =
  | "up"
  | "down"
  | "right";

export interface MovementTutorialSign extends TutorialRectangle {
  readonly id:
    | "jump"
    | "double-jump"
    | "drop-through"
    | "wall-jump"
    | "dash"
    | "finale";
  readonly title: string;
  readonly hint: string;
  readonly direction: TutorialDirection;
  readonly markerX: number;
  readonly markerY: number;
  readonly requiredMechanics: readonly string[];
  readonly route: TutorialRectangle;
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
  height: 112
} as const satisfies TutorialRectangle;

export const INITIAL_PLAYER_ROUTE = {
  x: 64,
  y: 258,
  width: 536,
  height: 68
} as const satisfies TutorialRectangle;

export const MOVEMENT_TUTORIAL_SIGNS: readonly MovementTutorialSign[] = [
  {
    id: "jump",
    x: 670,
    y: 92,
    width: 64,
    height: 36,
    title: "JUMP",
    hint: "SPACE · ↑",
    direction: "up",
    markerX: 700,
    markerY: 190,
    requiredMechanics: ["jump"],
    route: {
      x: 720,
      y: 174,
      width: 168,
      height: 152
    }
  },
  {
    id: "double-jump",
    x: 900,
    y: 84,
    width: 108,
    height: 38,
    title: "DOUBLE JUMP",
    hint: "SPACE ×2 · ↑",
    direction: "up",
    markerX: 924,
    markerY: 192,
    requiredMechanics: ["jump", "double-jump"],
    route: {
      x: 944,
      y: 160,
      width: 168,
      height: 166
    }
  },
  {
    id: "drop-through",
    x: 1180,
    y: 84,
    width: 112,
    height: 38,
    title: "DROP THROUGH",
    hint: "DOWN + SPACE",
    direction: "down",
    markerX: 1320,
    markerY: 190,
    requiredMechanics: ["one-way-drop"],
    route: {
      x: 1136,
      y: 170,
      width: 168,
      height: 156
    }
  },
  {
    id: "wall-jump",
    x: 1912,
    y: 76,
    width: 112,
    height: 38,
    title: "WALL JUMP",
    hint: "HOLD WALL + JUMP",
    direction: "right",
    markerX: 2050,
    markerY: 142,
    requiredMechanics: ["wall-contact", "wall-jump"],
    route: {
      x: 1792,
      y: 118,
      width: 248,
      height: 300
    }
  },
  {
    id: "dash",
    x: 2780,
    y: 86,
    width: 82,
    height: 38,
    title: "AIR DASH",
    hint: "JUMP + SHIFT →",
    direction: "right",
    markerX: 2874,
    markerY: 196,
    requiredMechanics: ["jump", "dash"],
    route: {
      x: 2928,
      y: 152,
      width: 912,
      height: 208
    }
  },
  {
    id: "finale",
    x: 4064,
    y: 48,
    width: 122,
    height: 40,
    title: "FINALE",
    hint: "DOUBLE · WALL · DASH",
    direction: "right",
    markerX: 4130,
    markerY: 148,
    requiredMechanics: [
      "double-jump",
      "wall-jump",
      "dash"
    ],
    route: {
      x: 4160,
      y: 92,
      width: 984,
      height: 234
    }
  }
] as const;

export const MOVEMENT_DECORATIVE_COLUMNS =
  Array.from(
    { length: 9 },
    (_, index) => ({
      x: index * 640 - 8,
      y: 30,
      width: 42,
      height: 242,
      collision: "none" as const
    })
  );

export const MOVEMENT_SECTION_LABELS = [
  {
    x: 930,
    y: 272,
    width: 108,
    height: 16,
    text: "CYAN = ONE-WAY",
    align: "left"
  },
  {
    x: 5320,
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
  "SPACE / W        JUMP / DOUBLE JUMP",
  "SHIFT            DASH",
  "S / DOWN         FAST FALL",
  "DOWN + JUMP      DROP ONE-WAY",
  "J                CANE ATTACK",
  "GAMEPAD          STICK · A · RT / B"
] as const;

export function tutorialSignBounds(
  sign: MovementTutorialSign
): TutorialRectangle {
  return {
    x: sign.x - sign.width / 2,
    y: sign.y,
    width: sign.width,
    height: sign.height
  };
}

export function tutorialMarkerBounds(
  sign: MovementTutorialSign
): TutorialRectangle {
  if (sign.direction === "up") {
    return {
      x: sign.markerX - 5,
      y: sign.markerY - 7,
      width: 10,
      height: 23
    };
  }

  if (sign.direction === "down") {
    return {
      x: sign.markerX - 5,
      y: sign.markerY,
      width: 10,
      height: 23
    };
  }

  return {
    x: sign.markerX,
    y: sign.markerY - 5,
    width: 25,
    height: 10
  };
}

export function rectanglesOverlap(
  first: TutorialRectangle,
  second: TutorialRectangle
): boolean {
  return first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;
}
