import Phaser from "phaser";

import type { CombatSystem } from "../combat/CombatSystem";
import { RoyalEchoSystem } from "../enemies/RoyalEchoSystem";
import type { MagicSystem } from "../magic/MagicSystem";
import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";
import type {
  GameplayActionIntentSource
} from "../runtime/GamepadInputController";
import { RoyalBoxHazardSystem } from "./RoyalBoxHazardSystem";
import { RoyalBoxSupportSystem } from "./RoyalBoxSupportSystem";
import {
  getWorldCheckpoint,
  getWorldGate,
  type WorldGateId
} from "./WorldGameplay";

const ENCOUNTER_TRIGGER_X = 32000;

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

export class RoyalBoxEncounterSystem {
  private readonly echoes: RoyalEchoSystem;
  private readonly hazards: RoyalBoxHazardSystem;
  private readonly supports: RoyalBoxSupportSystem;
  private readonly exitGate =
    createGate("RoyalBoxExit");

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
    magicSystem: MagicSystem,
    actionIntents: GameplayActionIntentSource,
    private readonly addSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void,
    private readonly removeSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void
  ) {
    this.echoes = new RoyalEchoSystem(
      scene,
      player,
      playerHealth,
      combatSystem
    );
    this.hazards = new RoyalBoxHazardSystem(
      scene,
      player,
      playerHealth
    );
    this.supports = new RoyalBoxSupportSystem(
      scene,
      player,
      playerHealth,
      combatSystem,
      magicSystem,
      actionIntents
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
        color: "#ffd9f7",
        backgroundColor: "#100815e8",
        padding: { x: 9, y: 6 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1180)
      .setVisible(false);

    this.titleText = scene.add.text(
      320,
      52,
      "ACT VII\nTHE FRACTURED ROYAL BOX",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#f17bd0",
        backgroundColor: "#100815ee",
        padding: { x: 16, y: 10 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1180)
      .setAlpha(0)
      .setVisible(false);

    this.addSolid(this.exitGate);
    this.redrawGate();
  }

  public update(deltaSeconds: number): void {
    this.echoes.update(deltaSeconds);
    this.hazards.update(deltaSeconds);
    this.supports.update(deltaSeconds);
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

    const remaining = this.echoes.remaining;

    this.objectiveText.setText([
      `ROYAL BOX — ECHOES ${4 - remaining}/4`,
      "Duelists rush. Prism Casters control the air."
    ]);

    if (remaining === 0) {
      this.completeEncounter();
    }
  }

  public resetAfterDeath(): void {
    this.removeSolid(this.exitGate);
    this.hazards.reset();
    this.supports.resetAfterDeath();

    if (this.cleared) {
      this.echoes.setEnabled(false);
      this.objectiveText
        .setVisible(false)
        .setText("");
      this.redrawGate();
      return;
    }

    this.active = false;
    this.echoes.resetEncounter();
    this.addSolid(this.exitGate);
    this.objectiveText
      .setVisible(false)
      .setText("");
    this.redrawGate();
  }

  private updateEntryCheckpoint(): void {
    const checkpoint =
      getWorldCheckpoint("RoyalBox");

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
    this.echoes.setEnabled(true);
    this.hazards.setEnabled(true);
    this.objectiveText
      .setText([
        "ROYAL BOX — ECHOES 0/4",
        "Duelists rush. Prism Casters control the air."
      ])
      .setVisible(true);
    this.redrawGate();
    this.scene.cameras.main.flash(
      180,
      220,
      76,
      187,
      false
    );
    this.scene.cameras.main.shake(120, 0.003);
  }

  private completeEncounter(): void {
    this.active = false;
    this.cleared = true;
    this.echoes.setEnabled(false);
    this.hazards.setEnabled(false);
    this.removeSolid(this.exitGate);
    this.redrawGate();

    this.objectiveText.setText(
      "ROYAL BOX CLEARED — THE MIRROR CORE OPENS"
    );
    this.scene.cameras.main.flash(
      320,
      230,
      92,
      202,
      false
    );
    this.scene.time.delayedCall(
      2800,
      () => this.objectiveText.setVisible(false)
    );
  }

  private redrawGate(): void {
    const g = this.gateGraphics;
    g.clear();

    if (this.cleared) {
      return;
    }

    g.fillStyle(0x100819, 0.97);
    g.fillRect(
      this.exitGate.x,
      this.exitGate.y,
      this.exitGate.width,
      this.exitGate.height
    );
    g.lineStyle(3, 0xe85fc5, 1);

    for (
      let y = 8;
      y < this.exitGate.height;
      y += 25
    ) {
      g.lineBetween(
        this.exitGate.x + 2,
        y,
        this.exitGate.right - 2,
        y + 15
      );
    }

    g.lineStyle(2, 0x77e5ed, 1);
    g.strokeRect(
      this.exitGate.x,
      this.exitGate.y,
      this.exitGate.width,
      this.exitGate.height
    );
  }
}
