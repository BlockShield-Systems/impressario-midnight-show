import Phaser from "phaser";

import type { CombatSystem } from "../combat/CombatSystem";
import { ShadowAcrobatSystem } from "../enemies/ShadowAcrobatSystem";
import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";
import { GalleryHazardSystem } from "./GalleryHazardSystem";
import {
  getWorldCheckpoint,
  getWorldGate,
  type WorldGateId
} from "./WorldGameplay";

const FIRST_DUEL_TRIGGER_X = 19936;
const SECOND_DUEL_TRIGGER_X = 21120;

type GauntletPhase =
  | "approach"
  | "first-duel"
  | "crossing"
  | "second-duel"
  | "cleared";

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

export class GalleryGauntletEncounterSystem {
  private readonly firstDuel: ShadowAcrobatSystem;
  private readonly secondDuel: ShadowAcrobatSystem;
  private readonly hazards: GalleryHazardSystem;

  private readonly leftGate =
    createGate("GalleryGauntletLeft");
  private readonly midpointGate =
    createGate("GalleryGauntletMid");
  private readonly secondLeftGate =
    createGate("GalleryGauntletSecondLeft");
  private readonly exitGate =
    createGate("GalleryGauntletExit");

  private readonly gateGraphics:
    Phaser.GameObjects.Graphics;
  private readonly objectiveText:
    Phaser.GameObjects.Text;
  private readonly titleText:
    Phaser.GameObjects.Text;

  private phase: GauntletPhase = "approach";
  private entered = false;
  private midpointActivated = false;

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
    this.firstDuel = new ShadowAcrobatSystem(
      scene,
      player,
      playerHealth,
      combatSystem,
      ["GalleryShadowAcrobatA"]
    );

    this.secondDuel = new ShadowAcrobatSystem(
      scene,
      player,
      playerHealth,
      combatSystem,
      ["GalleryShadowAcrobatB"]
    );

    this.hazards = new GalleryHazardSystem(
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
        color: "#a9f4fa",
        backgroundColor: "#050914e8",
        padding: { x: 9, y: 6 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1150)
      .setVisible(false);

    this.titleText = scene.add.text(
      320,
      52,
      "ACT V\nTHE GALLERY GAUNTLET",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8beaf1",
        backgroundColor: "#050914ee",
        padding: { x: 16, y: 10 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1150)
      .setAlpha(0)
      .setVisible(false);

    this.addSolid(this.midpointGate);
    this.addSolid(this.exitGate);
    this.redrawGates();
  }

  public update(deltaSeconds: number): void {
    this.firstDuel.update(deltaSeconds);
    this.secondDuel.update(deltaSeconds);
    this.hazards.update(deltaSeconds);

    this.updateEntryCheckpoint();

    if (
      this.phase === "approach" &&
      this.player.x >= FIRST_DUEL_TRIGGER_X
    ) {
      this.startFirstDuel();
    }

    if (this.phase === "first-duel") {
      this.updateFirstDuel();
    } else if (this.phase === "crossing") {
      this.updateCrossing();
    } else if (this.phase === "second-duel") {
      this.updateSecondDuel();
    }
  }

  public resetAfterDeath(): void {
    this.firstDuel.resetEncounter();
    this.secondDuel.resetEncounter();
    this.hazards.reset();

    this.removeSolid(this.leftGate);
    this.removeSolid(this.midpointGate);
    this.removeSolid(this.secondLeftGate);
    this.removeSolid(this.exitGate);

    if (this.phase === "cleared") {
      this.objectiveText
        .setVisible(false)
        .setText("");
      this.redrawGates();
      return;
    }

    this.addSolid(this.exitGate);

    if (this.midpointActivated) {
      this.phase = "crossing";
      this.hazards.setEnabled(true);
      this.objectiveText
        .setText(
          "GALLERY GAUNTLET — CROSS THE FRACTURED RHYTHM"
        )
        .setVisible(true);
    } else {
      this.phase = "approach";
      this.addSolid(this.midpointGate);
      this.objectiveText
        .setVisible(false)
        .setText("");
    }

    this.redrawGates();
  }

  private updateEntryCheckpoint(): void {
    const checkpoint =
      getWorldCheckpoint("GalleryGauntlet");

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

  private startFirstDuel(): void {
    this.phase = "first-duel";
    this.addSolid(this.leftGate);
    this.firstDuel.setEnabled(true);
    this.hazards.setEnabled(true);
    this.objectiveText
      .setText(
        "GALLERY GAUNTLET — FIRST SHADOW   0/1"
      )
      .setVisible(true);
    this.redrawGates();
    this.scene.cameras.main.flash(
      180,
      70,
      185,
      214,
      false
    );
    this.scene.cameras.main.shake(120, 0.003);
  }

  private updateFirstDuel(): void {
    const remaining = this.firstDuel.remaining;

    this.objectiveText.setText(
      `GALLERY GAUNTLET — FIRST SHADOW   ${1 - remaining}/1`
    );

    if (remaining !== 0) {
      return;
    }

    this.phase = "crossing";
    this.removeSolid(this.leftGate);
    this.removeSolid(this.midpointGate);
    this.objectiveText.setText(
      "GALLERY GAUNTLET — CROSS THE FRACTURED RHYTHM"
    );
    this.redrawGates();
    this.scene.cameras.main.flash(
      160,
      97,
      218,
      232,
      false
    );
  }

  private updateCrossing(): void {
    const midpoint =
      getWorldCheckpoint("GauntletMidpoint");

    if (
      !this.midpointActivated &&
      this.player.x >= midpoint.triggerX
    ) {
      this.midpointActivated = true;
      this.playerHealth.setCheckpoint(midpoint);
    }

    if (this.player.x < SECOND_DUEL_TRIGGER_X) {
      return;
    }

    this.phase = "second-duel";
    this.addSolid(this.secondLeftGate);
    this.secondDuel.setEnabled(true);
    this.objectiveText.setText(
      "GALLERY GAUNTLET — FINAL SHADOW   0/1"
    );
    this.redrawGates();
    this.scene.cameras.main.flash(
      180,
      197,
      150,
      58,
      false
    );
    this.scene.cameras.main.shake(120, 0.003);
  }

  private updateSecondDuel(): void {
    const remaining = this.secondDuel.remaining;

    this.objectiveText.setText(
      `GALLERY GAUNTLET — FINAL SHADOW   ${1 - remaining}/1`
    );

    if (remaining !== 0) {
      return;
    }

    this.phase = "cleared";
    this.hazards.setEnabled(false);
    this.removeSolid(this.secondLeftGate);
    this.removeSolid(this.exitGate);
    this.redrawGates();

    this.objectiveText.setText(
      "GAUNTLET CLEAR — ASCEND TO THE SPOTLIGHT VAULT"
    );
    this.scene.cameras.main.flash(
      260,
      242,
      201,
      94,
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
      ...(this.phase === "first-duel"
        ? [this.leftGate, this.midpointGate]
        : []),
      ...(this.phase === "approach"
        ? [this.midpointGate]
        : []),
      ...(this.phase === "second-duel"
        ? [this.secondLeftGate, this.exitGate]
        : []),
      ...(
        this.phase !== "cleared" &&
        this.phase !== "second-duel"
          ? [this.exitGate]
          : []
      )
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
