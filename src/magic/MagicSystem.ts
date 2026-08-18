import Phaser from "phaser";

import type { PlayerController } from "../main";

interface SpotlightResult {
  readonly targetsHit: number;
  readonly targetsDefeated: number;
}

export class MagicSystem {
  public readonly maximumShow = 100;

  private show = this.maximumShow;
  private unlocked = false;
  private grandCardUnlocked = false;

  private cooldownTimer = 0;
  private effectTimer = 0;
  private castCount = 0;

  private readonly castKey:
    Phaser.Input.Keyboard.Key | undefined;

  private readonly worldGraphics:
    Phaser.GameObjects.Graphics;

  private readonly hudGraphics:
    Phaser.GameObjects.Graphics;

  private readonly spellText:
    Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly applySpotlight: (
      centerX: number,
      centerY: number,
      radius: number
    ) => SpotlightResult
  ) {
    this.castKey =
      scene.input.keyboard?.addKey(
        Phaser.Input.Keyboard.KeyCodes.K
      );

    this.worldGraphics = scene.add.graphics();

    this.worldGraphics.setDepth(90);

    this.hudGraphics = scene.add.graphics();

    this.hudGraphics
      .setScrollFactor(0)
      .setDepth(1120);

    this.spellText = scene.add.text(
      122,
      10,
      "",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#bff8ff",
        stroke: "#07101d",
        strokeThickness: 3
      }
    );

    this.spellText
      .setScrollFactor(0)
      .setDepth(1121)
      .setVisible(false);
  }

  public get isUnlocked(): boolean {
    return this.unlocked;
  }

  public get castsPerformed(): number {
    return this.castCount;
  }

  public unlock(): void {
    if (this.unlocked) {
      return;
    }

    this.unlocked = true;
    this.show = this.maximumShow;

    this.spellText.setVisible(true);
    this.redrawHud();
  }

  public unlockGrandCard(): void {
    if (this.grandCardUnlocked) {
      return;
    }

    this.grandCardUnlocked = true;
    this.redrawHud();
  }

  public trySpendShow(
    cost: number,
    cooldown: number
  ): boolean {
    if (
      !this.unlocked ||
      !this.grandCardUnlocked ||
      cost <= 0 ||
      cooldown <= 0 ||
      this.cooldownTimer > 0 ||
      this.show < cost
    ) {
      return false;
    }

    this.show -= cost;
    this.cooldownTimer = cooldown;
    this.redrawHud();

    return true;
  }

  public resetEncounter(): void {
    this.show = this.maximumShow;
    this.cooldownTimer = 0;
    this.effectTimer = 0;

    this.worldGraphics.clear();
    this.redrawHud();
  }

  public update(deltaSeconds: number): void {
    if (!this.unlocked) {
      return;
    }

    this.cooldownTimer = Math.max(
      0,
      this.cooldownTimer - deltaSeconds
    );

    this.effectTimer = Math.max(
      0,
      this.effectTimer - deltaSeconds
    );

    this.show = Math.min(
      this.maximumShow,
      this.show + 12 * deltaSeconds
    );

    if (
      this.castKey &&
      Phaser.Input.Keyboard.JustDown(
        this.castKey
      )
    ) {
      this.tryCastSpotlight();
    }

    this.redrawEffect();
    this.redrawHud();
  }

  private tryCastSpotlight(): void {
    const cost = 30;

    if (
      this.cooldownTimer > 0 ||
      this.show < cost
    ) {
      return;
    }

    this.show -= cost;
    this.cooldownTimer = 0.55;
    this.effectTimer = 0.38;
    this.castCount += 1;

    this.applySpotlight(
      this.player.centerX,
      this.player.centerY,
      155
    );
  }

  private redrawHud(): void {
    if (!this.unlocked) {
      return;
    }

    const g = this.hudGraphics;
    g.clear();

    const ratio =
      this.show /
      this.maximumShow;

    g.fillStyle(
      0x07101d,
      0.9
    );

    g.fillRoundedRect(
      118,
      8,
      150,
      24,
      5
    );

    g.lineStyle(
      1,
      0xc99a3e,
      0.9
    );

    g.strokeRoundedRect(
      118,
      8,
      150,
      24,
      5
    );

    g.fillStyle(
      0x17243a,
      1
    );

    g.fillRoundedRect(
      176,
      15,
      82,
      9,
      3
    );

    g.fillStyle(
      ratio >= 0.3
        ? 0x67dce8
        : 0xb72d57,
      1
    );

    g.fillRoundedRect(
      176,
      15,
      82 * ratio,
      9,
      3
    );

    this.spellText.setText(
      this.grandCardUnlocked
        ? `[K] LIGHT  [L] CARD  SHOW ${Math.floor(this.show)}`
        : `[K] SPOTLIGHT  SHOW ${Math.floor(this.show)}`
    );
  }

  private redrawEffect(): void {
    const g = this.worldGraphics;
    g.clear();

    if (this.effectTimer <= 0) {
      return;
    }

    const progress =
      1 -
      this.effectTimer / 0.38;

    const centerX =
      this.player.centerX;

    const centerY =
      this.player.centerY;

    const radius =
      35 + progress * 120;

    g.fillStyle(
      0xbff8ff,
      0.1 * (1 - progress)
    );

    g.fillCircle(
      centerX,
      centerY,
      radius
    );

    g.lineStyle(
      4,
      0x76e6ef,
      1 - progress
    );

    g.strokeCircle(
      centerX,
      centerY,
      radius
    );

    g.lineStyle(
      2,
      0xf2ce68,
      0.9 * (1 - progress)
    );

    g.strokeCircle(
      centerX,
      centerY,
      radius * 0.72
    );

    for (
      let index = 0;
      index < 12;
      index += 1
    ) {
      const angle =
        index / 12 *
        Math.PI * 2;

      const innerRadius =
        radius * 0.62;

      const outerRadius =
        radius * 1.05;

      g.lineStyle(
        2,
        index % 2 === 0
          ? 0x7ce7ef
          : 0xe9bd55,
        1 - progress
      );

      g.lineBetween(
        centerX +
          Math.cos(angle) *
          innerRadius,
        centerY +
          Math.sin(angle) *
          innerRadius,
        centerX +
          Math.cos(angle) *
          outerRadius,
        centerY +
          Math.sin(angle) *
          outerRadius
      );
    }
  }
}
