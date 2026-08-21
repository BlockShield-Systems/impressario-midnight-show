import Phaser from "phaser";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";
import { getWorldHazards } from "./WorldHazards";

const SPIKES = getWorldHazards(
  "CombatRehearsal",
  "Spike"
);

export class CombatRehearsalHazardSystem {
  private enabled = false;
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
    this.redraw();
  }

  public reset(): void {
    this.setEnabled(false);
  }

  public update(): void {
    if (!this.enabled) {
      return;
    }

    const playerBounds = new Phaser.Geom.Rectangle(
      this.player.x,
      this.player.y,
      this.player.width,
      this.player.height
    );

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
          190,
          -165
        );
      }
    }
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();

    if (!this.enabled) {
      return;
    }

    for (const spike of SPIKES) {
      const count = Math.max(1, Math.floor(spike.width / 12));
      const width = spike.width / count;

      for (let index = 0; index < count; index += 1) {
        const x = spike.x + index * width;
        g.fillStyle(index % 2 === 0 ? 0xd9416c : 0xf0bd55, 1);
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
  }
}
