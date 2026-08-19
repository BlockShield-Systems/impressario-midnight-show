import Phaser from "phaser";

import {
  WORLD_HEIGHT,
  WORLD_SECTIONS
} from "./WorldLayout";

const TEXTURE_KEY =
  "impressario-environment";

const TEXTURE_URL =
  "/assets/world/impressario-environment.png";

const SECTION_FRAME: Readonly<
  Record<string, number>
> = {
  MovementRehearsal: 0,
  CombatRehearsal: 1,
  MainStage: 2,
  GrandGallery: 3,
  GalleryGauntlet: 4,
  SpotlightVault: 5,
  CardSanctum: 6,
  RoyalBox: 7,
  MirrorCore: 8,
  ConductorApproach: 9,
  MirrorConductor: 10
};

const SECTION_LIGHT: Readonly<
  Record<string, number>
> = {
  MovementRehearsal: 0xf2c95e,
  CombatRehearsal: 0xe0608c,
  MainStage: 0xf2c95e,
  GrandGallery: 0x61dce9,
  GalleryGauntlet: 0x66e6ef,
  SpotlightVault: 0xe85dcc,
  CardSanctum: 0xe6b754,
  RoyalBox: 0x66dce9,
  MirrorCore: 0x65e4ed,
  ConductorApproach: 0xe95acb,
  MirrorConductor: 0xf2ca58
};

export class EnvironmentTileRenderer {
  public static preload(
    scene: Phaser.Scene
  ): void {
    if (
      scene.textures.exists(
        TEXTURE_KEY
      )
    ) {
      return;
    }

    scene.load.spritesheet(
      TEXTURE_KEY,
      TEXTURE_URL,
      {
        frameWidth: 32,
        frameHeight: 32
      }
    );
  }

  public constructor(
    private readonly scene:
      Phaser.Scene
  ) {
    this.createParallaxLayer();
    this.createMaterialLayers();
    this.createLighting();
  }

  private createParallaxLayer(): void {
    const width =
      this.scene.cameras.main
        .getBounds().width ||
      WORLD_SECTIONS[
        WORLD_SECTIONS.length - 1
      ]?.endX ||
      18720;

    const layer =
      this.scene.add.tileSprite(
        width * 0.5,
        WORLD_HEIGHT * 0.5,
        width,
        WORLD_HEIGHT,
        TEXTURE_KEY,
        11
      );

    layer
      .setOrigin(0.5)
      .setScrollFactor(0.35, 0.65)
      .setDepth(-110)
      .setAlpha(0.32);
  }

  private createMaterialLayers(): void {
    for (
      const section of
      WORLD_SECTIONS
    ) {
      const width =
        section.endX -
        section.startX;

      const centerX =
        section.startX +
        width * 0.5;

      const frame =
        SECTION_FRAME[
          section.id
        ] ?? 0;

      const background =
        this.scene.add.tileSprite(
          centerX,
          WORLD_HEIGHT * 0.5,
          width,
          WORLD_HEIGHT,
          TEXTURE_KEY,
          frame
        );

      background
        .setOrigin(0.5)
        .setScrollFactor(1)
        .setDepth(-0.5)
        .setAlpha(0.28);

      const lowerTrim =
        this.scene.add.tileSprite(
          centerX,
          322,
          width,
          18,
          TEXTURE_KEY,
          frame + 16
        );

      lowerTrim
        .setOrigin(0.5)
        .setScrollFactor(1)
        .setDepth(1)
        .setAlpha(0.72);

      const upperTrim =
        this.scene.add.tileSprite(
          centerX,
          31,
          width,
          8,
          TEXTURE_KEY,
          frame + 24
        );

      upperTrim
        .setOrigin(0.5)
        .setScrollFactor(1)
        .setDepth(1)
        .setAlpha(0.48);
    }
  }

  private createLighting(): void {
    for (
      const section of
      WORLD_SECTIONS
    ) {
      const width =
        section.endX -
        section.startX;

      const color =
        SECTION_LIGHT[
          section.id
        ] ?? 0xffffff;

      const lightCount = Math.max(
        1,
        Math.ceil(width / 520)
      );

      for (
        let index = 0;
        index < lightCount;
        index += 1
      ) {
        const x =
          section.startX +
          (
            index + 0.5
          ) *
          (
            width /
            lightCount
          );

        const halo =
          this.scene.add.ellipse(
            x,
            112,
            250,
            310,
            color,
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
            color,
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
