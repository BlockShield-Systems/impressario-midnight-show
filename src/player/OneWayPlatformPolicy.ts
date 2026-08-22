export interface CollisionRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CollisionBody {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const LANDING_EPSILON = 0.01;

export function shouldLandOnOneWayPlatform(
  body: CollisionBody,
  previousY: number,
  deltaY: number,
  platform: CollisionRectangle,
  ignoredPlatform: CollisionRectangle | null
): boolean {
  if (
    deltaY <= 0 ||
    platform === ignoredPlatform
  ) {
    return false;
  }

  const previousBottom =
    previousY + body.height;
  const currentBottom =
    body.y + body.height;
  const platformRight =
    platform.x + platform.width;
  const platformBottom =
    platform.y + platform.height;

  return (
    body.x < platformRight &&
    body.x + body.width > platform.x &&
    previousBottom <=
      platform.y + LANDING_EPSILON &&
    currentBottom > platform.y &&
    body.y < platformBottom
  );
}

export function shouldStartOneWayDrop(
  downHeld: boolean,
  jumpPressed: boolean,
  groundedPlatform: CollisionRectangle | null
): groundedPlatform is CollisionRectangle {
  return Boolean(
    downHeld &&
    jumpPressed &&
    groundedPlatform
  );
}

export function hasClearedDroppedPlatform(
  body: CollisionBody,
  platform: CollisionRectangle
): boolean {
  const horizontallySeparated =
    body.x + body.width <= platform.x ||
    body.x >= platform.x + platform.width;

  return horizontallySeparated ||
    body.y >= platform.y + platform.height;
}
