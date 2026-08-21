import Phaser from "phaser";

const LANDMARKS = [
  { x: 5520, label: "ACT II", subtitle: "COMBAT REHEARSAL" },
  { x: 6240, label: "TECHNIQUE", subtitle: "STRIKE • LAUNCH • AIR" },
  { x: 7168, label: "MELEE", subtitle: "READ • EVADE • COUNTER" },
  { x: 8064, label: "RANGED", subtitle: "CLOSE THE DISTANCE" },
  { x: 9152, label: "ENSEMBLE", subtitle: "CONTROL THE STAGE" },
  { x: 10160, label: "CURTAIN", subtitle: "MAIN STAGE →" }
] as const;

export class CombatRehearsalVisuals {
  public constructor(scene: Phaser.Scene) {
    const scenery = scene.add.graphics().setDepth(2);

    for (let x = 5376; x < 10464; x += 256) {
      const alternate = Math.floor((x - 5376) / 256) % 2 === 0;
      scenery.fillStyle(alternate ? 0x6d1634 : 0x3b1027, 0.72);
      scenery.fillRoundedRect(x + 18, 76, 220, 214, 12);
      scenery.lineStyle(3, alternate ? 0xe1a64c : 0xb44771, 0.7);
      scenery.strokeRoundedRect(x + 18, 76, 220, 214, 12);
      scenery.lineBetween(x + 128, 76, x + 128, 290);
    }

    for (const landmark of LANDMARKS) {
      scenery.fillStyle(0x170913, 0.94);
      scenery.fillRoundedRect(landmark.x - 94, 92, 188, 54, 8);
      scenery.lineStyle(2, 0xe2ad52, 0.95);
      scenery.strokeRoundedRect(landmark.x - 94, 92, 188, 54, 8);

      scene.add.text(landmark.x, 101, landmark.label, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffe19a",
        align: "center"
      }).setOrigin(0.5, 0).setDepth(4);

      scene.add.text(landmark.x, 124, landmark.subtitle, {
        fontFamily: "monospace",
        fontSize: "7px",
        color: "#e8a8bf",
        align: "center"
      }).setOrigin(0.5, 0).setDepth(4);
    }

    for (const x of [7584, 8448, 9072]) {
      scenery.fillStyle(0xf0bd55, 0.22);
      scenery.fillTriangle(x - 36, 326, x, 270, x + 36, 326);
      scenery.lineStyle(2, 0xf0bd55, 0.75);
      scenery.lineBetween(x - 36, 326, x, 270);
      scenery.lineBetween(x, 270, x + 36, 326);
    }

    for (const x of [6672, 9664]) {
      scenery.fillStyle(0xe0608c, 0.18);
      scenery.fillRect(x - 10, 48, 38, 278);
      scenery.lineStyle(2, 0xf0bd55, 0.6);
      scenery.lineBetween(x + 9, 48, x + 9, 326);
    }
  }
}
