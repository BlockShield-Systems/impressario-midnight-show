import Phaser from "phaser";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";
import { getWorldHazards } from "./WorldHazards";

const PENDULUMS = getWorldHazards(
  "MainStage",
  "Pendulum"
);

const SPIKES = getWorldHazards(
  "MainStage",
  "Spike"
);

export class MainStageHazardSystem {
  private enabled = false;
  private elapsed = 0;

  private readonly graphics: Phaser.GameObjects.Graphics;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem
  ) {
    this.graphics = scene.add.graphics().setDepth(28);
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
    this.checkSpikes();
    this.checkPendulums();
    this.redraw();
  }

  private checkSpikes(): void {
    const playerBounds = this.getPlayerBounds();

    for (const spike of SPIKES) {
      const bounds = new Phaser.Geom.Rectangle(
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
          195,
          -175
        );
      }
    }
  }

  private checkPendulums(): void {
    const playerBounds = this.getPlayerBounds();

    for (const pendulum of PENDULUMS) {
      const position = this.getPendulumPosition(pendulum);
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
      const deltaX = position.x - closestX;
      const deltaY = position.y - closestY;

      if (
        deltaX * deltaX + deltaY * deltaY <= 256
      ) {
        this.playerHealth.receiveDamage(
          1,
          position.x,
          225,
          -165
        );
      }
    }
  }

  private getPendulumPosition(
    pendulum: (typeof PENDULUMS)[number]
  ): Phaser.Math.Vector2 {
    const angle = Math.sin(
      this.elapsed * pendulum.speed + pendulum.phase
    ) * 0.72;

    return new Phaser.Math.Vector2(
      pendulum.x + Math.sin(angle) * pendulum.travelY,
      pendulum.y + Math.cos(angle) * pendulum.travelY
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

  private redraw(): void {
    const g = this.graphics;
    g.clear();

    for (const spike of SPIKES) {
      const count = Math.max(1, Math.floor(spike.width / 12));
      const width = spike.width / count;

      for (let index = 0; index < count; index += 1) {
        const x = spike.x + index * width;
        g.fillStyle(index % 2 === 0 ? 0xe2ac45 : 0xc93b50, 1);
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

    for (const pendulum of PENDULUMS) {
      const position = this.getPendulumPosition(pendulum);

      g.lineStyle(3, 0x9a7133, 1);
      g.lineBetween(
        pendulum.x,
        pendulum.y,
        position.x,
        position.y
      );

      g.fillStyle(0x2a1420, 1);
      g.fillCircle(position.x, position.y, 16);
      g.lineStyle(3, 0xf0c95e, 1);
      g.strokeCircle(position.x, position.y, 16);

      for (let index = 0; index < 6; index += 1) {
        const angle = index * Math.PI / 3;
        g.lineBetween(
          position.x + Math.cos(angle) * 10,
          position.y + Math.sin(angle) * 10,
          position.x + Math.cos(angle) * 23,
          position.y + Math.sin(angle) * 23
        );
      }
    }
  }
}
