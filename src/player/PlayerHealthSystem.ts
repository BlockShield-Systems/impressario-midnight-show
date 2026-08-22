import Phaser from "phaser";
import type {
  WorldCheckpoint
} from "../world/WorldGameplay";
import { leaderboard } from "../leaderboard/LeaderboardClient";
import type { PlayerController } from "./PlayerController";
import { PlayerRespawnState } from "./PlayerRespawnState";

export class PlayerHealthSystem {
  public readonly maximumHealth = 5;

  private health = this.maximumHealth;
  private invulnerabilityTimer = 0;
  private hurtTimer = 0;

  private readonly scene: Phaser.Scene;
  private readonly player: PlayerController;
  private readonly onRespawn:
    (() => void) | undefined;
  private readonly respawnState:
    PlayerRespawnState;

  private readonly hudGraphics: Phaser.GameObjects.Graphics;
  private readonly statusText: Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    player: PlayerController,
    onRespawn:
      (() => void) | undefined = undefined
  ) {
    this.scene = scene;
    this.player = player;
    this.onRespawn = onRespawn;
    this.respawnState =
      new PlayerRespawnState(player);

    this.hudGraphics = scene.add.graphics();
    this.hudGraphics
      .setScrollFactor(0)
      .setDepth(1100);

    this.statusText = scene.add.text(
      12,
      34,
      "",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#ffe9b7",
        stroke: "#170a11",
        strokeThickness: 3
      }
    );

    this.statusText
      .setScrollFactor(0)
      .setDepth(1101);

    this.redrawHud();
  }

  public get controlsLocked(): boolean {
    return this.respawnState.controlsLocked;
  }

  public get currentHealth(): number {
    return this.health;
  }

  public get isHurt(): boolean {
    return this.hurtTimer > 0;
  }

  public getDebugSnapshot() {
    const checkpoint =
      this.respawnState.currentCheckpoint;

    return {
      checkpointName:
        checkpoint.displayName,
      checkpointX:
        checkpoint.x,
      checkpointY:
        checkpoint.y,
      controlsLocked:
        this.controlsLocked,
      currentHealth:
        this.currentHealth
    };
  }

  public update(deltaSeconds: number): void {
    this.invulnerabilityTimer = Math.max(
      0,
      this.invulnerabilityTimer - deltaSeconds
    );

    this.hurtTimer = Math.max(
      0,
      this.hurtTimer - deltaSeconds
    );

    if (
      this.respawnState.update(deltaSeconds)
    ) {
      this.respawn();
    }
  }

  public setCheckpoint(
    checkpoint: WorldCheckpoint
  ): void {
    const name =
      checkpoint.displayName;

    this.respawnState.setCheckpoint(
      checkpoint
    );

    leaderboard.recordCheckpoint(name);

    this.statusText.setText(
      `CHECKPOINT — ${name}`
    );

    this.scene.time.delayedCall(
      1400,
      () => {
        if (!this.controlsLocked) {
          this.statusText.setText("");
        }
      }
    );

    this.scene.cameras.main.flash(
      160,
      242,
      201,
      94,
      false
    );
  }

  public heal(amount: number): boolean {
    if (
      amount <= 0 ||
      this.controlsLocked ||
      this.health >= this.maximumHealth
    ) {
      return false;
    }

    this.health = Math.min(
      this.maximumHealth,
      this.health + amount
    );

    this.redrawHud();

    this.scene.cameras.main.flash(
      120,
      214,
      82,
      168,
      false
    );

    return true;
  }

  public fallOut(): void {
    if (this.controlsLocked) {
      return;
    }

    this.health = 0;
    this.invulnerabilityTimer = 0;
    this.hurtTimer = 0;

    this.redrawHud();
    this.beginRespawn();
  }

  public receiveDamage(
    amount: number,
    sourceX: number,
    forceX = 175,
    forceY = -150
  ): boolean {
    if (
      amount <= 0 ||
      this.invulnerabilityTimer > 0 ||
      this.controlsLocked
    ) {
      return false;
    }

    this.health = Math.max(
      0,
      this.health - amount
    );

    leaderboard.recordHit();

    const direction: -1 | 1 =
      this.player.centerX < sourceX
        ? -1
        : 1;

    this.player.velocityX =
      direction * forceX;

    this.player.velocityY = forceY;
    this.invulnerabilityTimer = 0.85;
    this.hurtTimer = 0.34;

    this.scene.cameras.main.shake(
      110,
      0.006
    );

    this.scene.cameras.main.flash(
      85,
      165,
      22,
      52,
      false
    );

    this.redrawHud();

    if (this.health <= 0) {
      this.beginRespawn();
    }

    return true;
  }

  private beginRespawn(): void {
    if (!this.respawnState.beginRespawn()) {
      return;
    }

    leaderboard.recordDeath();

    this.statusText.setText(
      "CURTAIN FALL — Returning to " +
        this.respawnState.currentCheckpoint
          .displayName
    );

    this.scene.cameras.main.fadeOut(
      500,
      8,
      3,
      8
    );
  }

  private respawn(): void {
    this.health = this.maximumHealth;
    this.invulnerabilityTimer = 1;
    this.hurtTimer = 0;

    this.statusText.setText("");

    this.onRespawn?.();

    this.redrawHud();

    this.scene.cameras.main.fadeIn(
      350,
      8,
      3,
      8
    );
  }

  private redrawHud(): void {
    const g = this.hudGraphics;
    g.clear();

    g.fillStyle(0x13090f, 0.86);
    g.fillRoundedRect(
      8,
      8,
      104,
      22,
      5
    );

    g.lineStyle(
      1,
      0xc8923d,
      0.8
    );

    g.strokeRoundedRect(
      8,
      8,
      104,
      22,
      5
    );

    for (
      let index = 0;
      index < this.maximumHealth;
      index += 1
    ) {
      const active =
        index < this.health;

      g.fillStyle(
        active
          ? 0xb7244b
          : 0x3b202a,
        active ? 1 : 0.75
      );

      g.fillCircle(
        22 + index * 18,
        19,
        6
      );

      if (active) {
        g.fillStyle(
          0xf3c75c,
          0.8
        );

        g.fillCircle(
          20 + index * 18,
          17,
          2
        );
      }
    }
  }
}
