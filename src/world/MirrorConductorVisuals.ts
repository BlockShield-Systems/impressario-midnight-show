import Phaser from "phaser";

const START_X = 44672;
const END_X = 49824;

const PLATFORMS = [
  [45472, 400, 256],
  [46048, 352, 256],
  [46624, 416, 256],
  [47200, 352, 288],
  [47840, 416, 256],
  [48416, 352, 256],
  [48992, 400, 256]
] as const;

export class MirrorConductorVisuals {
  public constructor(scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.setDepth(-80);
    background.fillStyle(0x03040c, 1);
    background.fillRect(START_X, 0, END_X - START_X, 720);

    for (let x = START_X; x < END_X; x += 384) {
      const alternate = Math.floor((x - START_X) / 384) % 2 === 0;
      background.fillStyle(alternate ? 0x111b35 : 0x2a0c32, 0.88);
      background.fillTriangle(x, 0, x + 384, 0, x + 192, 620);
      background.lineStyle(2, alternate ? 0x75eaf1 : 0xe95acb, 0.28);
      background.lineBetween(x + 192, 0, x + 192, 620);
    }

    for (let x = 45312; x < 49344; x += 576) {
      background.lineStyle(5, 0xd8b454, 0.55);
      background.strokeCircle(x, 154, 72);
      background.lineStyle(2, 0x75eaf1, 0.55);
      background.strokeCircle(x, 154, 50);
      for (let ray = 0; ray < 12; ray += 1) {
        const angle = ray / 12 * Math.PI * 2;
        background.lineBetween(
          x + Math.cos(angle) * 24,
          154 + Math.sin(angle) * 24,
          x + Math.cos(angle) * 68,
          154 + Math.sin(angle) * 68
        );
      }
    }

    const route = scene.add.graphics().setDepth(2);
    route.fillStyle(0x0a1727, 0.94);
    route.fillRect(44672, 480, 448, 32);
    route.fillRect(45120, 520, 4224, 32);
    route.fillRect(49344, 480, 480, 32);
    route.lineStyle(3, 0xe4b84f, 0.9);
    route.strokeRect(45120, 520, 4224, 32);

    for (const [x, y, width] of PLATFORMS) {
      route.fillStyle(0x10263b, 0.96);
      route.fillRect(x, y, width, 16);
      route.lineStyle(2, 0x75eaf1, 0.88);
      route.strokeRect(x, y, width, 16);
    }

    route.lineStyle(5, 0xe95acb, 0.75);
    route.strokeRect(45120, 96, 4224, 456);
    route.lineStyle(4, 0xe4b84f, 0.9);
    route.strokeRoundedRect(49648, 176, 128, 320, 38);

    const labels = [
      [44720, 112, "ACT X · MIRROR CONDUCTOR\nSAFE CHECKPOINT · CROSS WHEN READY"],
      [45200, 208, "THE FINAL PERFORMANCE\nSPOTLIGHT BREAKS THE REFLECTED SHIELD"],
      [47040, 208, "THREE MOVEMENTS\nREAD THE BEAMS · HOLD THE RHYTHM"],
      [48864, 208, "FINAL CADENCE\nTHE RESOLUTION OPENS AFTER DEFEAT"],
      [49520, 104, "CURTAIN GATE →\nTHE WORLD ENDS IN LIGHT"]
    ] as const;

    for (const [x, y, text] of labels) {
      scene.add.text(x, y, text, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f5d878",
        backgroundColor: "#040711e6",
        padding: { x: 8, y: 6 }
      }).setDepth(4);
    }
  }
}
