import Phaser from "phaser";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";

interface BladeDefinition {
  readonly originX: number;
  readonly originY: number;
  readonly travelX: number;
  readonly travelY: number;
  readonly speed: number;
  readonly phase: number;
}

interface SpikeDefinition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

const BLADES: readonly BladeDefinition[] = [
  {
    originX: 9950,
    originY: 390,
    travelX: 90,
    travelY: 0,
    speed: 1.7,
    phase: 0
  },
  {
    originX: 10460,
    originY: 275,
    travelX: 0,
    travelY: 105,
    speed: 1.5,
    phase: Math.PI * 0.5
  },
  {
    originX: 11120,
    originY: 245,
    travelX: 110,
    travelY: 0,
    speed: 1.9,
    phase: Math.PI
  },
  {
    originX: 11590,
    originY: 395,
    travelX: 0,
    travelY: 95,
    speed: 1.65,
    phase: Math.PI * 0.25
  }
];

const SPIKES: readonly SpikeDefinition[] = [
  {
    x: 9850,
    y: 520,
    width: 70
  },
  {
    x: 10160,
    y: 520,
    width: 75
  },
  {
    x: 10840,
    y: 326,
    width: 65
  },
  {
    x: 11390,
    y: 520,
    width: 78
  }
];

export class CardSanctumHazardSystem {
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
    this.graphics.setDepth(28);
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
    // Falling below the world remains fatal after the encounter
    // hazards have been disabled.
    if (this.player.y > 675) {
      this.playerHealth.fallOut();
      return;
    }

    if (!this.enabled) {
      return;
    }

    this.elapsed += deltaSeconds;

    this.checkSpikes();
    this.checkBlades();
    this.redraw();
  }

  private checkSpikes(): void {
    const playerBounds =
      this.getPlayerBounds();

    for (const spike of SPIKES) {
      const bounds =
        new Phaser.Geom.Rectangle(
          spike.x,
          spike.y - 14,
          spike.width,
          16
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
          220,
          -185
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

      const closestX = Phaser.Math.Clamp(
        position.x,
        playerBounds.left,
        playerBounds.right
      );

      const closestY = Phaser.Math.Clamp(
        position.y,
        playerBounds.top,
        playerBounds.bottom
      );

      const deltaX =
        position.x - closestX;

      const deltaY =
        position.y - closestY;

      if (
        deltaX * deltaX +
        deltaY * deltaY <=
        17 * 17
      ) {
        this.playerHealth.receiveDamage(
          1,
          position.x,
          245,
          -170
        );
      }
    }
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
            ? 0xd83a68
            : 0xe4b74d,
          1
        );

        g.fillTriangle(
          x,
          spike.y,
          x + width * 0.5,
          spike.y - 14,
          x + width,
          spike.y
        );
      }
    }

    for (const blade of BLADES) {
      const position =
        this.getBladePosition(blade);

      g.fillStyle(
        0x101426,
        1
      );

      g.fillCircle(
        position.x,
        position.y,
        17
      );

      g.lineStyle(
        3,
        0xe6bc50,
        1
      );

      g.strokeCircle(
        position.x,
        position.y,
        17
      );

      for (
        let index = 0;
        index < 6;
        index += 1
      ) {
        const angle =
          this.elapsed * 7 +
          index / 6 *
          Math.PI * 2;

        const innerX =
          position.x +
          Math.cos(angle) * 11;

        const innerY =
          position.y +
          Math.sin(angle) * 11;

        const outerX =
          position.x +
          Math.cos(angle) * 27;

        const outerY =
          position.y +
          Math.sin(angle) * 27;

        g.lineStyle(
          4,
          index % 2 === 0
            ? 0xd83c6b
            : 0x72e2eb,
          1
        );

        g.lineBetween(
          innerX,
          innerY,
          outerX,
          outerY
        );
      }
    }
  }
}
