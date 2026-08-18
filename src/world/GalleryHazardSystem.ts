import Phaser from "phaser";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";

interface PendulumDefinition {
  readonly x: number;
  readonly anchorY: number;
  readonly length: number;
  readonly phase: number;
}

interface SpikeDefinition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

const PENDULUMS: readonly PendulumDefinition[] = [
  {
    x: 6625,
    anchorY: 86,
    length: 165,
    phase: 0
  },
  {
    x: 7875,
    anchorY: 82,
    length: 175,
    phase: Math.PI
  }
];

const SPIKES: readonly SpikeDefinition[] = [
  {
    x: 6915,
    y: 430,
    width: 62
  },
  {
    x: 7625,
    y: 326,
    width: 58
  }
];

export class GalleryHazardSystem {
  private enabled = false;
  private elapsed = 0;

  private readonly graphics: Phaser.GameObjects.Graphics;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem
  ) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(25);
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
    this.checkPendulums();
    this.redraw();
  }

  private checkSpikes(): void {
    const playerBounds = this.getPlayerBounds();

    for (const spike of SPIKES) {
      const bounds = new Phaser.Geom.Rectangle(
        spike.x,
        spike.y - 13,
        spike.width,
        15
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
          205,
          -190
        );
      }
    }
  }

  private checkPendulums(): void {
    const playerBounds = this.getPlayerBounds();

    for (const pendulum of PENDULUMS) {
      const position =
        this.getPendulumPosition(pendulum);

      if (
        this.circleIntersectsRectangle(
          position.x,
          position.y,
          15,
          playerBounds
        )
      ) {
        this.playerHealth.receiveDamage(
          1,
          position.x,
          230,
          -165
        );
      }
    }
  }

  private getPendulumPosition(
    pendulum: PendulumDefinition
  ): Phaser.Math.Vector2 {
    const angle =
      Math.sin(
        this.elapsed * 1.65 +
        pendulum.phase
      ) * 0.82;

    return new Phaser.Math.Vector2(
      pendulum.x +
        Math.sin(angle) *
        pendulum.length,
      pendulum.anchorY +
        Math.cos(angle) *
        pendulum.length
    );
  }

  private getPlayerBounds(): Phaser.Geom.Rectangle {
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

      const spikeWidth =
        spike.width / count;

      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        const left =
          spike.x +
          index * spikeWidth;

        g.fillStyle(
          index % 2 === 0
            ? 0x69dce9
            : 0xd7aa48,
          1
        );

        g.fillTriangle(
          left,
          spike.y,
          left + spikeWidth * 0.5,
          spike.y - 13,
          left + spikeWidth,
          spike.y
        );
      }
    }

    for (const pendulum of PENDULUMS) {
      const position =
        this.getPendulumPosition(pendulum);

      g.lineStyle(
        3,
        0x9f7935,
        0.95
      );

      g.lineBetween(
        pendulum.x,
        pendulum.anchorY,
        position.x,
        position.y
      );

      g.fillStyle(
        0x16273a,
        1
      );

      g.fillCircle(
        position.x,
        position.y,
        15
      );

      g.lineStyle(
        3,
        0x74e1eb,
        1
      );

      g.strokeCircle(
        position.x,
        position.y,
        15
      );

      for (
        let index = 0;
        index < 8;
        index += 1
      ) {
        const angle =
          this.elapsed * 5 +
          index * Math.PI * 0.25;

        const innerX =
          position.x +
          Math.cos(angle) * 11;

        const innerY =
          position.y +
          Math.sin(angle) * 11;

        const outerX =
          position.x +
          Math.cos(angle) * 23;

        const outerY =
          position.y +
          Math.sin(angle) * 23;

        g.lineStyle(
          3,
          0xd8b14f,
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
