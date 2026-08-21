import Phaser from "phaser";

const START_X = 10464;
const END_X = 13744;

const LANDMARKS = [
  { x: 10528, title: "ACT III", detail: "THE MAIN STAGE" },
  { x: 10816, title: "OPENING MARK", detail: "HOLD THE APRON" },
  { x: 11456, title: "CROSSING", detail: "WATCH THE WINGS" },
  { x: 12160, title: "RIGGING", detail: "MIND THE FOOTLIGHTS" },
  { x: 12864, title: "FINALE", detail: "CONTROL THE ENSEMBLE" },
  { x: 13536, title: "CURTAIN CALL", detail: "GRAND GALLERY →" }
] as const;

const GATE_X = [10704, 12096, 13472] as const;
const HAZARD_X = [11616, 12144, 12736, 13040] as const;

export class MainStageVisuals {
  public constructor(scene: Phaser.Scene) {
    const backdrop = scene.add.graphics()
      .setDepth(-2)
      .setScrollFactor(1);

    backdrop.fillStyle(0x170a12, 0.92);
    backdrop.fillRect(START_X, 0, END_X - START_X, 326);

    for (let x = START_X; x < END_X; x += 320) {
      backdrop.fillStyle(
        Math.floor((x - START_X) / 320) % 2 === 0
          ? 0x431126
          : 0x26101c,
        0.94
      );
      backdrop.fillRect(x, 0, 160, 326);
      backdrop.fillStyle(0x09070d, 0.82);
      backdrop.fillRect(x + 160, 0, 160, 326);

      backdrop.lineStyle(2, 0xbd8733, 0.55);
      backdrop.lineBetween(x + 16, 0, x + 16, 326);
      backdrop.lineBetween(x + 304, 0, x + 304, 326);
    }

    backdrop.fillStyle(0xc4963f, 0.9);
    backdrop.fillRect(START_X, 24, END_X - START_X, 5);
    backdrop.fillStyle(0xf3cf6c, 0.55);
    backdrop.fillRect(START_X, 30, END_X - START_X, 2);

    for (let x = START_X + 112; x < END_X; x += 256) {
      backdrop.lineStyle(2, 0x8b682f, 0.9);
      backdrop.lineBetween(x, 0, x, 54);
      backdrop.fillStyle(0xf1c95c, 0.7);
      backdrop.fillCircle(x, 57, 5);
      backdrop.fillStyle(0xf2c95e, 0.025);
      backdrop.fillTriangle(
        x,
        62,
        x - 46,
        310,
        x + 46,
        310
      );
    }

    const foreground = scene.add.graphics()
      .setDepth(5)
      .setScrollFactor(1);

    foreground.fillStyle(0x6f172d, 0.95);
    foreground.fillRect(START_X, 312, END_X - START_X, 14);
    foreground.fillStyle(0xe2ad47, 1);
    foreground.fillRect(START_X, 312, END_X - START_X, 3);

    for (const x of GATE_X) {
      foreground.lineStyle(3, 0xd8a846, 0.85);
      foreground.strokeRoundedRect(x - 10, 34, 38, 292, 8);
      foreground.fillStyle(0xf1ca61, 0.75);
      foreground.fillTriangle(x - 6, 50, x + 9, 35, x + 24, 50);
    }

    for (const x of HAZARD_X) {
      foreground.fillStyle(0xe1ad48, 0.9);
      foreground.fillTriangle(x - 12, 307, x, 288, x + 12, 307);
      foreground.lineStyle(2, 0x1b0c12, 1);
      foreground.lineBetween(x, 294, x, 302);
      foreground.fillCircle(x, 305, 1.5);
    }

    for (const landmark of LANDMARKS) {
      scene.add.text(
        landmark.x,
        78,
        `${landmark.title}\n${landmark.detail}`,
        {
          align: "center",
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#f3d276",
          backgroundColor: "#160910dd",
          padding: { x: 8, y: 6 }
        }
      )
        .setOrigin(0.5, 0)
        .setDepth(9);
    }
  }
}
