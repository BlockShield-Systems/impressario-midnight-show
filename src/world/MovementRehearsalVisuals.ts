import Phaser from "phaser";

import {
  WORLD_ONE_WAY_PLATFORMS,
  WORLD_SOLIDS,
  WORLD_WALL_JUMP_SURFACES
} from "./WorldLayout";
import {
  MOVEMENT_DECORATIVE_COLUMNS,
  MOVEMENT_ENVIRONMENT_FOREGROUND_DEPTH,
  MOVEMENT_TUTORIAL_MARKER_DEPTH,
  MOVEMENT_TUTORIAL_SIGNAGE_DEPTH,
  MOVEMENT_TUTORIAL_SIGNS,
  OPENING_TUTORIAL_SUBTITLE,
  OPENING_TUTORIAL_TITLE
} from "./MovementTutorial";

const SECTION_START = 0;
const SECTION_END = 5376;
const STAGE_FLOOR_Y = 326;

const inMovementRehearsal = (
  rectangle: {
    readonly x: number;
    readonly width: number;
  }
): boolean =>
  rectangle.x < SECTION_END &&
  rectangle.x + rectangle.width > SECTION_START;

const REHEARSAL_SOLIDS =
  WORLD_SOLIDS.filter(inMovementRehearsal);
const REHEARSAL_ONE_WAY_PLATFORMS =
  WORLD_ONE_WAY_PLATFORMS.filter(
    inMovementRehearsal
  );
const REHEARSAL_WALL_JUMP_SURFACES =
  WORLD_WALL_JUMP_SURFACES.filter(
    inMovementRehearsal
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

    // Decorative columns deliberately recede: broad shadow shapes,
    // low-contrast inset seams, and no bright top/side collision edge.
    for (const column of
      MOVEMENT_DECORATIVE_COLUMNS) {
      const x = column.x;

      architecture.fillStyle(
        0x0b0710,
        0.72
      );

      architecture.fillRoundedRect(
        x,
        column.y,
        column.width,
        column.height,
        14
      );

      architecture.lineStyle(
        2,
        0x50304f,
        0.34
      );

      architecture.strokeRoundedRect(
        x + 5,
        column.y + 6,
        column.width - 10,
        column.height - 12,
        11
      );

      for (
        let y = 58;
        y < STAGE_FLOOR_Y - 30;
        y += 48
      ) {
        architecture.fillStyle(
          0x6a4568,
          0.2
        );
        architecture.fillCircle(
          x + column.width * 0.5,
          y,
          1.5
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

    // One-way surfaces are lightweight cyan rails with an open underside.
    // Their authored metadata, not this color, controls collision behavior.
    for (const platform of
      REHEARSAL_ONE_WAY_PLATFORMS) {
      foreground.fillStyle(
        0x102a33,
        0.96
      );
      foreground.fillRoundedRect(
        platform.x,
        platform.y,
        platform.width,
        platform.height,
        5
      );
      foreground.fillStyle(
        0x74e8ef,
        1
      );
      foreground.fillRect(
        platform.x,
        platform.y,
        platform.width,
        3
      );
      foreground.lineStyle(
        1,
        0x8cf1f5,
        0.78
      );
      for (
        let x = platform.x + 12;
        x < platform.x + platform.width - 5;
        x += 22
      ) {
        foreground.lineBetween(
          x - 5,
          platform.y + 9,
          x,
          platform.y + 5
        );
        foreground.lineBetween(
          x,
          platform.y + 5,
          x + 5,
          platform.y + 9
        );
      }
    }

    // Wall-jump surfaces are solid gold-edged progression rails with
    // repeated grip bars, distinct from both scenery and combat gates.
    for (const wall of
      REHEARSAL_WALL_JUMP_SURFACES) {
      foreground.fillStyle(
        0x291722,
        1
      );
      foreground.fillRoundedRect(
        wall.x,
        wall.y,
        wall.width,
        wall.height,
        4
      );
      foreground.lineStyle(
        3,
        0xe5b94f,
        0.96
      );
      foreground.lineBetween(
        wall.x + 2,
        wall.y,
        wall.x + 2,
        wall.y + wall.height
      );
      foreground.lineBetween(
        wall.x + wall.width - 2,
        wall.y,
        wall.x + wall.width - 2,
        wall.y + wall.height
      );
      for (
        let y = wall.y + 14;
        y < wall.y + wall.height - 5;
        y += 22
      ) {
        foreground.lineStyle(
          2,
          0x78e4eb,
          0.82
        );
        foreground.lineBetween(
          wall.x + 6,
          y,
          wall.x + wall.width - 6,
          y
        );
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
        sign.y,
        `${sign.title}\n${sign.hint}`,
        {
          align: "center",
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#f4d277",
          backgroundColor:
            "#120812dd",
          fixedWidth: sign.width,
          fixedHeight: sign.height,
          padding: {
            x: 7,
            y: 5
          },
          stroke: "#07040a",
          strokeThickness: 2
        }
      )
        .setOrigin(0.5, 0)
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

      const markerX = sign.markerX;
      const markerY = sign.markerY;

      marker.fillStyle(
        0xf0c65c,
        0.95
      );

      if (sign.direction === "up") {
        marker.lineBetween(
          markerX,
          markerY + 16,
          markerX,
          markerY
        );
        marker.fillTriangle(
          markerX,
          markerY - 7,
          markerX - 5,
          markerY + 1,
          markerX + 5,
          markerY + 1
        );
      } else if (sign.direction === "down") {
        marker.lineBetween(
          markerX,
          markerY,
          markerX,
          markerY + 16
        );
        marker.fillTriangle(
          markerX,
          markerY + 23,
          markerX - 5,
          markerY + 15,
          markerX + 5,
          markerY + 15
        );
      } else {
        marker.lineBetween(
          markerX,
          markerY,
          markerX + 18,
          markerY
        );
        marker.fillTriangle(
          markerX + 25,
          markerY,
          markerX + 17,
          markerY - 5,
          markerX + 17,
          markerY + 5
        );
      }
    }

    scene.add.text(
      OPENING_TUTORIAL_TITLE.x,
      OPENING_TUTORIAL_TITLE.y,
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
      OPENING_TUTORIAL_SUBTITLE.x,
      OPENING_TUTORIAL_SUBTITLE.y,
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
