import Phaser from "phaser";

import type { CombatSystem } from "../combat/CombatSystem";
import { LightWraithSystem } from "../enemies/LightWraithSystem";
import type { MagicSystem } from "../magic/MagicSystem";
import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";
import {
  getWorldCheckpoint,
  getWorldGate,
  type WorldGateId
} from "./WorldGameplay";

const ENCOUNTER_TRIGGER_X = 24032;

const createGate = (
  id: WorldGateId
): Phaser.Geom.Rectangle => {
  const gate = getWorldGate(id);

  return new Phaser.Geom.Rectangle(
    gate.x,
    gate.y,
    gate.width,
    gate.height
  );
};

export class SpotlightVaultEncounterSystem {
  private readonly wraiths: LightWraithSystem;

  private readonly leftGate =
    createGate("SpotlightVaultLeft");
  private readonly rightGate =
    createGate("SpotlightVaultRight");

  private readonly gateGraphics:
    Phaser.GameObjects.Graphics;
  private readonly objectiveText:
    Phaser.GameObjects.Text;
  private readonly titleText:
    Phaser.GameObjects.Text;

  private entered = false;
  private active = false;
  private cleared = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    combatSystem: CombatSystem,
    private readonly magicSystem: MagicSystem,
    private readonly addSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void,
    private readonly removeSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void
  ) {
    this.wraiths = new LightWraithSystem(
      scene,
      player,
      playerHealth,
      combatSystem
    );

    this.gateGraphics =
      scene.add.graphics().setDepth(30);

    this.objectiveText = scene.add.text(
      320,
      12,
      "",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#c8f9ff",
        backgroundColor: "#06131be8",
        padding: { x: 9, y: 6 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1160)
      .setVisible(false);

    this.titleText = scene.add.text(
      320,
      52,
      "ACT VI\nTHE SPOTLIGHT VAULT",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#9bf3f8",
        backgroundColor: "#06131bee",
        padding: { x: 16, y: 10 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1160)
      .setAlpha(0)
      .setVisible(false);

    this.addSolid(this.rightGate);
    this.redrawGates();
  }

  public applySpotlight(
    centerX: number,
    centerY: number,
    radius: number
  ): {
    targetsHit: number;
    targetsDefeated: number;
  } {
    return this.wraiths.applySpotlight(
      centerX,
      centerY,
      radius
    );
  }

  public update(deltaSeconds: number): void {
    this.wraiths.update(deltaSeconds);
    this.updateEntryCheckpoint();

    if (
      !this.active &&
      !this.cleared &&
      this.entered &&
      this.player.x >= ENCOUNTER_TRIGGER_X
    ) {
      this.startEncounter();
    }

    if (!this.active) {
      return;
    }

    const remaining = this.wraiths.remaining;

    this.objectiveText.setText([
      `SPOTLIGHT PRACTICE — WRAITHS ${2 - remaining}/2`,
      "Press [K] within range. SHOW recovers over time."
    ]);

    if (remaining === 0) {
      this.completeEncounter();
    }
  }

  public resetAfterDeath(): void {
    this.wraiths.resetEncounter();
    this.magicSystem.resetEncounter();
    this.removeSolid(this.leftGate);
    this.removeSolid(this.rightGate);

    if (this.cleared) {
      this.objectiveText
        .setVisible(false)
        .setText("");
      this.redrawGates();
      return;
    }

    this.active = false;
    this.addSolid(this.rightGate);
    this.objectiveText
      .setVisible(false)
      .setText("");
    this.redrawGates();
  }

  private updateEntryCheckpoint(): void {
    const checkpoint =
      getWorldCheckpoint("SpotlightVault");

    if (
      this.entered ||
      this.player.x < checkpoint.triggerX
    ) {
      return;
    }

    this.entered = true;
    this.playerHealth.setCheckpoint(checkpoint);
    this.magicSystem.unlock();

    this.titleText
      .setVisible(true)
      .setAlpha(1);

    this.scene.cameras.main.flash(
      280,
      118,
      230,
      239,
      false
    );

    this.scene.tweens.add({
      targets: this.titleText,
      alpha: 0,
      delay: 1500,
      duration: 850,
      ease: "Sine.InOut",
      onComplete: () =>
        this.titleText.setVisible(false)
    });
  }

  private startEncounter(): void {
    this.active = true;
    this.addSolid(this.leftGate);
    this.addSolid(this.rightGate);
    this.wraiths.setEnabled(true);
    this.objectiveText
      .setText([
        "SPOTLIGHT PRACTICE — WRAITHS 0/2",
        "Press [K] within range. SHOW recovers over time."
      ])
      .setVisible(true);
    this.redrawGates();
    this.scene.cameras.main.flash(
      180,
      82,
      194,
      220,
      false
    );
    this.scene.cameras.main.shake(120, 0.003);
  }

  private completeEncounter(): void {
    this.active = false;
    this.cleared = true;
    this.wraiths.setEnabled(false);
    this.removeSolid(this.leftGate);
    this.removeSolid(this.rightGate);
    this.redrawGates();

    this.objectiveText.setText(
      "SPOTLIGHT MASTERED — THE VAULT IS OPEN"
    );
    this.scene.cameras.main.flash(
      300,
      242,
      210,
      104,
      false
    );
    this.scene.time.delayedCall(
      2400,
      () => this.objectiveText.setVisible(false)
    );
  }

  private redrawGates(): void {
    const g = this.gateGraphics;
    g.clear();

    const gates = [
      ...(this.active ? [this.leftGate] : []),
      ...(!this.cleared ? [this.rightGate] : [])
    ];

    for (const gate of gates) {
      g.fillStyle(0x071720, 0.96);
      g.fillRect(
        gate.x,
        gate.y,
        gate.width,
        gate.height
      );
      g.lineStyle(3, 0x72e2eb, 1);

      for (
        let y = 8;
        y < gate.height;
        y += 24
      ) {
        g.lineBetween(
          gate.x + 2,
          y,
          gate.right - 2,
          y + 14
        );
      }

      g.lineStyle(2, 0xe7c45d, 1);
      g.strokeRect(
        gate.x,
        gate.y,
        gate.width,
        gate.height
      );
    }
  }
}
