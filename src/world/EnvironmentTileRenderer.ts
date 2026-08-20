import Phaser from "phaser";

import {
  WORLD_HEIGHT,
  WORLD_SECTIONS,
  WORLD_SOLIDS,
  WORLD_WIDTH
} from "./WorldLayout";

const TEXTURE_KEY =
  "impressario-environment";

const TEXTURE_URL =
  "/assets/world/impressario-environment.png";

const PARALLAX_FRAME = 11;
const LOWER_TRIM_FRAME_OFFSET = 16;
const UPPER_TRIM_FRAME_OFFSET = 24;

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
    private readonly scene: Phaser.Scene
  ) {
    this.validateTextureFrames();
    this.createParallaxLayer();
    this.createMaterialLayers();
    this.createCollisionVisualsForSection(
      "MovementRehearsal"
    );
    this.createCollisionVisualsForSection(
      "CombatRehearsal"
    );
    this.createCollisionVisualsForSection(
      "MainStage"
    );
    this.createCollisionVisualsForSection(
      "GrandGallery"
    );
    this.createCollisionVisualsForSection(
      "GalleryGauntlet"
    );
    this.createCollisionVisualsForSection(
      "SpotlightVault"
    );
    this.createCollisionVisualsForSection(
      "CardSanctum"
    );
    this.createCollisionVisualsForSection(
      "RoyalBox"
    );
    this.createCollisionVisualsForSection(
      "MirrorCore"
    );
    this.createCollisionVisualsForSection(
      "ConductorApproach"
    );
    this.createCollisionVisualsForSection(
      "MirrorConductor"
    );
    this.createLighting();
  }

  private validateTextureFrames(): void {
    const texture =
      this.scene.textures.get(
        TEXTURE_KEY
      );

    const frameTotal = texture.frameTotal;

    for (const section of WORLD_SECTIONS) {
      const requiredFrames = [
        section.textureFrame,
        section.textureFrame +
          LOWER_TRIM_FRAME_OFFSET,
        section.textureFrame +
          UPPER_TRIM_FRAME_OFFSET
      ];

      for (const frame of requiredFrames) {
        if (
          frame < 0 ||
          frame >= frameTotal
        ) {
          throw new Error(
            `Environment frame ${frame} for ` +
            `${section.id} is unavailable; ` +
            `texture contains ${frameTotal} frames.`
          );
        }
      }
    }
  }

  private createParallaxLayer(): void {
    const layer =
      this.scene.add.tileSprite(
        WORLD_WIDTH * 0.5,
        WORLD_HEIGHT * 0.5,
        WORLD_WIDTH,
        WORLD_HEIGHT,
        TEXTURE_KEY,
        PARALLAX_FRAME
      );

    layer
      .setOrigin(0.5)
      .setScrollFactor(0.35, 0.65)
      .setDepth(-110)
      .setAlpha(0.32);
  }

  private createMaterialLayers(): void {
    for (const section of WORLD_SECTIONS) {
      const width =
        section.endX -
        section.startX;

      const centerX =
        section.startX +
        width * 0.5;

      const background =
        this.scene.add.tileSprite(
          centerX,
          WORLD_HEIGHT * 0.5,
          width,
          WORLD_HEIGHT,
          TEXTURE_KEY,
          section.textureFrame
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
          section.textureFrame +
            LOWER_TRIM_FRAME_OFFSET
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
          section.textureFrame +
            UPPER_TRIM_FRAME_OFFSET
        );

      upperTrim
        .setOrigin(0.5)
        .setScrollFactor(1)
        .setDepth(1)
        .setAlpha(0.48);
    }
  }

  private createCollisionVisualsForSection(
    sectionId: string
  ): void {
    const section =
      WORLD_SECTIONS.find(
        ({ id }) =>
          id === sectionId
      );

    if (!section) {
      throw new Error(
        `${sectionId} visual section is unavailable.`
      );
    }

    const surfaceFrame =
      section.textureFrame +
      UPPER_TRIM_FRAME_OFFSET;

    const bodyFrame =
      section.textureFrame +
      LOWER_TRIM_FRAME_OFFSET;

    for (const solid of WORLD_SOLIDS) {
      const solidEndX =
        solid.x + solid.width;

      if (
        solid.x >= section.endX ||
        solidEndX <= section.startX
      ) {
        continue;
      }

      const body =
        this.scene.add.tileSprite(
          solid.x + solid.width * 0.5,
          solid.y + solid.height * 0.5,
          solid.width,
          solid.height,
          TEXTURE_KEY,
          bodyFrame
        );

      body
        .setOrigin(0.5)
        .setScrollFactor(1)
        .setDepth(0.7)
        .setAlpha(0.96);

      const surfaceHeight =
        Math.min(4, solid.height);

      const surface =
        this.scene.add.tileSprite(
          solid.x + solid.width * 0.5,
          solid.y + surfaceHeight * 0.5,
          solid.width,
          surfaceHeight,
          TEXTURE_KEY,
          surfaceFrame
        );

      surface
        .setOrigin(0.5)
        .setScrollFactor(1)
        .setDepth(0.8)
        .setAlpha(0.9);
    }
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
