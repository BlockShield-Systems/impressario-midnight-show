import Phaser from "phaser";

const START_X = 23552;
const END_X = 27984;

const PLATFORMS = [
  [24160, 336, 192],
  [24480, 304, 192],
  [24800, 336, 224],
  [25152, 288, 192],
  [25472, 320, 208],
  [25952, 336, 176],
  [26240, 304, 176],
  [26752, 288, 176],
  [27104, 256, 176],
  [27456, 288, 176],
  [27744, 320, 160]
] as const;

const LANDMARKS = [
  [23584, 224, "SPOTLIGHT AWAKENS", "PRESS [K] TO CAST"],
  [24048, 386, "WRAITH VAULT", "CAST WITHIN THE LIGHT RING"],
  [24912, 210, "SHOW RESERVE", "ENERGY RECOVERS OVER TIME"],
  [25904, 386, "RELEASE GALLERY", "THE LOCK ANSWERS TO LIGHT"],
  [26704, 210, "VAULT ARCHIVE", "ASCEND TO THE SANCTUM"]
] as const;

export class SpotlightVaultVisuals {
  public constructor(scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.setDepth(-80);
    background.fillStyle(0x06131b, 1);
    background.fillRect(
      START_X,
      0,
      END_X - START_X,
      720
    );

    this.drawVaultWalls(background);
    this.drawLowerArchive(background);
    this.drawRouteTelegraphs(scene);
    this.drawLandmarks(scene);
  }

  private drawVaultWalls(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    for (
      let x = START_X;
      x < END_X;
      x += 256
    ) {
      graphics.fillStyle(0x102c38, 0.94);
      graphics.fillRoundedRect(
        x + 28,
        34,
        168,
        274,
        26
      );
      graphics.fillStyle(0x0a1c2a, 0.9);
      graphics.fillRect(x + 196, 0, 60, 420);

      graphics.lineStyle(3, 0xc3973e, 0.76);
      graphics.strokeRoundedRect(
        x + 28,
        34,
        168,
        274,
        26
      );
      graphics.lineStyle(2, 0x6de0e9, 0.42);
      graphics.strokeCircle(x + 112, 152, 43);
      graphics.strokeCircle(x + 112, 152, 25);

      for (let ray = 0; ray < 8; ray += 1) {
        const angle = ray / 8 * Math.PI * 2;
        graphics.lineBetween(
          x + 112 + Math.cos(angle) * 29,
          152 + Math.sin(angle) * 29,
          x + 112 + Math.cos(angle) * 50,
          152 + Math.sin(angle) * 50
        );
      }
    }

    graphics.fillStyle(0xd0a344, 0.9);
    graphics.fillRect(
      START_X,
      24,
      END_X - START_X,
      5
    );
    graphics.fillStyle(0x71e2eb, 0.72);
    graphics.fillRect(
      START_X,
      31,
      END_X - START_X,
      3
    );

    graphics.fillStyle(0xe8c65f, 0.16);
    graphics.fillCircle(23712, 250, 72);
    graphics.lineStyle(4, 0xf1ce68, 0.95);
    graphics.strokeCircle(23712, 250, 47);
    graphics.lineStyle(2, 0x78e7ef, 0.9);
    graphics.strokeCircle(23712, 250, 28);
  }

  private drawLowerArchive(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    graphics.fillStyle(0x02070c, 1);
    graphics.fillRect(
      START_X,
      480,
      END_X - START_X,
      240
    );

    for (
      let x = START_X + 64;
      x < END_X;
      x += 224
    ) {
      graphics.fillStyle(0x0b2230, 0.9);
      graphics.fillTriangle(
        x,
        688,
        x + 64,
        488,
        x + 132,
        688
      );
      graphics.lineStyle(1, 0x59cbd8, 0.22);
      graphics.lineBetween(
        x + 64,
        488,
        x + 64,
        688
      );
    }
  }

  private drawRouteTelegraphs(
    scene: Phaser.Scene
  ): void {
    const graphics = scene.add.graphics();
    graphics.setDepth(2);

    for (const [x, y, width] of PLATFORMS) {
      graphics.fillStyle(0x133343, 1);
      graphics.fillRoundedRect(
        x,
        y,
        width,
        16,
        4
      );
      graphics.fillStyle(0x75e7ef, 1);
      graphics.fillRect(x, y, width, 3);
      graphics.lineStyle(1, 0xe2bd58, 0.9);
      graphics.strokeRoundedRect(
        x,
        y,
        width,
        16,
        4
      );
    }

    const routePoints = [
      [23648, 336],
      [23936, 400],
      [24256, 320],
      [24576, 288],
      [24912, 320],
      [25248, 272],
      [25568, 304],
      [26040, 320],
      [26328, 288],
      [26840, 272],
      [27192, 240],
      [27544, 272],
      [27824, 304]
    ] as const;

    for (const [x, y] of routePoints) {
      graphics.fillStyle(0x75e7ef, 0.88);
      graphics.fillCircle(x, y, 3);
      graphics.lineStyle(1, 0xe4c35f, 0.78);
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
          color: "#9bf3f8",
          backgroundColor: "#06131be8",
          padding: { x: 8, y: 6 }
        }
      ).setDepth(4);
    }

    scene.add.text(
      27744,
      214,
      "THE CARD SANCTUM →",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f4d776",
        backgroundColor: "#06131be8",
        padding: { x: 8, y: 6 }
      }
    ).setDepth(4);
  }
}
