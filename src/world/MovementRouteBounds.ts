import {
  WORLD_SECTIONS
} from "./WorldLayout";

const MOVEMENT_REHEARSAL =
  WORLD_SECTIONS.find(
    section =>
      section.id === "MovementRehearsal"
  ) ?? (() => {
    throw new Error(
      "Generated world is missing MovementRehearsal"
    );
  })();

export const MOVEMENT_ROUTE_CAMERA_HEIGHT = 360;
export const MOVEMENT_ROUTE_FALL_OUT_Y = 430;

export function isInMovementRehearsal(
  playerX: number
): boolean {
  return playerX >=
      MOVEMENT_REHEARSAL.startX &&
    playerX < MOVEMENT_REHEARSAL.endX;
}

export function isBelowMovementRoute(
  playerX: number,
  playerY: number
): boolean {
  return isInMovementRehearsal(playerX) &&
    playerY > MOVEMENT_ROUTE_FALL_OUT_Y;
}
