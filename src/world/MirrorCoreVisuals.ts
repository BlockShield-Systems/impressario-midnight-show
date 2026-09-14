import Phaser from "phaser";

const START_X = 35344;
const END_X = 39200;

const FLOORS = [
  [35344, 480, 304, 32],
  [35648, 528, 320, 32],
  [35968, 480, 224, 32],
  [36210, 512, 320, 32],
  [36530, 480, 302, 32],
  [36832, 512, 320, 32],
  [37152, 480, 192, 32],
  [37362, 480, 430, 32],
  [37792, 528, 448, 32],
  [38258, 480, 462, 32],
  [38720, 512, 352, 32],
  [39090, 480, 110, 32]
] as const;

const PLATFORMS = [
  [35456, 384, 160],
  [35648, 304, 144],
  [35808, 400, 160],
  [36000, 272, 160],
  [36256, 384, 176],
  [36544, 336, 176],
  [36848, 368, 176],
  [37136, 320, 192],
  [37424, 352, 192],
  [37744, 304, 208],
  [38064, 368, 176],
  [38384, 320, 192],
  [38688, 368, 176],
  [38944, 304, 128]
] as const;

const LANDMARKS = [
  [35392, 92, "REFRACTION THRESHOLD", "GRAND CARD [L] POWERS THE RELAYS"],
  [35632, 214, "MIRROR ASCENT", "MOVE BETWEEN THE BEAM WINDOWS"],
  [36240, 92, "KALEIDOSCOPE GAUNTLET", "BREAK FOUR CORE REFLECTIONS"],
  [37408, 236, "STABILIZATION WALK", "CORE CHECKPOINT · RECOVERY ROUTES"],
  [38912, 214, "EASTERN SEAL", "STABILIZE THE CORE TO RELEASE THE EXIT"]
] as const;

export class MirrorCoreVisuals {
  public constructor(scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.setDepth(-80);
    background.fillStyle(0x030711, 1);
    background.fillRect(
      START_X,
      0,
      END_X - START_X,
      720
    );

    this.drawRefractionChambers(background);
    this.drawLowerCore(background);
    this.drawRouteTelegraphs(scene);
    this.drawLandmarks(scene);
  }

  private drawRefractionChambers(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    for (
      let x = START_X;
      x < END_X;
      x += 256
    ) {
      const alternate =
        Math.floor((x - START_X) / 256) % 2 === 0;

      graphics.fillStyle(
        alternate ? 0x081a2d : 0x210b2c,
        0.94
      );
      graphics.fillTriangle(
        x,
        0,
        x + 256,
        0,
        x + 128,
        560
      );
      graphics.lineStyle(
        2,
        alternate ? 0x72e8ef : 0xe15dc7,
        0.28
      );
      graphics.lineBetween(
        x + 128,
        28,
        x + 128,
        552
      );

      graphics.fillStyle(0x111a31, 0.96);
      graphics.fillRoundedRect(
        x + 58,
        54,
        140,
        154,
        22
      );
      graphics.lineStyle(3, 0xcba84f, 0.82);
      graphics.strokeRoundedRect(
        x + 58,
        54,
        140,
        154,
        22
      );
      graphics.lineStyle(2, 0x75eaf1, 0.62);
      graphics.lineBetween(
        x + 128,
        60,
        x + 96,
        130
      );
      graphics.lineBetween(
        x + 96,
        130,
        x + 156,
        198
      );
      graphics.lineStyle(2, 0xe95acb, 0.62);
      graphics.lineBetween(
        x + 128,
        60,
        x + 166,
        120
      );
      graphics.lineBetween(
        x + 166,
        120,
        x + 112,
        202
      );
    }

    graphics.fillStyle(0xcba84f, 0.86);
    graphics.fillRect(
      START_X,
      24,
      END_X - START_X,
      4
    );
    graphics.fillStyle(0x73e6ee, 0.5);
    graphics.fillRect(
      START_X,
      29,
      END_X - START_X,
      2
    );
  }

  private drawLowerCore(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    graphics.fillStyle(0x05040b, 1);
    graphics.fillRect(
      START_X,
      560,
      END_X - START_X,
      160
    );

    for (
      let x = START_X + 40;
      x < END_X;
      x += 176
    ) {
      graphics.fillStyle(0x16102b, 0.92);
      graphics.fillTriangle(
        x,
        688,
        x + 68,
        582,
        x + 136,
        688
      );
      graphics.lineStyle(2, 0x6fdfe9, 0.36);
      graphics.lineBetween(
        x,
        688,
        x + 68,
        582
      );
      graphics.lineStyle(2, 0xe05ebd, 0.36);
      graphics.lineBetween(
        x + 68,
        582,
        x + 136,
        688
      );
    }
  }

  private drawRouteTelegraphs(
    scene: Phaser.Scene
  ): void {
    const graphics = scene.add.graphics();
    graphics.setDepth(2);

    for (const [x, y, width, height] of FLOORS) {
      graphics.fillStyle(0x19172b, 1);
      graphics.fillRoundedRect(
        x,
        y,
        width,
        height,
        4
      );
      graphics.fillStyle(0xc9a84e, 1);
      graphics.fillRect(x, y, width, 3);
      graphics.lineStyle(1, 0x75eaf1, 0.7);
      graphics.strokeRoundedRect(
        x,
        y,
        width,
        height,
        4
      );
    }

    for (const [x, y, width] of PLATFORMS) {
      graphics.fillStyle(0x14233a, 1);
      graphics.fillRoundedRect(x, y, width, 16, 4);
      graphics.fillStyle(0x75eaf1, 1);
      graphics.fillRect(x, y, width, 3);
      graphics.lineStyle(1, 0xe65bc9, 0.86);
      graphics.strokeRoundedRect(x, y, width, 16, 4);
    }

    for (const [x, y, height] of [
      [36320, 288, 224],
      [38192, 288, 240]
    ] as const) {
      graphics.fillStyle(0x15263b, 0.98);
      graphics.fillRect(x, y, 24, height);
      graphics.lineStyle(2, 0x70dfe9, 0.88);
      graphics.strokeRect(x, y, 24, height);
      graphics.lineStyle(1, 0xe15dc7, 0.74);
      graphics.lineBetween(
        x,
        y + height * 0.25,
        x + 24,
        y + height * 0.5
      );
      graphics.lineBetween(
        x + 24,
        y + height * 0.5,
        x,
        y + height * 0.75
      );
    }
  }

  private drawLandmarks(
    scene: Phaser.Scene
  ): void {
    for (const [x, y, title, detail] of LANDMARKS) {
      scene.add.text(
        x,
        y,
        [title, detail].join("\n"),
        {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#f1ce69",
          backgroundColor: "#050713e8",
          padding: { x: 8, y: 6 }
        }
      ).setDepth(4);
    }

    scene.add.text(
      38960,
      258,
      "CONDUCTOR APPROACH →",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#86e8ef",
        backgroundColor: "#050713e8",
        padding: { x: 8, y: 6 }
      }
    ).setDepth(4);
  }
}
