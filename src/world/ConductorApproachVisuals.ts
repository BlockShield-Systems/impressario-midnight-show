import Phaser from "phaser";

const START_X = 39200;
const END_X = 44672;

const FLOORS = [
  [39200, 480, 400, 32],
  [39600, 512, 400, 32],
  [40000, 528, 416, 32],
  [40416, 496, 432, 32],
  [40848, 464, 432, 32],
  [41280, 496, 416, 32],
  [41696, 528, 448, 32],
  [42144, 496, 448, 32],
  [42592, 464, 432, 32],
  [43024, 496, 432, 32],
  [43456, 528, 448, 32],
  [43904, 496, 384, 32],
  [44288, 480, 384, 32]
] as const;

const PLATFORMS = [
  [39504, 368, 160],
  [39808, 320, 176],
  [40144, 384, 160],
  [40464, 336, 176],
  [40784, 288, 192],
  [41136, 352, 176],
  [41472, 304, 192],
  [41824, 368, 176],
  [42144, 320, 192],
  [42496, 272, 192],
  [42848, 336, 176],
  [43168, 288, 192],
  [43520, 352, 176],
  [43840, 304, 192],
  [44192, 352, 160],
  [44384, 288, 160],
  [44512, 400, 160]
] as const;

const LANDMARKS = [
  [39248, 104, "ACT IX · CONDUCTOR APPROACH", "THE CORE FALLS QUIET BEHIND YOU"],
  [40032, 224, "OVERTURE STAIRS", "FOLLOW THE RISING PHRASE"],
  [41296, 112, "ORCHESTRAL CORRIDOR", "LOW ROUTE · UPPER CADENCE"],
  [42608, 208, "FINAL CRESCENDO", "DOUBLE JUMP · DASH · LAND"],
  [43936, 112, "THE QUIET ANTECHAMBER", "THE PERFORMANCE BEGINS BEYOND THE DOOR"]
] as const;

export class ConductorApproachVisuals {
  public constructor(scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.setDepth(-80);
    background.fillStyle(0x07040d, 1);
    background.fillRect(
      START_X,
      0,
      END_X - START_X,
      720
    );

    this.drawOrchestralHall(background);
    this.drawAntechamber(background);
    this.drawRouteTelegraphs(scene);
    this.drawLandmarks(scene);
  }

  private drawOrchestralHall(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    for (
      let x = START_X;
      x < 43904;
      x += 320
    ) {
      const alternate =
        Math.floor((x - START_X) / 320) % 2 === 0;

      graphics.fillStyle(
        alternate ? 0x1d0b24 : 0x0b1426,
        0.96
      );
      graphics.fillRect(x, 0, 320, 560);

      graphics.fillStyle(0x2d1534, 0.94);
      graphics.fillRoundedRect(
        x + 24,
        54,
        272,
        182,
        30
      );
      graphics.lineStyle(3, 0xd2aa55, 0.74);
      graphics.strokeRoundedRect(
        x + 24,
        54,
        272,
        182,
        30
      );

      for (let line = 0; line < 5; line += 1) {
        graphics.lineStyle(1, 0xef78d7, 0.28);
        graphics.lineBetween(
          x + 48,
          92 + line * 24,
          x + 272,
          92 + line * 24
        );
      }

      const noteX = x + (alternate ? 104 : 200);
      graphics.fillStyle(0xf1cc6c, 0.72);
      graphics.fillCircle(noteX, 140, 9);
      graphics.fillRect(noteX + 7, 92, 3, 50);
      graphics.lineStyle(3, 0x77e7ef, 0.52);
      graphics.lineBetween(
        noteX + 9,
        94,
        noteX + 32,
        106
      );

      graphics.fillStyle(0x13091d, 1);
      graphics.fillTriangle(
        x + 32,
        560,
        x + 96,
        256,
        x + 160,
        560
      );
      graphics.fillTriangle(
        x + 160,
        560,
        x + 224,
        256,
        x + 288,
        560
      );
      graphics.lineStyle(2, 0xd0a64f, 0.48);
      graphics.lineBetween(
        x + 96,
        256,
        x + 96,
        560
      );
      graphics.lineBetween(
        x + 224,
        256,
        x + 224,
        560
      );
    }

    graphics.fillStyle(0x020207, 1);
    graphics.fillRect(
      START_X,
      560,
      END_X - START_X,
      160
    );

    for (
      let x = START_X + 48;
      x < END_X;
      x += 192
    ) {
      graphics.fillStyle(0x1d1027, 0.92);
      graphics.fillTriangle(
        x,
        688,
        x + 64,
        592,
        x + 128,
        688
      );
      graphics.lineStyle(1, 0xe264ca, 0.42);
      graphics.lineBetween(
        x,
        688,
        x + 64,
        592
      );
      graphics.lineStyle(1, 0x70dfe9, 0.36);
      graphics.lineBetween(
        x + 64,
        592,
        x + 128,
        688
      );
    }
  }

  private drawAntechamber(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    graphics.fillStyle(0x040309, 0.97);
    graphics.fillRect(
      43904,
      0,
      END_X - 43904,
      560
    );

    for (let x = 43936; x < END_X; x += 128) {
      const distance = (x - 43936) / 128;
      graphics.fillStyle(
        0x5c274f,
        Math.max(0.08, 0.34 - distance * 0.04)
      );
      graphics.fillRect(x, 52, 2, 430);
    }

    graphics.fillStyle(0x160c1d, 1);
    graphics.fillRoundedRect(
      44480,
      82,
      168,
      398,
      38
    );
    graphics.lineStyle(5, 0xd5ad58, 0.92);
    graphics.strokeRoundedRect(
      44480,
      82,
      168,
      398,
      38
    );
    graphics.lineStyle(2, 0xef6fd1, 0.64);
    graphics.strokeRoundedRect(
      44494,
      98,
      140,
      370,
      28
    );
    graphics.fillStyle(0x72e5ed, 0.82);
    graphics.fillCircle(44608, 284, 5);
  }

  private drawRouteTelegraphs(
    scene: Phaser.Scene
  ): void {
    const graphics = scene.add.graphics();
    graphics.setDepth(2);

    for (const [x, y, width, height] of FLOORS) {
      graphics.fillStyle(0x211226, 1);
      graphics.fillRoundedRect(
        x,
        y,
        width,
        height,
        4
      );
      graphics.fillStyle(0xd2aa55, 1);
      graphics.fillRect(x, y, width, 3);
      graphics.lineStyle(1, 0xe566cd, 0.72);
      graphics.strokeRoundedRect(
        x,
        y,
        width,
        height,
        4
      );
    }

    for (const [x, y, width] of PLATFORMS) {
      graphics.fillStyle(0x16243a, 1);
      graphics.fillRoundedRect(x, y, width, 16, 4);
      graphics.fillStyle(0x72e5ed, 1);
      graphics.fillRect(x, y, width, 3);
      graphics.lineStyle(1, 0xf0c75f, 0.82);
      graphics.strokeRoundedRect(x, y, width, 16, 4);
    }

    graphics.lineStyle(2, 0xd2aa55, 0.74);
    for (let x = 40000; x < 43904; x += 656) {
      graphics.lineBetween(x, 552, x + 240, 426);
      graphics.lineBetween(x + 240, 426, x + 432, 552);
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
          color: "#f2cc6d",
          backgroundColor: "#05030be8",
          padding: { x: 8, y: 6 }
        }
      ).setDepth(4);
    }

    scene.add.text(
      44448,
      236,
      "MIRROR CONDUCTOR →\nCROSS THE THRESHOLD TO BEGIN",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#83e9ef",
        backgroundColor: "#05030bf0",
        padding: { x: 8, y: 6 }
      }
    ).setDepth(4);
  }
}
