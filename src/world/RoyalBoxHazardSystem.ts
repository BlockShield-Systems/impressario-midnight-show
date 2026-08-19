import Phaser from "phaser";
import { getWorldHazards } from "./WorldHazards";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";

interface SpikeDefinition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

interface BladeDefinition {
  readonly originX: number;
  readonly originY: number;
  readonly travelX: number;
  readonly travelY: number;
  readonly speed: number;
  readonly phase: number;
}

interface LaserDefinition {
  readonly x: number;
  readonly top: number;
  readonly bottom: number;
  readonly phase: number;
}

const SPIKES: readonly SpikeDefinition[] =
  getWorldHazards(
    "RoyalBox",
    "Spike"
  ).map(
    hazard => ({
      x: hazard.x,
      y: hazard.y,
      width: hazard.width
    })
  );

const BLADES: readonly BladeDefinition[] =
  getWorldHazards(
    "RoyalBox",
    "Blade"
  ).map(
    hazard => ({
      originX: hazard.x,
      originY: hazard.y,
      travelX: hazard.travelX,
      travelY: hazard.travelY,
      speed: hazard.speed,
      phase: hazard.phase
    })
  );

const LASERS: readonly LaserDefinition[] =
  getWorldHazards(
    "RoyalBox",
    "Laser"
  ).map(
    hazard => ({
      x: hazard.x,
      top: hazard.y,
      bottom:
        hazard.y + hazard.height,
      phase: hazard.phase
    })
  );

export class RoyalBoxHazardSystem {
  private enabled = false;
  private elapsed = 0;

  private readonly graphics:
    Phaser.GameObjects.Graphics;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem
  ) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(30);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      this.graphics.clear();
    }
  }

  public reset(): void {
    this.enabled = false;
    this.elapsed = 0;
    this.graphics.clear();
  }

  public update(deltaSeconds: number): void {
    if (!this.enabled) {
      return;
    }

    this.elapsed += deltaSeconds;

    if (this.player.y > 675) {
      this.playerHealth.fallOut();
      return;
    }

    this.checkSpikes();
    this.checkBlades();
    this.checkLasers();
    this.redraw();
  }

  private checkSpikes(): void {
    const playerBounds =
      this.getPlayerBounds();

    for (const spike of SPIKES) {
      const bounds =
        new Phaser.Geom.Rectangle(
          spike.x,
          spike.y - 15,
          spike.width,
          17
        );

      if (
        Phaser.Geom.Intersects.RectangleToRectangle(
          playerBounds,
          bounds
        )
      ) {
        this.playerHealth.receiveDamage(
          1,
          spike.x + spike.width * 0.5,
          235,
          -190
        );
      }
    }
  }

  private checkBlades(): void {
    const playerBounds =
      this.getPlayerBounds();

    for (const blade of BLADES) {
      const position =
        this.getBladePosition(blade);

      if (
        this.circleIntersectsRectangle(
          position.x,
          position.y,
          17,
          playerBounds
        )
      ) {
        this.playerHealth.receiveDamage(
          1,
          position.x,
          255,
          -175
        );
      }
    }
  }

  private checkLasers(): void {
    const playerBounds =
      this.getPlayerBounds();

    for (const laser of LASERS) {
      if (!this.isLaserActive(laser)) {
        continue;
      }

      const bounds =
        new Phaser.Geom.Rectangle(
          laser.x - 4,
          laser.top,
          8,
          laser.bottom - laser.top
        );

      if (
        Phaser.Geom.Intersects.RectangleToRectangle(
          playerBounds,
          bounds
        )
      ) {
        this.playerHealth.receiveDamage(
          1,
          laser.x,
          270,
          -165
        );
      }
    }
  }

  private isLaserActive(
    laser: LaserDefinition
  ): boolean {
    const cycle =
      (this.elapsed + laser.phase) %
      2.4;

    return (
      cycle >= 0.7 &&
      cycle < 1.45
    );
  }

  private isLaserTelegraphing(
    laser: LaserDefinition
  ): boolean {
    const cycle =
      (this.elapsed + laser.phase) %
      2.4;

    return cycle >= 0.35 && cycle < 0.7;
  }

  private getBladePosition(
    blade: BladeDefinition
  ): Phaser.Math.Vector2 {
    const movement =
      Math.sin(
        this.elapsed * blade.speed +
        blade.phase
      );

    return new Phaser.Math.Vector2(
      blade.originX +
        movement * blade.travelX,
      blade.originY +
        movement * blade.travelY
    );
  }

  private getPlayerBounds():
    Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.player.x,
      this.player.y,
      this.player.width,
      this.player.height
    );
  }

  private circleIntersectsRectangle(
    centerX: number,
    centerY: number,
    radius: number,
    rectangle: Phaser.Geom.Rectangle
  ): boolean {
    const closestX = Phaser.Math.Clamp(
      centerX,
      rectangle.left,
      rectangle.right
    );

    const closestY = Phaser.Math.Clamp(
      centerY,
      rectangle.top,
      rectangle.bottom
    );

    const deltaX = centerX - closestX;
    const deltaY = centerY - closestY;

    return (
      deltaX * deltaX +
      deltaY * deltaY <=
      radius * radius
    );
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();

    for (const spike of SPIKES) {
      const count = Math.max(
        1,
        Math.floor(spike.width / 12)
      );

      const width =
        spike.width / count;

      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        const x =
          spike.x +
          index * width;

        g.fillStyle(
          index % 2 === 0
            ? 0xe95ac5
            : 0x73e6ee,
          1
        );

        g.fillTriangle(
          x,
          spike.y,
          x + width * 0.5,
          spike.y - 15,
          x + width,
          spike.y
        );
      }
    }

    for (const blade of BLADES) {
      const position =
        this.getBladePosition(blade);

      g.fillStyle(0x090b17, 1);
      g.fillCircle(
        position.x,
        position.y,
        17
      );

      g.lineStyle(3, 0xed69cf, 1);
      g.strokeCircle(
        position.x,
        position.y,
        17
      );

      for (
        let index = 0;
        index < 7;
        index += 1
      ) {
        const angle =
          this.elapsed * 7.5 +
          index / 7 *
          Math.PI * 2;

        g.lineStyle(
          4,
          index % 2 === 0
            ? 0x78e7ef
            : 0xeac65b,
          1
        );

        g.lineBetween(
          position.x +
            Math.cos(angle) * 11,
          position.y +
            Math.sin(angle) * 11,
          position.x +
            Math.cos(angle) * 28,
          position.y +
            Math.sin(angle) * 28
        );
      }
    }

    for (const laser of LASERS) {
      const active =
        this.isLaserActive(laser);

      const telegraphing =
        this.isLaserTelegraphing(laser);

      g.fillStyle(0x0a0c18, 1);

      g.fillCircle(
        laser.x,
        laser.top,
        7
      );

      g.fillCircle(
        laser.x,
        laser.bottom,
        7
      );

      g.lineStyle(
        active ? 5 : 2,
        active
          ? 0xf35bc9
          : telegraphing
            ? 0xe8c35a
            : 0x31526a,
        active
          ? 0.95
          : telegraphing
            ? 0.75
            : 0.28
      );

      g.lineBetween(
        laser.x,
        laser.top,
        laser.x,
        laser.bottom
      );

      if (active) {
        g.lineStyle(
          1,
          0xffffff,
          0.9
        );

        g.lineBetween(
          laser.x - 2,
          laser.top,
          laser.x - 2,
          laser.bottom
        );
      }
    }
  }
}
