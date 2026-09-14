import Phaser from "phaser";

import { CardThrowerSystem } from "../enemies/CardThrowerSystem";
import { StagehandSystem } from "../enemies/StagehandSystem";
import type { CombatSystem } from "../combat/CombatSystem";
import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";
import {
  getWorldCheckpoint,
  getWorldGate,
  type WorldGateId
} from "./WorldGameplay";
import { MainStageHazardSystem } from "./MainStageHazardSystem";

const START_TRIGGER_X = 10736;

const createGate = (id: WorldGateId): Phaser.Geom.Rectangle => {
  const gate = getWorldGate(id);

  return new Phaser.Geom.Rectangle(
    gate.x,
    gate.y,
    gate.width,
    gate.height
  );
};

export class MainStageEncounterSystem {
  private readonly openingStagehand: StagehandSystem;
  private readonly crossingStagehands: StagehandSystem;
  private readonly crossingThrowers: CardThrowerSystem;
  private readonly finaleStagehands: StagehandSystem;
  private readonly finaleThrowers: CardThrowerSystem;
  private readonly hazards: MainStageHazardSystem;

  private readonly leftGate = createGate("MainStageLeft");
  private readonly waveGate = createGate("MainStageWave");
  private readonly exitGate = createGate("MainStageExit");

  private readonly gateGraphics: Phaser.GameObjects.Graphics;
  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;

  private phase = 0;
  private cleared = false;
  private entryCheckpointActivated = false;
  private clearCheckpointActivated = false;

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
    this.openingStagehand = new StagehandSystem(
      scene,
      player,
      playerHealth,
      combatSystem,
      ["MainStageStagehandA"]
    );

    this.crossingStagehands = new StagehandSystem(
      scene,
      player,
      playerHealth,
      combatSystem,
      ["MainStageStagehandB"]
    );

    this.crossingThrowers = new CardThrowerSystem(
      scene,
      player,
      playerHealth,
      combatSystem,
      ["MainStageCardThrowerA"]
    );

    this.finaleStagehands = new StagehandSystem(
      scene,
      player,
      playerHealth,
      combatSystem,
      ["MainStageStagehandC", "MainStageStagehandD"]
    );

    this.finaleThrowers = new CardThrowerSystem(
      scene,
      player,
      playerHealth,
      combatSystem,
      ["MainStageCardThrowerB"]
    );

    this.hazards = new MainStageHazardSystem(
      scene,
      player,
      playerHealth
    );

    this.gateGraphics = scene.add.graphics().setDepth(30);
    this.objectiveText = scene.add.text(
      320,
      12,
      "",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffe6a1",
        backgroundColor: "#170a11e8",
        padding: { x: 9, y: 6 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1050)
      .setVisible(false);

    this.titleText = scene.add.text(
      320,
      52,
      "ACT III\nTHE MAIN STAGE",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#f2cd69",
        backgroundColor: "#170a11ee",
        padding: { x: 16, y: 10 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1050)
      .setAlpha(0)
      .setVisible(false);

    this.addSolid(this.exitGate);
    this.redrawGates();
  }

  public update(deltaSeconds: number): void {
    this.openingStagehand.update(deltaSeconds);
    this.crossingStagehands.update(deltaSeconds);
    this.crossingThrowers.update(deltaSeconds);
    this.finaleStagehands.update(deltaSeconds);
    this.finaleThrowers.update(deltaSeconds);
    this.hazards.update(deltaSeconds);

    this.updateCheckpoints();

    if (
      this.phase === 0 &&
      !this.cleared &&
      this.player.x >= START_TRIGGER_X
    ) {
      this.startEncounter();
    }

    if (this.phase === 1) {
      this.updateOpening();
    } else if (this.phase === 2) {
      this.updateCrossing();
    } else if (this.phase === 3) {
      this.updateFinale();
    }
  }

  public resetAfterDeath(): void {
    this.openingStagehand.resetEncounter();
    this.crossingStagehands.resetEncounter();
    this.crossingThrowers.resetEncounter();
    this.finaleStagehands.resetEncounter();
    this.finaleThrowers.resetEncounter();
    this.hazards.reset();

    if (this.cleared) {
      return;
    }

    this.phase = 0;
    this.removeSolid(this.leftGate);
    this.removeSolid(this.waveGate);
    this.addSolid(this.exitGate);
    this.objectiveText.setVisible(false).setText("");
    this.redrawGates();
  }

  private updateCheckpoints(): void {
    const entryCheckpoint = getWorldCheckpoint("MainStage");

    if (
      !this.entryCheckpointActivated &&
      this.player.x >= entryCheckpoint.triggerX
    ) {
      this.entryCheckpointActivated = true;
      this.playerHealth.setCheckpoint(entryCheckpoint);

      this.titleText.setVisible(true).setAlpha(1);
      this.scene.tweens.add({
        targets: this.titleText,
        alpha: 0,
        delay: 1500,
        duration: 850,
        ease: "Sine.InOut",
        onComplete: () => this.titleText.setVisible(false)
      });
    }

    const clearCheckpoint = getWorldCheckpoint("MainStageClear");

    if (
      this.cleared &&
      !this.clearCheckpointActivated &&
      this.player.x >= clearCheckpoint.triggerX
    ) {
      this.clearCheckpointActivated = true;
      this.playerHealth.setCheckpoint(clearCheckpoint);
    }
  }

  private startEncounter(): void {
    this.phase = 1;
    this.addSolid(this.leftGate);
    this.addSolid(this.waveGate);
    this.openingStagehand.setEncounterActive(true);
    this.objectiveText
      .setText("MAIN STAGE AMBUSH — OPENING MARK   0/1")
      .setVisible(true);
    this.redrawGates();
    this.scene.cameras.main.flash(180, 116, 26, 48, false);
    this.scene.cameras.main.shake(120, 0.003);
  }

  private updateOpening(): void {
    const remaining = this.openingStagehand.remaining;
    this.objectiveText.setText(
      `MAIN STAGE AMBUSH — OPENING MARK   ${1 - remaining}/1`
    );

    if (remaining !== 0) {
      return;
    }

    this.phase = 2;
    this.crossingStagehands.setEncounterActive(true);
    this.crossingThrowers.setEncounterActive(true);
    this.objectiveText.setText(
      "MAIN STAGE AMBUSH — CROSSING CUE   0/2"
    );
    this.scene.cameras.main.flash(140, 224, 162, 58, false);
  }

  private updateCrossing(): void {
    const total =
      this.crossingStagehands.total +
      this.crossingThrowers.total;
    const remaining =
      this.crossingStagehands.remaining +
      this.crossingThrowers.remaining;

    this.objectiveText.setText(
      `MAIN STAGE AMBUSH — CROSSING CUE   ${total - remaining}/${total}`
    );

    if (remaining !== 0) {
      return;
    }

    this.phase = 3;
    this.removeSolid(this.waveGate);
    this.finaleStagehands.setEncounterActive(true);
    this.finaleThrowers.setEncounterActive(true);
    this.hazards.setEnabled(true);
    this.redrawGates();
    this.objectiveText.setText(
      "MAIN STAGE AMBUSH — FINALE   0/3"
    );
    this.scene.cameras.main.flash(180, 239, 193, 83, false);
  }

  private updateFinale(): void {
    const total =
      this.finaleStagehands.total +
      this.finaleThrowers.total;
    const remaining =
      this.finaleStagehands.remaining +
      this.finaleThrowers.remaining;

    this.objectiveText.setText(
      `MAIN STAGE AMBUSH — FINALE   ${total - remaining}/${total}`
    );

    if (remaining !== 0) {
      return;
    }

    this.completeEncounter();
  }

  private completeEncounter(): void {
    this.phase = 0;
    this.cleared = true;
    this.hazards.setEnabled(false);
    this.removeSolid(this.leftGate);
    this.removeSolid(this.waveGate);
    this.removeSolid(this.exitGate);
    this.redrawGates();

    this.objectiveText.setText(
      "MAIN STAGE CLEAR — TAKE THE CURTAIN CALL"
    );
    this.scene.cameras.main.flash(260, 242, 201, 94, false);
    this.scene.time.delayedCall(
      2400,
      () => this.objectiveText.setVisible(false)
    );
  }

  private redrawGates(): void {
    const g = this.gateGraphics;
    g.clear();

    const gates = [
      ...(this.phase > 0 ? [this.leftGate] : []),
      ...(this.phase === 1 || this.phase === 2
        ? [this.waveGate]
        : []),
      ...(!this.cleared ? [this.exitGate] : [])
    ];

    for (const gate of gates) {
      g.fillStyle(0x210b14, 0.95);
      g.fillRect(gate.x, gate.y, gate.width, gate.height);
      g.lineStyle(3, 0xd7a647, 1);

      for (let y = 0; y < gate.height; y += 24) {
        g.lineBetween(
          gate.x + 3,
          y,
          gate.right - 3,
          y + 16
        );
      }

      g.lineStyle(2, 0xf0c95e, 0.95);
      g.strokeRect(gate.x, gate.y, gate.width, gate.height);
    }
  }
}
