import Phaser from "phaser";

import type { CombatSystem } from "../combat/CombatSystem";
import { CardSentrySystem } from "../enemies/CardSentrySystem";
import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";
import { CardSanctumHazardSystem } from "./CardSanctumHazardSystem";
import {
  getWorldCheckpoint,
  getWorldGate,
  type WorldGateId
} from "./WorldGameplay";

const ENCOUNTER_TRIGGER_X = 28240;

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

export class CardSanctumEncounterSystem {
  private readonly sentries: CardSentrySystem;
  private readonly hazards: CardSanctumHazardSystem;
  private readonly exitGate =
    createGate("CardSanctumExit");

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
    private readonly addSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void,
    private readonly removeSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void
  ) {
    this.sentries = new CardSentrySystem(
      scene,
      player,
      playerHealth,
      combatSystem
    );

    this.hazards = new CardSanctumHazardSystem(
      scene,
      player,
      playerHealth
    );

    this.gateGraphics =
      scene.add.graphics().setDepth(30);

    this.objectiveText = scene.add.text(
      320,
      12,
      "",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffe29a",
        backgroundColor: "#130714e8",
        padding: { x: 9, y: 6 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1170)
      .setVisible(false);

    this.titleText = scene.add.text(
      320,
      52,
      "ACT VI\nTHE CARD SANCTUM",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#f1ce69",
        backgroundColor: "#130714ee",
        padding: { x: 16, y: 10 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1170)
      .setAlpha(0)
      .setVisible(false);

    this.addSolid(this.exitGate);
    this.redrawGate();
  }

  public update(deltaSeconds: number): void {
    this.sentries.update(deltaSeconds);
    this.hazards.update(deltaSeconds);
    this.updateEntryCheckpoint();

    if (
      !this.active &&
      !this.cleared &&
      this.player.x >= ENCOUNTER_TRIGGER_X
    ) {
      this.startEncounter();
    }

    if (!this.active) {
      return;
    }

    const remaining = this.sentries.remaining;

    this.objectiveText.setText([
      `CARD SANCTUM — SENTRIES ${3 - remaining}/3`,
      "Choose the safe route. Break every sentry."
    ]);

    if (remaining === 0) {
      this.completeEncounter();
    }
  }

  public resetAfterDeath(): void {
    this.removeSolid(this.exitGate);
    this.hazards.reset();

    if (this.cleared) {
      this.sentries.setEnabled(false);
      this.objectiveText
        .setVisible(false)
        .setText("");
      this.redrawGate();
      return;
    }

    this.active = false;
    this.sentries.resetEncounter();
    this.addSolid(this.exitGate);
    this.objectiveText
      .setVisible(false)
      .setText("");
    this.redrawGate();
  }

  private updateEntryCheckpoint(): void {
    const checkpoint =
      getWorldCheckpoint("CardSanctum");

    if (
      this.entered ||
      this.player.x < checkpoint.triggerX
    ) {
      return;
    }

    this.entered = true;
    this.playerHealth.setCheckpoint(checkpoint);

    this.titleText
      .setVisible(true)
      .setAlpha(1);

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
    this.sentries.setEnabled(true);
    this.hazards.setEnabled(true);
    this.objectiveText
      .setText([
        "CARD SANCTUM — SENTRIES 0/3",
        "Choose the safe route. Break every sentry."
      ])
      .setVisible(true);
    this.redrawGate();
    this.scene.cameras.main.flash(
      180,
      211,
      164,
      65,
      false
    );
    this.scene.cameras.main.shake(120, 0.003);
  }

  private completeEncounter(): void {
    this.active = false;
    this.cleared = true;
    this.sentries.setEnabled(false);
    this.hazards.setEnabled(false);
    this.removeSolid(this.exitGate);
    this.redrawGate();

    this.objectiveText.setText(
      "CARD SANCTUM CLEARED — THE ROYAL BOX AWAITS"
    );
    this.scene.cameras.main.flash(
      300,
      224,
      180,
      76,
      false
    );
    this.scene.time.delayedCall(
      2600,
      () => this.objectiveText.setVisible(false)
    );
  }

  private redrawGate(): void {
    const g = this.gateGraphics;
    g.clear();

    if (this.cleared) {
      return;
    }

    g.fillStyle(0x1d0819, 0.97);
    g.fillRect(
      this.exitGate.x,
      this.exitGate.y,
      this.exitGate.width,
      this.exitGate.height
    );
    g.lineStyle(3, 0xd83b6a, 1);

    for (
      let y = 8;
      y < this.exitGate.height;
      y += 24
    ) {
      g.lineBetween(
        this.exitGate.x + 2,
        y,
        this.exitGate.right - 2,
        y + 14
      );
    }

    g.lineStyle(2, 0xe4ba55, 1);
    g.strokeRect(
      this.exitGate.x,
      this.exitGate.y,
      this.exitGate.width,
      this.exitGate.height
    );
  }
}
