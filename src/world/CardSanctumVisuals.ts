import Phaser from "phaser";

const START_X = 27984;
const END_X = 31664;

const PLATFORMS = [
  [28272, 400, 192],
  [28544, 336, 208],
  [28864, 384, 192],
  [29200, 400, 176],
  [29592, 272, 128],
  [29872, 352, 208],
  [30208, 304, 192],
  [30512, 384, 208],
  [30864, 320, 192],
  [31216, 384, 192],
  [31456, 416, 128]
] as const;

const LANDMARKS = [
  [28032, 386, "SANCTUM THRESHOLD", "READ BOTH ROUTES"],
  [28272, 300, "LOWER GAMBIT", "TRAPS REWARD PATIENCE"],
  [29184, 306, "WALL-JUMP CHAMBER", "ASCEND BETWEEN THE CARDS"],
  [30384, 290, "FINAL HAND", "ROUTES CONVERGE"],
  [31216, 290, "ROYAL LOCK", "BREAK EVERY SENTRY"]
] as const;

export class CardSanctumVisuals {
  public constructor(scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.setDepth(-80);
    background.fillStyle(0x170817, 1);
    background.fillRect(
      START_X,
      0,
      END_X - START_X,
      720
    );

    this.drawCardWalls(background);
    this.drawLowerArchive(background);
    this.drawRouteTelegraphs(scene);
    this.drawLandmarks(scene);
  }

  private drawCardWalls(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    for (
      let x = START_X;
      x < END_X;
      x += 256
    ) {
      graphics.fillStyle(0x2a1029, 0.94);
      graphics.fillRect(x, 0, 168, 448);
      graphics.fillStyle(0x10182d, 0.88);
      graphics.fillRect(x + 168, 0, 88, 448);

      graphics.lineStyle(2, 0xb98c38, 0.5);
      graphics.lineBetween(x + 14, 0, x + 14, 448);
      graphics.lineBetween(x + 152, 0, x + 152, 448);

      graphics.fillStyle(0x0d0d1d, 0.96);
      graphics.fillRoundedRect(
        x + 44,
        54,
        112,
        184,
        14
      );
      graphics.lineStyle(4, 0xd7aa45, 0.88);
      graphics.strokeRoundedRect(
        x + 44,
        54,
        112,
        184,
        14
      );
      graphics.lineStyle(2, 0xd43b6c, 0.75);
      graphics.strokeRoundedRect(
        x + 54,
        64,
        92,
        164,
        10
      );
      graphics.fillStyle(0xd73a69, 0.68);
      graphics.fillCircle(x + 100, 132, 15);
      graphics.fillTriangle(
        x + 78,
        138,
        x + 122,
        138,
        x + 100,
        170
      );
    }

    graphics.fillStyle(0xd7aa45, 0.86);
    graphics.fillRect(
      START_X,
      26,
      END_X - START_X,
      4
    );
    graphics.fillStyle(0x72e2eb, 0.48);
    graphics.fillRect(
      START_X,
      31,
      END_X - START_X,
      2
    );
  }

  private drawLowerArchive(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    graphics.fillStyle(0x07040b, 1);
    graphics.fillRect(
      START_X,
      560,
      END_X - START_X,
      160
    );

    for (
      let x = START_X + 64;
      x < END_X;
      x += 192
    ) {
      graphics.fillStyle(0x251027, 0.9);
      graphics.fillRoundedRect(x, 586, 92, 134, 10);
      graphics.lineStyle(2, 0x8f6d31, 0.48);
      graphics.strokeRoundedRect(x, 586, 92, 134, 10);
      graphics.fillStyle(0x6bdce8, 0.32);
      graphics.fillCircle(x + 46, 638, 3);
    }
  }

  private drawRouteTelegraphs(
    scene: Phaser.Scene
  ): void {
    const graphics = scene.add.graphics();
    graphics.setDepth(2);

    for (const [x, y, width] of PLATFORMS) {
      graphics.fillStyle(0x25152d, 1);
      graphics.fillRoundedRect(
        x,
        y,
        width,
        16,
        4
      );
      graphics.fillStyle(0xe0b451, 1);
      graphics.fillRect(x, y, width, 3);
      graphics.lineStyle(1, 0x71dfe9, 0.82);
      graphics.strokeRoundedRect(
        x,
        y,
        width,
        16,
        4
      );
    }

    for (const [x, y] of [
      [28064, 464],
      [28368, 384],
      [28648, 320],
      [28960, 368],
      [29288, 384],
      [29504, 256],
      [29976, 336],
      [30304, 288],
      [30616, 368],
      [30960, 304],
      [31312, 368],
      [31536, 400]
    ] as const) {
      graphics.fillStyle(0xe1b750, 0.9);
      graphics.fillCircle(x, y, 3);
      graphics.lineStyle(1, 0x74e2eb, 0.76);
      graphics.strokeCircle(x, y, 7);
    }

    graphics.fillStyle(0x16243a, 0.96);
    graphics.fillRect(29408, 288, 24, 240);
    graphics.fillRect(29568, 240, 24, 272);
    graphics.lineStyle(2, 0x70dfe9, 0.82);
    graphics.strokeRect(29408, 288, 24, 240);
    graphics.strokeRect(29728, 240, 24, 272);
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
          color: "#f1ce69",
          backgroundColor: "#130714e8",
          padding: { x: 8, y: 6 }
        }
      ).setDepth(4);
    }

    scene.add.text(
      31392,
      236,
      "THE ROYAL BOX →",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#86e8ef",
        backgroundColor: "#130714e8",
        padding: { x: 8, y: 6 }
      }
    ).setDepth(4);
  }
}
