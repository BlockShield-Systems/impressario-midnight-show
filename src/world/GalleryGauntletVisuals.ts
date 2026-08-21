import Phaser from "phaser";

const START_X = 19456;
const END_X = 23552;

const PLATFORMS = [
  [19616, 368, 128],
  [19936, 352, 160],
  [20128, 400, 160],
  [20448, 336, 160],
  [20768, 304, 160],
  [21344, 368, 176],
  [21648, 320, 176],
  [21952, 368, 176],
  [22256, 320, 144],
  [22592, 336, 160],
  [22912, 304, 160],
  [23200, 272, 160]
] as const;

const LANDMARKS = [
  [19504, 250, "RHYTHM DESCENT", "READ THE FIRST SWING"],
  [19952, 286, "FIRST SHADOW", "CONTROL THE LOWER FLOOR"],
  [20464, 250, "MIDPOINT REFUGE", "THE ROUTE TURNS UPWARD"],
  [21152, 286, "FRACTURED SALON", "BREAK THE FINAL SHADOW"],
  [22544, 242, "VAULT ASCENT", "CLIMB BEYOND THE VOID"]
] as const;

export class GalleryGauntletVisuals {
  public constructor(scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.setDepth(-80);
    background.fillStyle(0x050914, 1);
    background.fillRect(
      START_X,
      0,
      END_X - START_X,
      720
    );

    this.drawFracturedWalls(background);
    this.drawVoid(background);
    this.drawRouteTelegraphs(scene);
    this.drawLandmarks(scene);
  }

  private drawFracturedWalls(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    for (
      let x = START_X;
      x < END_X;
      x += 256
    ) {
      graphics.fillStyle(0x0d1730, 0.94);
      graphics.fillRect(x, 0, 176, 420);
      graphics.fillStyle(0x17112e, 0.86);
      graphics.fillRect(x + 176, 0, 80, 420);

      graphics.lineStyle(2, 0x3b6b86, 0.32);
      graphics.lineBetween(
        x + 18,
        0,
        x + 18,
        420
      );
      graphics.lineBetween(
        x + 158,
        0,
        x + 158,
        420
      );

      graphics.lineStyle(2, 0xb58b39, 0.58);
      graphics.lineBetween(
        x + 42,
        72,
        x + 112,
        154
      );
      graphics.lineBetween(
        x + 112,
        154,
        x + 76,
        244
      );
      graphics.lineBetween(
        x + 76,
        244,
        x + 136,
        332
      );
    }

    graphics.fillStyle(0x9b7231, 0.9);
    graphics.fillRect(
      START_X,
      26,
      END_X - START_X,
      4
    );
    graphics.fillStyle(0x72e2eb, 0.55);
    graphics.fillRect(
      START_X,
      31,
      END_X - START_X,
      2
    );
  }

  private drawVoid(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    graphics.fillStyle(0x02040a, 1);
    graphics.fillRect(
      START_X,
      512,
      END_X - START_X,
      208
    );

    for (
      let x = START_X + 80;
      x < END_X;
      x += 240
    ) {
      graphics.fillStyle(0x081022, 0.9);
      graphics.fillTriangle(
        x,
        688,
        x + 70,
        470,
        x + 150,
        688
      );
      graphics.lineStyle(1, 0x4ab9cf, 0.25);
      graphics.lineBetween(
        x + 70,
        470,
        x + 70,
        688
      );
    }

    for (
      let x = START_X + 120;
      x < END_X;
      x += 320
    ) {
      graphics.fillStyle(0x6bdcea, 0.5);
      graphics.fillCircle(x, 602, 2);
      graphics.fillStyle(0xd7aa48, 0.48);
      graphics.fillCircle(x + 96, 646, 2);
    }
  }

  private drawRouteTelegraphs(
    scene: Phaser.Scene
  ): void {
    const graphics = scene.add.graphics();
    graphics.setDepth(2);

    for (const [x, y, width] of PLATFORMS) {
      graphics.fillStyle(0x14243d, 1);
      graphics.fillRoundedRect(
        x,
        y,
        width,
        16,
        4
      );
      graphics.fillStyle(0x73e3eb, 1);
      graphics.fillRect(x, y, width, 3);
      graphics.lineStyle(1, 0xd6ad49, 0.9);
      graphics.strokeRoundedRect(
        x,
        y,
        width,
        16,
        4
      );
    }

    const routePoints = [
      [19536, 456],
      [19680, 352],
      [19984, 336],
      [20528, 320],
      [20848, 288],
      [21432, 352],
      [21736, 304],
      [22040, 352],
      [22672, 320],
      [22992, 288],
      [23280, 256],
      [23488, 336]
    ] as const;

    for (const [x, y] of routePoints) {
      graphics.fillStyle(0x73e3eb, 0.86);
      graphics.fillCircle(x, y, 3);
      graphics.lineStyle(1, 0xd6ad49, 0.75);
      graphics.strokeCircle(x, y, 7);
    }
  }

  private drawLandmarks(
    scene: Phaser.Scene
  ): void {
    for (
      const [x, y, title, detail] of LANDMARKS
    ) {
      scene.add.text(
        x,
        y,
        [title, detail].join("\n"),
        {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#8beaf1",
          backgroundColor: "#050914e8",
          padding: { x: 8, y: 6 }
        }
      ).setDepth(4);
    }

    scene.add.text(
      23408,
      208,
      "THE SPOTLIGHT VAULT →",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f3d36b",
        backgroundColor: "#050914e8",
        padding: { x: 8, y: 6 }
      }
    ).setDepth(4);
  }
}
