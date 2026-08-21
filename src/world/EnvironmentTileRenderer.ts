import Phaser from "phaser";

import {
  WORLD_SECTIONS
} from "./WorldLayout";

export class EnvironmentTileRenderer {
  public constructor(
    private readonly scene: Phaser.Scene
  ) {
    this.createLighting();
  }

  private createLighting(): void {
    for (const section of WORLD_SECTIONS) {
      const width =
        section.endX -
        section.startX;

      const lightCount = Math.max(
        1,
        Math.ceil(
          width /
          section.lightSpacing
        )
      );

      for (
        let index = 0;
        index < lightCount;
        index += 1
      ) {
        const x =
          section.startX +
          (index + 0.5) *
          (width / lightCount);

        const halo =
          this.scene.add.ellipse(
            x,
            112,
            250,
            310,
            section.lightColor,
            0.035
          );

        halo
          .setDepth(3)
          .setScrollFactor(1)
          .setBlendMode(
            Phaser.BlendModes.ADD
          );

        const lamp =
          this.scene.add.circle(
            x,
            33,
            5,
            section.lightColor,
            0.78
          );

        lamp
          .setDepth(4)
          .setScrollFactor(1)
          .setBlendMode(
            Phaser.BlendModes.ADD
          );
      }
    }
  }
}
