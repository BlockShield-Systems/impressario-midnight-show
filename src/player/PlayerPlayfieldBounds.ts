export interface VerticallyMovingPlayer {
  y: number;
  velocityY: number;
}

export function resolvePlayerTopBoundary(
  player: VerticallyMovingPlayer,
  minimumY = 0
): boolean {
  if (player.y >= minimumY) {
    return false;
  }

  player.y = minimumY;

  if (player.velocityY < 0) {
    player.velocityY = 0;
  }

  return true;
}
