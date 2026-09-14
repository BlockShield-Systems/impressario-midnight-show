import Phaser from "phaser";

const START_X = 31664;
const END_X = 35344;

const PLATFORMS = [
  [31904, 384, 192],
  [32176, 320, 208],
  [32512, 384, 176],
  [32800, 304, 192],
  [33104, 368, 176],
  [33424, 288, 208],
  [33744, 352, 192],
  [34048, 304, 208],
  [34368, 368, 192],
  [34672, 320, 192],
  [34976, 384, 208]
] as const;

const LANDMARKS = [
  [31728, 384, "ROYAL THRESHOLD", "GRAND CARD [L]"],
  [32000, 430, "FIRST REFLECTION", "DUEL BELOW · PRISM ABOVE"],
  [32896, 390, "FRACTURED GALLERY", "READ THE LASER CYCLE"],
  [33920, 422, "MASTER SEQUENCE", "SHIFT ROUTES BETWEEN STRIKES"],
  [34912, 290, "MIRROR LOCK", "BREAK EVERY ECHO"]
] as const;

export class RoyalBoxVisuals {
  public constructor(scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.setDepth(-80);
    background.fillStyle(0x0b0714, 1);
    background.fillRect(
      START_X,
      0,
      END_X - START_X,
      720
    );

    this.drawFracturedWalls(background);
    this.drawLowerBoxes(background);
    this.drawRouteTelegraphs(scene);
    this.drawLandmarks(scene);
  }

  private drawFracturedWalls(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    for (
      let x = START_X;
      x < END_X;
      x += 288
    ) {
      graphics.fillStyle(0x28102f, 0.94);
      graphics.fillRect(x, 0, 176, 448);
      graphics.fillStyle(0x0c1b2d, 0.9);
      graphics.fillRect(x + 176, 0, 112, 448);

      graphics.fillStyle(0x10182b, 0.96);
      graphics.fillRoundedRect(
        x + 42,
        48,
        122,
        202,
        14
      );
      graphics.lineStyle(4, 0xc7a34b, 0.9);
      graphics.strokeRoundedRect(
        x + 42,
        48,
        122,
        202,
        14
      );

      graphics.lineStyle(2, 0x79e6ef, 0.7);
      graphics.lineBetween(x + 103, 52, x + 80, 130);
      graphics.lineBetween(x + 80, 130, x + 126, 172);
      graphics.lineBetween(x + 126, 172, x + 94, 246);
      graphics.lineStyle(2, 0xe05ebd, 0.7);
      graphics.lineBetween(x + 103, 52, x + 140, 108);
      graphics.lineBetween(x + 140, 108, x + 126, 172);
      graphics.lineBetween(x + 80, 130, x + 48, 190);
    }

    graphics.fillStyle(0xc7a34b, 0.86);
    graphics.fillRect(
      START_X,
      24,
      END_X - START_X,
      4
    );
    graphics.fillStyle(0x73e6ee, 0.48);
    graphics.fillRect(
      START_X,
      29,
      END_X - START_X,
      2
    );
  }

  private drawLowerBoxes(
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
      let x = START_X + 48;
      x < END_X;
      x += 208
    ) {
      graphics.fillStyle(0x22102b, 0.92);
      graphics.fillRoundedRect(x, 586, 112, 134, 10);
      graphics.lineStyle(2, 0x8f6d31, 0.52);
      graphics.strokeRoundedRect(x, 586, 112, 134, 10);
      graphics.fillStyle(0x68dce8, 0.32);
      graphics.fillCircle(x + 56, 638, 3);
    }
  }

  private drawRouteTelegraphs(
    scene: Phaser.Scene
  ): void {
    const graphics = scene.add.graphics();
    graphics.setDepth(2);

    for (const [x, y, width] of PLATFORMS) {
      graphics.fillStyle(0x1e1930, 1);
      graphics.fillRoundedRect(x, y, width, 16, 4);
      graphics.fillStyle(0x73e7ef, 1);
      graphics.fillRect(x, y, width, 3);
      graphics.lineStyle(1, 0xe461c0, 0.82);
      graphics.strokeRoundedRect(x, y, width, 16, 4);
    }

    for (const [x, y, height] of [
      [32752, 304, 176],
      [33376, 288, 240],
      [33888, 320, 192],
      [34848, 320, 160]
    ] as const) {
      graphics.fillStyle(0x16243a, 0.96);
      graphics.fillRect(x, y, 24, height);
      graphics.lineStyle(2, 0x70dfe9, 0.82);
      graphics.strokeRect(x, y, 24, height);
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
          color: "#f1ce69",
          backgroundColor: "#100815e8",
          padding: { x: 8, y: 6 }
        }
      ).setDepth(4);
    }

    scene.add.text(
      35024,
      250,
      "THE MIRROR CORE →",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#86e8ef",
        backgroundColor: "#100815e8",
        padding: { x: 8, y: 6 }
      }
    ).setDepth(4);
  }
}
