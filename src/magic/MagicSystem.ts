import Phaser from "phaser";

import type { PlayerController } from "../main";
import { AUDIO_EVENTS } from "../audio/AudioEvents";
import {
  GRAND_CARD_MAX_CHARGES,
  GrandCardChargeState,
  type GrandCardSpendResult
} from "./GrandCardState";
import {
  ABILITY_RESOURCE_HUD_BOUNDS,
  ABILITY_RESOURCE_HUD_METER,
  ABILITY_RESOURCE_HUD_TEXT
} from "../ui/HudLayout";
import {
  combinePressedIntent,
  type GameplayActionIntentSource
} from "../runtime/GamepadInputController";

interface SpotlightResult {
  readonly targetsHit: number;
  readonly targetsDefeated: number;
}

export class MagicSystem {
  public readonly maximumShow = 100;

  private show = this.maximumShow;
  private unlocked = false;
  private grandCardUnlocked = false;
  private readonly grandCardCharges =
    new GrandCardChargeState();

  private cooldownTimer = 0;
  private effectTimer = 0;
  private castCount = 0;

  private readonly castKey:
    Phaser.Input.Keyboard.Key | undefined;
  private readonly actionIntents:
    GameplayActionIntentSource;

  private readonly worldGraphics:
    Phaser.GameObjects.Graphics;

  private readonly hudGraphics:
    Phaser.GameObjects.Graphics;

  private readonly lightText:
    Phaser.GameObjects.Text;

  private readonly cardText:
    Phaser.GameObjects.Text;

  private readonly showText:
    Phaser.GameObjects.Text;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly applySpotlight: (
      centerX: number,
      centerY: number,
      radius: number
    ) => SpotlightResult,
    actionIntents: GameplayActionIntentSource
  ) {
    this.actionIntents = actionIntents;
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

    const textStyle = {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#bff8ff",
      stroke: "#07101d",
      strokeThickness: 3
    } as const;

    this.lightText = scene.add.text(
      ABILITY_RESOURCE_HUD_TEXT.x,
      ABILITY_RESOURCE_HUD_TEXT.lightY,
      "[K] SPOTLIGHT",
      textStyle
    );
    this.cardText = scene.add.text(
      ABILITY_RESOURCE_HUD_TEXT.x,
      ABILITY_RESOURCE_HUD_TEXT.cardY,
      "",
      textStyle
    );
    this.showText = scene.add.text(
      ABILITY_RESOURCE_HUD_TEXT.x,
      ABILITY_RESOURCE_HUD_TEXT.showY,
      "",
      textStyle
    );

    for (const text of [
      this.lightText,
      this.cardText,
      this.showText
    ]) {
      text
        .setScrollFactor(0)
        .setDepth(1121)
        .setVisible(false);
    }
  }

  public get isUnlocked(): boolean {
    return this.unlocked;
  }

  public get castsPerformed(): number {
    return this.castCount;
  }

  public get grandCardChargeCount(): number {
    return this.grandCardCharges.currentCharges;
  }

  public get maximumGrandCardCharges(): number {
    return GRAND_CARD_MAX_CHARGES;
  }

  public unlock(): void {
    if (this.unlocked) {
      return;
    }

    this.unlocked = true;
    this.show = this.maximumShow;

    this.lightText.setVisible(true);
    this.showText.setVisible(true);
    this.redrawHud();
  }

  public unlockGrandCard(): void {
    if (this.grandCardUnlocked) {
      return;
    }

    this.grandCardUnlocked = true;
    this.grandCardCharges.unlock();
    this.redrawHud();
  }

  public trySpendGrandCard(
    cost: number,
    cooldown: number
  ): GrandCardSpendResult {
    if (
      !this.unlocked ||
      !this.grandCardUnlocked
    ) {
      return "locked";
    }

    if (
      this.grandCardCharges.currentCharges <= 0
    ) {
      this.scene.events.emit(
        AUDIO_EVENTS.grandCardDepleted,
        this.player.centerX
      );
      this.redrawHud();
      return "depleted";
    }

    if (
      cost <= 0 ||
      cooldown <= 0 ||
      this.cooldownTimer > 0 ||
      this.show < cost
    ) {
      return "locked";
    }

    const result =
      this.grandCardCharges.spend();

    if (result !== "spent") {
      return result;
    }

    this.show -= cost;
    this.cooldownTimer = cooldown;
    this.scene.events.emit(
      AUDIO_EVENTS.grandCardCast,
      this.player.centerX
    );
    this.redrawHud();

    return "spent";
  }

  public collectGrandCardPickup(
    id: string,
    x: number
  ): boolean {
    if (!this.grandCardCharges.collectPickup(id)) {
      return false;
    }

    this.scene.events.emit(
      AUDIO_EVENTS.grandCardPickup,
      x
    );
    this.redrawHud();
    return true;
  }

  public isGrandCardPickupAvailable(
    id: string
  ): boolean {
    return this.grandCardCharges.isPickupAvailable(id);
  }

  public resetGrandCardPickups(
    ids: readonly string[]
  ): void {
    this.grandCardCharges.resetPickups(ids);
  }

  public restoreGrandCardCharges(
    charges: number
  ): void {
    this.grandCardCharges.restoreCharges(charges);
    this.redrawHud();
  }

  public grandCardPickupTimerRemainders(
    ids: readonly string[]
  ): Readonly<Record<string, number>> {
    return this.grandCardCharges
      .pickupTimerRemainders(ids);
  }

  public restoreGrandCardPickupTimers(
    remainders: Readonly<Record<string, number>>
  ): void {
    this.grandCardCharges
      .restorePickupTimers(remainders);
  }

  public getHudDebugSnapshot() {
    return {
      visible:
        this.lightText.visible &&
        this.showText.visible,
      bounds: {
        ...ABILITY_RESOURCE_HUD_BOUNDS
      },
      lightText: this.lightText.text,
      cardText: this.cardText.text,
      showText: this.showText.text
    };
  }

  public resetEncounter(): void {
    this.show = this.maximumShow;
    this.cooldownTimer = 0;
    this.effectTimer = 0;
    this.grandCardCharges.resetEncounter();

    this.worldGraphics.clear();
    this.redrawHud();
  }

  public update(deltaSeconds: number): void {
    const gamepadCast =
      this.actionIntents.consumeGamepadAction(
        "spotlight"
      );

    if (!this.unlocked) {
      return;
    }

    this.cooldownTimer = Math.max(
      0,
      this.cooldownTimer - deltaSeconds
    );

    this.grandCardCharges.update(deltaSeconds);

    this.effectTimer = Math.max(
      0,
      this.effectTimer - deltaSeconds
    );

    this.show = Math.min(
      this.maximumShow,
      this.show + 12 * deltaSeconds
    );

    if (
      combinePressedIntent(
        Boolean(
          this.castKey &&
          Phaser.Input.Keyboard.JustDown(
            this.castKey
          )
        ),
        gamepadCast
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
      ABILITY_RESOURCE_HUD_BOUNDS.x,
      ABILITY_RESOURCE_HUD_BOUNDS.y,
      ABILITY_RESOURCE_HUD_BOUNDS.width,
      ABILITY_RESOURCE_HUD_BOUNDS.height,
      5
    );

    g.lineStyle(
      1,
      0xc99a3e,
      0.9
    );

    g.strokeRoundedRect(
      ABILITY_RESOURCE_HUD_BOUNDS.x,
      ABILITY_RESOURCE_HUD_BOUNDS.y,
      ABILITY_RESOURCE_HUD_BOUNDS.width,
      ABILITY_RESOURCE_HUD_BOUNDS.height,
      5
    );

    g.fillStyle(
      0x17243a,
      1
    );

    g.fillRoundedRect(
      ABILITY_RESOURCE_HUD_METER.x,
      ABILITY_RESOURCE_HUD_METER.y,
      ABILITY_RESOURCE_HUD_METER.width,
      ABILITY_RESOURCE_HUD_METER.height,
      3
    );

    g.fillStyle(
      ratio >= 0.3
        ? 0x67dce8
        : 0xb72d57,
      1
    );

    g.fillRoundedRect(
      ABILITY_RESOURCE_HUD_METER.x,
      ABILITY_RESOURCE_HUD_METER.y,
      ABILITY_RESOURCE_HUD_METER.width * ratio,
      ABILITY_RESOURCE_HUD_METER.height,
      3
    );

    const cardStatus =
      this.grandCardCharges.currentCharges > 0
        ? `CARD ${this.grandCardCharges.currentCharges}/${GRAND_CARD_MAX_CHARGES}`
        : "CARD EMPTY";

    this.lightText.setText("[K] SPOTLIGHT");
    this.cardText
      .setVisible(this.grandCardUnlocked)
      .setText(
        this.grandCardUnlocked
          ? `[L] ${cardStatus}`
          : ""
      )
      .setColor(
        this.grandCardUnlocked &&
        this.grandCardCharges.currentCharges === 0
          ? "#ff7895"
          : "#bff8ff"
      );
    this.showText.setText(
      `SHOW ${Math.floor(this.show)}`
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
