import {
  shouldLandOnOneWayPlatform,
  type CollisionRectangle
} from "./OneWayPlatformPolicy.ts";

export interface KinematicBody {
  x: number;
  y: number;
  readonly width: number;
  readonly height: number;
}

export interface CollisionContacts {
  grounded: boolean;
  groundedOneWay: CollisionRectangle | null;
  ceiling: boolean;
  wallLeft: boolean;
  wallRight: boolean;
}

export class KinematicCollisionWorld {
  private collisionChecks = 0;
  private readonly solids: CollisionRectangle[];
  private readonly oneWayPlatforms:
    CollisionRectangle[];

  public constructor(
    solids: CollisionRectangle[],
    oneWayPlatforms: CollisionRectangle[]
  ) {
    this.solids = solids;
    this.oneWayPlatforms = oneWayPlatforms;
  }

  public getDebugSnapshot() {
    return {
      collisionChecks: this.collisionChecks,
      solidCount: this.solids.length,
      oneWayPlatformCount:
        this.oneWayPlatforms.length
    };
  }

  public addSolid(
    solid: CollisionRectangle
  ): void {
    if (!this.solids.includes(solid)) {
      this.solids.push(solid);
    }
  }

  public removeSolid(
    solid: CollisionRectangle
  ): void {
    const index = this.solids.indexOf(solid);

    if (index >= 0) {
      this.solids.splice(index, 1);
    }
  }

  public move(
    body: KinematicBody,
    deltaX: number,
    deltaY: number,
    ignoredOneWay:
      CollisionRectangle | null = null
  ): CollisionContacts {
    const contacts: CollisionContacts = {
      grounded: false,
      groundedOneWay: null,
      ceiling: false,
      wallLeft: false,
      wallRight: false
    };

    this.moveHorizontal(body, deltaX, contacts);
    this.moveVertical(
      body,
      deltaY,
      contacts,
      ignoredOneWay
    );

    return contacts;
  }

  private moveHorizontal(
    body: KinematicBody,
    deltaX: number,
    contacts: CollisionContacts
  ): void {
    if (deltaX === 0) {
      return;
    }

    const previousX = body.x;
    body.x += deltaX;

    for (const solid of this.solids) {
      if (!this.overlaps(body, solid)) {
        continue;
      }

      if (
        deltaX > 0 &&
        previousX + body.width <=
          solid.x + 0.01
      ) {
        body.x = solid.x - body.width;
        contacts.wallRight = true;
      } else if (
        deltaX < 0 &&
        previousX >=
          solid.x + solid.width - 0.01
      ) {
        body.x = solid.x + solid.width;
        contacts.wallLeft = true;
      }
    }
  }

  private moveVertical(
    body: KinematicBody,
    deltaY: number,
    contacts: CollisionContacts,
    ignoredOneWay:
      CollisionRectangle | null
  ): void {
    if (deltaY === 0) {
      return;
    }

    const previousY = body.y;
    body.y += deltaY;

    for (const solid of this.solids) {
      if (!this.overlaps(body, solid)) {
        continue;
      }

      if (
        deltaY > 0 &&
        previousY + body.height <=
          solid.y + 0.01
      ) {
        body.y = solid.y - body.height;
        contacts.grounded = true;
      } else if (
        deltaY < 0 &&
        previousY >=
          solid.y + solid.height - 0.01
      ) {
        body.y = solid.y + solid.height;
        contacts.ceiling = true;
      }
    }

    if (contacts.grounded) {
      return;
    }

    for (const platform of
      this.oneWayPlatforms) {
      this.collisionChecks += 1;

      if (
        !shouldLandOnOneWayPlatform(
          body,
          previousY,
          deltaY,
          platform,
          ignoredOneWay
        )
      ) {
        continue;
      }

      body.y = platform.y - body.height;
      contacts.grounded = true;
      contacts.groundedOneWay = platform;
      return;
    }
  }

  private overlaps(
    body: KinematicBody,
    solid: CollisionRectangle
  ): boolean {
    this.collisionChecks += 1;

    return (
      body.x < solid.x + solid.width &&
      body.x + body.width > solid.x &&
      body.y < solid.y + solid.height &&
      body.y + body.height > solid.y
    );
  }
}
