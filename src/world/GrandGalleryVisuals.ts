import Phaser from "phaser";

const START_X = 13744;
const END_X = 19456;

const PLATFORMS = [
  [14016, 246, 160],
  [14448, 278, 144],
  [14816, 214, 144],
  [15168, 262, 160],
  [15504, 198, 144],
  [15936, 238, 160],
  [16304, 182, 144],
  [16640, 254, 160],
  [17104, 278, 144],
  [17472, 214, 160],
  [17920, 246, 144],
  [18288, 182, 160],
  [18624, 262, 144]
] as const;

const LANDMARKS = [
  {
    x: 13824,
    title: "ACT IV",
    detail: "THE GRAND GALLERY"
  },
  {
    x: 14816,
    title: "PORTRAIT WALK",
    detail: "THE HOUSE REMEMBERS"
  },
  {
    x: 15936,
    title: "NIGHT WINDOWS",
    detail: "FOLLOW THE CYAN CONSTELLATION"
  },
  {
    x: 17104,
    title: "CARD SALON",
    detail: "READ BOTH LEVELS"
  },
  {
    x: 18288,
    title: "DESCENDING EXHIBIT",
    detail: "THE FRAMEWORK FRACTURES"
  },
  {
    x: 19200,
    title: "GAUNTLET THRESHOLD",
    detail: "SHADOWS WAIT BELOW →"
  }
] as const;

export class GrandGalleryVisuals {
  public constructor(
    scene: Phaser.Scene
  ) {
    const background = scene.add.graphics();
    background.setDepth(-90);

    background.fillStyle(0x07111f, 1);
    background.fillRect(
      START_X,
      0,
      END_X - START_X,
      720
    );

    this.drawWallPanels(background);
    this.drawWindows(background);
    this.drawPortraits(background);
    this.drawArchitecture(scene);
    this.drawPlatformTelegraphs(scene);
    this.drawLandmarks(scene);
  }

  private drawWallPanels(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    for (
      let x = START_X;
      x < END_X;
      x += 192
    ) {
      graphics.fillStyle(0x101c35, 1);
      graphics.fillRect(x, 0, 128, 430);
      graphics.fillStyle(0x261943, 0.76);
      graphics.fillRect(x + 128, 0, 64, 430);

      graphics.lineStyle(
        2,
        0x3d6d8c,
        0.28
      );
      graphics.lineBetween(
        x + 12,
        0,
        x + 12,
        430
      );
      graphics.lineBetween(
        x + 116,
        0,
        x + 116,
        430
      );
    }

    graphics.fillStyle(0x9d7130, 1);
    graphics.fillRect(
      START_X,
      26,
      END_X - START_X,
      4
    );
    graphics.fillRect(
      START_X,
      314,
      END_X - START_X,
      5
    );

    graphics.fillStyle(0xe0ba57, 0.62);
    graphics.fillRect(
      START_X,
      27,
      END_X - START_X,
      1
    );
  }

  private drawWindows(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    for (
      let x = START_X + 208;
      x < END_X - 120;
      x += 512
    ) {
      graphics.fillStyle(0x030812, 1);
      graphics.fillRoundedRect(
        x,
        46,
        96,
        166,
        42
      );

      graphics.lineStyle(
        4,
        0xb88938,
        0.88
      );
      graphics.strokeRoundedRect(
        x,
        46,
        96,
        166,
        42
      );

      graphics.lineStyle(
        1,
        0x64d6e8,
        0.42
      );
      graphics.lineBetween(
        x + 48,
        50,
        x + 48,
        207
      );
      graphics.lineBetween(
        x + 8,
        128,
        x + 88,
        128
      );

      for (
        let star = 0;
        star < 7;
        star += 1
      ) {
        const starX =
          x + 16 + (star * 31) % 66;
        const starY =
          66 + (star * 47) % 118;

        graphics.fillStyle(
          star % 2 === 0
            ? 0x7de5f2
            : 0xf1c75b,
          0.86
        );
        graphics.fillCircle(
          starX,
          starY,
          star % 3 === 0 ? 2 : 1
        );
      }
    }
  }

  private drawPortraits(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    for (
      let index = 0;
      index < 10;
      index += 1
    ) {
      const x =
        START_X + 416 + index * 544;

      graphics.fillStyle(0x191027, 1);
      graphics.fillRoundedRect(
        x,
        84,
        76,
        100,
        7
      );
      graphics.lineStyle(
        5,
        0xa9782e,
        1
      );
      graphics.strokeRoundedRect(
        x,
        84,
        76,
        100,
        7
      );
      graphics.lineStyle(
        1,
        0xf0cd6b,
        0.82
      );
      graphics.strokeRoundedRect(
        x + 7,
        91,
        62,
        86,
        4
      );

      const centerX = x + 38;
      const centerY = 134;
      graphics.fillStyle(
        index % 2 === 0
          ? 0x65d9eb
          : 0xb82e68,
        0.82
      );

      if (index % 2 === 0) {
        graphics.fillTriangle(
          centerX,
          centerY - 20,
          centerX - 16,
          centerY,
          centerX + 16,
          centerY
        );
        graphics.fillTriangle(
          centerX,
          centerY + 20,
          centerX - 16,
          centerY,
          centerX + 16,
          centerY
        );
      } else {
        graphics.fillCircle(
          centerX - 9,
          centerY - 6,
          11
        );
        graphics.fillCircle(
          centerX + 9,
          centerY - 6,
          11
        );
        graphics.fillTriangle(
          centerX - 18,
          centerY,
          centerX + 18,
          centerY,
          centerX,
          centerY + 22
        );
      }
    }
  }

  private drawArchitecture(
    scene: Phaser.Scene
  ): void {
    const architecture =
      scene.add.graphics();
    architecture.setDepth(-5);

    for (
      const x of [START_X, END_X - 24]
    ) {
      architecture.fillStyle(
        0x090916,
        1
      );
      architecture.fillRect(
        x,
        0,
        24,
        480
      );
      architecture.lineStyle(
        4,
        0xd0a33e,
        1
      );
      architecture.lineBetween(
        x + 5,
        0,
        x + 5,
        480
      );
      architecture.lineBetween(
        x + 19,
        0,
        x + 19,
        480
      );
    }

    for (
      let x = START_X + 384;
      x < END_X;
      x += 640
    ) {
      architecture.lineStyle(
        2,
        0xb98734,
        0.92
      );
      architecture.lineBetween(
        x,
        0,
        x,
        50
      );
      architecture.lineBetween(
        x - 24,
        58,
        x + 24,
        58
      );
      architecture.lineBetween(
        x - 24,
        58,
        x - 34,
        72
      );
      architecture.lineBetween(
        x + 24,
        58,
        x + 34,
        72
      );
      architecture.fillStyle(
        0x7de4ef,
        0.9
      );
      architecture.fillCircle(x, 57, 5);
      architecture.fillCircle(
        x - 34,
        72,
        4
      );
      architecture.fillCircle(
        x + 34,
        72,
        4
      );
    }
  }

  private drawPlatformTelegraphs(
    scene: Phaser.Scene
  ): void {
    const graphics = scene.add.graphics();
    graphics.setDepth(2);

    for (
      const [x, y, width] of PLATFORMS
    ) {
      graphics.fillStyle(0x182741, 1);
      graphics.fillRoundedRect(
        x,
        y,
        width,
        16,
        4
      );
      graphics.fillStyle(0x65d8e8, 1);
      graphics.fillRect(x, y, width, 3);
      graphics.lineStyle(
        1,
        0xc8963e,
        0.9
      );
      graphics.strokeRoundedRect(
        x,
        y,
        width,
        16,
        4
      );
    }
  }

  private drawLandmarks(
    scene: Phaser.Scene
  ): void {
    for (const landmark of LANDMARKS) {
      scene.add.text(
        landmark.x,
        90,
        [
          landmark.title,
          landmark.detail
        ].join("\n"),
        {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#8be9f2",
          backgroundColor: "#07101de6",
          padding: {
            x: 8,
            y: 6
          }
        }
      ).setDepth(4);
    }
  }
}
