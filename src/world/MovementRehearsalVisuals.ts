import Phaser from "phaser";

import {
  WORLD_SOLIDS
} from "./WorldLayout";
import {
  MOVEMENT_ENVIRONMENT_FOREGROUND_DEPTH,
  MOVEMENT_TUTORIAL_MARKER_DEPTH,
  MOVEMENT_TUTORIAL_SIGNAGE_DEPTH,
  MOVEMENT_TUTORIAL_SIGNS
} from "./MovementTutorial";

const SECTION_START = 0;
const SECTION_END = 5376;
const STAGE_FLOOR_Y = 326;

const REHEARSAL_SOLIDS =
  WORLD_SOLIDS.filter(
    solid =>
      solid.x < SECTION_END &&
      solid.x + solid.width > SECTION_START
  );

export class MovementRehearsalVisuals {
  public constructor(
    scene: Phaser.Scene
  ) {
    this.createBackground(scene);
    this.createAtmosphericPolish(scene);
    this.createArchitecture(scene);
    this.createSolidCoverage(scene);
    this.createMovementLanguage(scene);
  }

  private createBackground(
    scene: Phaser.Scene
  ): void {
    const background = scene.add.graphics();

    background
      .setDepth(-82)
      .setScrollFactor(1);

    background.fillStyle(
      0x110813,
      1
    );

    background.fillRect(
      SECTION_START,
      0,
      SECTION_END - SECTION_START,
      720
    );

    for (
      let x = SECTION_START;
      x < SECTION_END;
      x += 256
    ) {
      const alternate =
        Math.floor(x / 256) % 2 === 0;

      background.fillStyle(
        alternate
          ? 0x241020
          : 0x190d1d,
        1
      );

      background.fillRect(
        x,
        0,
        256,
        STAGE_FLOOR_Y
      );

      background.fillStyle(
        0x08050c,
        0.42
      );

      background.fillRect(
        x + 22,
        38,
        212,
        220
      );

      background.lineStyle(
        2,
        alternate
          ? 0x7a3157
          : 0x4a294d,
        0.52
      );

      background.strokeRoundedRect(
        x + 22,
        38,
        212,
        220,
        12
      );
    }

    background.fillStyle(
      0x3d1629,
      1
    );

    background.fillRect(
      SECTION_START,
      0,
      SECTION_END,
      24
    );

    background.fillStyle(
      0xd4a449,
      0.75
    );

    background.fillRect(
      SECTION_START,
      23,
      SECTION_END,
      3
    );

    for (
      let x = 180;
      x < SECTION_END;
      x += 520
    ) {
      background.fillStyle(
        0xf2c95e,
        0.08
      );

      background.fillTriangle(
        x,
        20,
        x - 155,
        STAGE_FLOOR_Y,
        x + 155,
        STAGE_FLOOR_Y
      );

      background.fillStyle(
        0xffe69a,
        0.9
      );

      background.fillCircle(
        x,
        22,
        6
      );
    }
  }

  private createAtmosphericPolish(
    scene: Phaser.Scene
  ): void {
    const atmosphere =
      scene.add.graphics();

    atmosphere
      .setDepth(-7)
      .setScrollFactor(1);

    // Deterministic floating dust catches the rehearsal spotlights
    // without adding per-frame particle-system overhead.
    for (
      let index = 0;
      index < 96;
      index += 1
    ) {
      const x =
        28 +
        (
          index * 317 +
          index * index * 11
        ) %
        (SECTION_END - 56);

      const y =
        38 +
        (
          index * 73 +
          index * index * 5
        ) %
        248;

      const bright =
        index % 5 === 0;

      atmosphere.fillStyle(
        bright
          ? 0xf4d57b
          : 0x7edce5,
        bright ? 0.24 : 0.14
      );

      atmosphere.fillCircle(
        x,
        y,
        bright
          ? 1.35
          : 0.85
      );
    }

    // Layered proscenium curtains frame the opening lesson.
    const curtain = scene.add.graphics();

    curtain
      .setDepth(
        MOVEMENT_ENVIRONMENT_FOREGROUND_DEPTH
      )
      .setScrollFactor(1);

    curtain.fillStyle(
      0x4b102c,
      0.96
    );

    curtain.fillTriangle(
      0,
      0,
      0,
      292,
      116,
      0
    );

    curtain.fillTriangle(
      5376,
      0,
      5376,
      292,
      5260,
      0
    );

    curtain.fillStyle(
      0x75183d,
      0.88
    );

    for (
      let offset = 0;
      offset < 104;
      offset += 18
    ) {
      curtain.fillTriangle(
        offset,
        0,
        offset,
        222 - offset,
        offset + 22,
        0
      );

      curtain.fillTriangle(
        SECTION_END - offset,
        0,
        SECTION_END - offset,
        222 - offset,
        SECTION_END - offset - 22,
        0
      );
    }

    curtain.lineStyle(
      3,
      0xd4a64c,
      0.88
    );

    curtain.lineBetween(
      0,
      24,
      118,
      0
    );

    curtain.lineBetween(
      SECTION_END,
      24,
      SECTION_END - 118,
      0
    );

    // Repeating runway lights establish route rhythm and depth.
    for (
      let x = 80;
      x < SECTION_END - 80;
      x += 128
    ) {
      const cyan =
        Math.floor(x / 128) % 2 === 0;

      curtain.fillStyle(
        cyan
          ? 0x75e4eb
          : 0xf0c85c,
        0.9
      );

      curtain.fillCircle(
        x,
        319,
        2.5
      );

      curtain.fillStyle(
        cyan
          ? 0x75e4eb
          : 0xf0c85c,
        0.12
      );

      curtain.fillCircle(
        x,
        319,
        7
      );
    }

    // The section exit reads as a deliberate transition portal.
    curtain.fillStyle(
      0x07131a,
      0.84
    );

    curtain.fillRoundedRect(
      SECTION_END - 96,
      76,
      72,
      238,
      30
    );

    curtain.lineStyle(
      4,
      0xe3b94f,
      0.95
    );

    curtain.strokeRoundedRect(
      SECTION_END - 96,
      76,
      72,
      238,
      30
    );

    curtain.lineStyle(
      2,
      0x73e2e9,
      0.78
    );

    curtain.strokeRoundedRect(
      SECTION_END - 88,
      84,
      56,
      222,
      24
    );

    for (
      let y = 110;
      y < 286;
      y += 32
    ) {
      curtain.lineStyle(
        1,
        0x8ceaf0,
        0.34
      );

      curtain.lineBetween(
        SECTION_END - 82,
        y,
        SECTION_END - 38,
        y + 18
      );
    }

    scene.add.text(
      SECTION_END - 60,
      62,
      "ACT II →",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f5d675",
        backgroundColor:
          "#0b0710dd",
        padding: {
          x: 6,
          y: 4
        },
        stroke: "#07040a",
        strokeThickness: 2
      }
    )
      .setOrigin(0.5, 1)
      .setDepth(9);
  }

  private createArchitecture(
    scene: Phaser.Scene
  ): void {
    const architecture =
      scene.add.graphics();

    architecture
      .setDepth(-8)
      .setScrollFactor(1);

    for (
      let x = 0;
      x < SECTION_END;
      x += 640
    ) {
      architecture.fillStyle(
        0x160a13,
        1
      );

      architecture.fillRect(
        x,
        0,
        22,
        STAGE_FLOOR_Y
      );

      architecture.lineStyle(
        3,
        0xa97932,
        0.85
      );

      architecture.lineBetween(
        x + 5,
        0,
        x + 5,
        STAGE_FLOOR_Y
      );

      architecture.lineBetween(
        x + 17,
        0,
        x + 17,
        STAGE_FLOOR_Y
      );

      for (
        let y = 44;
        y < STAGE_FLOOR_Y;
        y += 46
      ) {
        architecture.lineStyle(
          1,
          0xe7bd5a,
          0.42
        );

        architecture.lineBetween(
          x + 5,
          y,
          x + 17,
          y + 14
        );
      }
    }

    for (
      let x = 96;
      x < SECTION_END;
      x += 320
    ) {
      architecture.fillStyle(
        0x43132d,
        0.94
      );

      architecture.fillRoundedRect(
        x,
        72,
        54,
        86,
        8
      );

      architecture.lineStyle(
        3,
        0xb88937,
        0.92
      );

      architecture.strokeRoundedRect(
        x,
        72,
        54,
        86,
        8
      );

      architecture.fillStyle(
        0xe7b94d,
        0.88
      );

      architecture.fillCircle(
        x + 27,
        110,
        8
      );

      architecture.fillStyle(
        0x67dce8,
        0.76
      );

      architecture.fillTriangle(
        x + 27,
        88,
        x + 18,
        103,
        x + 36,
        103
      );

      architecture.fillTriangle(
        x + 27,
        132,
        x + 18,
        117,
        x + 36,
        117
      );
    }
  }

  private createSolidCoverage(
    scene: Phaser.Scene
  ): void {
    const foreground =
      scene.add.graphics();

    foreground
      .setDepth(3)
      .setScrollFactor(1);

    for (const solid of REHEARSAL_SOLIDS) {
      const thin =
        solid.height <= 18;

      foreground.fillStyle(
        thin
          ? 0x312038
          : 0x1c111e,
        1
      );

      foreground.fillRoundedRect(
        solid.x,
        solid.y,
        solid.width,
        solid.height,
        Math.min(
          5,
          solid.height * 0.25
        )
      );

      foreground.fillStyle(
        thin
          ? 0x72dfe8
          : 0xc0923e,
        thin ? 0.95 : 0.74
      );

      foreground.fillRect(
        solid.x,
        solid.y,
        solid.width,
        Math.min(3, solid.height)
      );

      foreground.lineStyle(
        1,
        0xe4b957,
        thin ? 0.7 : 0.4
      );

      foreground.strokeRoundedRect(
        solid.x,
        solid.y,
        solid.width,
        solid.height,
        Math.min(
          5,
          solid.height * 0.25
        )
      );

      if (
        solid.height >= 34 &&
        solid.width >= 48
      ) {
        for (
          let inset = 18;
          inset < solid.width - 8;
          inset += 32
        ) {
          foreground.lineStyle(
            1,
            0x7f4268,
            0.42
          );

          foreground.lineBetween(
            solid.x + inset,
            solid.y + 7,
            solid.x + inset - 10,
            solid.y + solid.height - 5
          );
        }
      }
    }
  }

  private createMovementLanguage(
    scene: Phaser.Scene
  ): void {
    for (
      const sign of
      MOVEMENT_TUTORIAL_SIGNS
    ) {
      scene.add.text(
        sign.x,
        274,
        `${sign.title}\n${sign.hint}`,
        {
          align: "center",
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#f4d277",
          backgroundColor:
            "#120812dd",
          padding: {
            x: 7,
            y: 5
          },
          stroke: "#07040a",
          strokeThickness: 2
        }
      )
        .setOrigin(0.5, 1)
        .setScrollFactor(1)
        .setDepth(
          MOVEMENT_TUTORIAL_SIGNAGE_DEPTH
        );

      const marker =
        scene.add.graphics();

      marker
        .setDepth(
          MOVEMENT_TUTORIAL_MARKER_DEPTH
        )
        .setScrollFactor(1);

      marker.lineStyle(
        2,
        0x70dfe8,
        0.82
      );

      marker.lineBetween(
        sign.x,
        278,
        sign.x,
        310
      );

      marker.fillStyle(
        0xf0c65c,
        0.95
      );

      marker.fillTriangle(
        sign.x,
        316,
        sign.x - 6,
        307,
        sign.x + 6,
        307
      );
    }

    scene.add.text(
      34,
      42,
      "ACT I — MOVEMENT REHEARSAL",
      {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#f5d675",
        backgroundColor:
          "#100711e8",
        padding: {
          x: 10,
          y: 7
        },
        stroke: "#08040a",
        strokeThickness: 2
      }
    )
      .setScrollFactor(1)
      .setDepth(
        MOVEMENT_TUTORIAL_SIGNAGE_DEPTH
      );

    scene.add.text(
      34,
      78,
      "Learn the stage. Keep the rhythm.",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#82e6ed",
        backgroundColor:
          "#100711bb",
        padding: {
          x: 7,
          y: 5
        }
      }
    )
      .setScrollFactor(1)
      .setDepth(
        MOVEMENT_TUTORIAL_SIGNAGE_DEPTH
      );
  }
}
