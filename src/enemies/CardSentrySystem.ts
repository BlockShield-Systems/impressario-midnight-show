import Phaser from "phaser";

import type {
  CombatSystem,
  CombatTarget
} from "../combat/CombatSystem";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";

type SentryState =
  | "dormant"
  | "idle"
  | "telegraph"
  | "cooldown"
  | "stagger"
  | "defeated";

interface SentrySpawn {
  readonly x: number;
  readonly y: number;
  readonly phase: number;
}

interface SentryProjectile {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  lifetime: number;
  active: boolean;
}

const SPAWNS: readonly SentrySpawn[] = [
  {
    x: 10020,
    y: 440,
    phase: 0
  },
  {
    x: 10970,
    y: 240,
    phase: Math.PI
  },
  {
    x: 11520,
    y: 440,
    phase: Math.PI * 0.5
  }
];

class CardSentry implements CombatTarget {
  public x: number;
  public y: number;

  public readonly width = 22;
  public readonly height = 32;

  public health = 42;

  private enabled = false;
  private state: SentryState = "dormant";

  private elapsed = 0;
  private actionTimer = 0;
  private flashTimer = 0;

  private readonly graphics:
    Phaser.GameObjects.Graphics;

  private readonly label:
    Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly spawn: SentrySpawn,
    private readonly fireProjectile: (
      x: number,
      y: number,
      targetX: number,
      targetY: number
    ) => void
  ) {
    this.x = spawn.x;
    this.y = spawn.y;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(18);

    this.label = scene.add.text(
      this.x,
      this.y,
      "",
      {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ffe8a1",
        stroke: "#110716",
        strokeThickness: 2
      }
    );

    this.label.setDepth(19);
    this.redraw();
  }

  public get active(): boolean {
    return (
      this.enabled &&
      this.state !== "defeated"
    );
  }

  public get defeated(): boolean {
    return this.state === "defeated";
  }

  public get bounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x,
      this.y,
      this.width,
      this.height
    );
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (
      enabled &&
      this.state === "dormant"
    ) {
      this.state = "idle";
      this.actionTimer = 0.8;
    }

    this.redraw();
  }

  public reset(): void {
    this.enabled = false;
    this.state = "dormant";

    this.x = this.spawn.x;
    this.y = this.spawn.y;

    this.health = 42;

    this.elapsed = 0;
    this.actionTimer = 0;
    this.flashTimer = 0;

    this.redraw();
  }

  public update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;

    this.flashTimer = Math.max(
      0,
      this.flashTimer - deltaSeconds
    );

    if (
      !this.enabled ||
      this.state === "defeated"
    ) {
      this.redraw();
      return;
    }

    this.y =
      this.spawn.y +
      Math.sin(
        this.elapsed * 2 +
        this.spawn.phase
      ) * 12;

    this.actionTimer -= deltaSeconds;

    if (
      this.state === "idle" &&
      this.actionTimer <= 0
    ) {
      const distanceX =
        this.player.centerX -
        (this.x + this.width * 0.5);

      if (Math.abs(distanceX) < 420) {
        this.state = "telegraph";
        this.actionTimer = 0.52;
      } else {
        this.actionTimer = 0.25;
      }
    } else if (
      this.state === "telegraph" &&
      this.actionTimer <= 0
    ) {
      this.fireProjectile(
        this.x + this.width * 0.5,
        this.y + this.height * 0.5,
        this.player.centerX,
        this.player.centerY
      );

      this.state = "cooldown";
      this.actionTimer = 1.15;
    } else if (
      this.state === "cooldown" &&
      this.actionTimer <= 0
    ) {
      this.state = "idle";
      this.actionTimer = 0.25;
    } else if (
      this.state === "stagger" &&
      this.actionTimer <= 0
    ) {
      this.state = "cooldown";
      this.actionTimer = 0.65;
    }

    this.redraw();
  }

  public receiveHit(
    damage: number,
    _knockbackX: number,
    _knockbackY: number,
    _facing: -1 | 1
  ): void {
    if (!this.active) {
      return;
    }

    this.health = Math.max(
      0,
      this.health - damage
    );

    this.flashTimer = 0.12;

    if (this.health <= 0) {
      this.state = "defeated";
      this.redraw();
      return;
    }

    this.state = "stagger";
    this.actionTimer = 0.2;
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();

    if (!this.enabled) {
      this.label.setVisible(false);
      return;
    }

    if (this.state === "defeated") {
      this.label.setVisible(false);

      g.fillStyle(
        0xd6ac4b,
        0.18
      );

      g.fillCircle(
        this.x + 11,
        this.y + 16,
        21
      );

      return;
    }

    this.label.setVisible(true);

    const centerX =
      this.x + 11;

    const centerY =
      this.y + 16;

    g.fillStyle(
      0xd42f61,
      0.18
    );

    g.fillCircle(
      centerX,
      centerY,
      23
    );

    g.fillStyle(
      this.flashTimer > 0
        ? 0xffffff
        : 0x27132d,
      1
    );

    g.fillRoundedRect(
      this.x,
      this.y,
      this.width,
      this.height,
      5
    );

    g.lineStyle(
      3,
      0xdfb44e,
      1
    );

    g.strokeRoundedRect(
      this.x,
      this.y,
      this.width,
      this.height,
      5
    );

    g.fillStyle(
      0xd93665,
      1
    );

    g.fillCircle(
      centerX - 4,
      centerY - 2,
      5
    );

    g.fillCircle(
      centerX + 4,
      centerY - 2,
      5
    );

    g.fillTriangle(
      centerX - 8,
      centerY,
      centerX + 8,
      centerY,
      centerX,
      centerY + 10
    );

    if (this.state === "telegraph") {
      const radius =
        27 +
        this.actionTimer * 24;

      g.lineStyle(
        2,
        0x76e4ec,
        1
      );

      g.strokeCircle(
        centerX,
        centerY,
        radius
      );

      g.lineStyle(
        1,
        0xf2cc64,
        0.9
      );

      g.lineBetween(
        centerX,
        centerY,
        this.player.centerX,
        this.player.centerY
      );
    }

    this.label
      .setPosition(
        this.x - 5,
        this.y - 15
      )
      .setText(
        `HP ${this.health}`
      );
  }
}

export class CardSentrySystem {
  private enabled = false;

  private readonly enemies:
    CardSentry[];

  private readonly projectiles:
    SentryProjectile[] = [];

  private readonly projectileGraphics:
    Phaser.GameObjects.Graphics;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    combatSystem: CombatSystem
  ) {
    this.projectileGraphics =
      scene.add.graphics();

    this.projectileGraphics.setDepth(23);

    this.enemies = SPAWNS.map(
      spawn =>
        new CardSentry(
          scene,
          player,
          spawn,
          (
            x: number,
            y: number,
            targetX: number,
            targetY: number
          ) => {
            this.createProjectile(
              x,
              y,
              targetX,
              targetY
            );
          }
        )
    );

    for (const enemy of this.enemies) {
      combatSystem.registerTarget(enemy);
    }
  }

  public get remaining(): number {
    return this.enemies.filter(
      enemy => !enemy.defeated
    ).length;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    for (const enemy of this.enemies) {
      enemy.setEnabled(enabled);
    }

    if (!enabled) {
      this.clearProjectiles();
    }
  }

  public resetEncounter(): void {
    this.enabled = false;

    for (const enemy of this.enemies) {
      enemy.reset();
    }

    this.clearProjectiles();
  }

  public update(deltaSeconds: number): void {
    if (!this.enabled) {
      return;
    }

    for (const enemy of this.enemies) {
      enemy.update(deltaSeconds);
    }

    this.updateProjectiles(deltaSeconds);
    this.redrawProjectiles();
  }

  private createProjectile(
    x: number,
    y: number,
    targetX: number,
    targetY: number
  ): void {
    const direction =
      new Phaser.Math.Vector2(
        targetX - x,
        targetY - y
      );

    direction.normalize();

    this.projectiles.push({
      x,
      y,
      velocityX:
        direction.x * 225,
      velocityY:
        direction.y * 225,
      rotation: 0,
      lifetime: 3.4,
      active: true
    });
  }

  private updateProjectiles(
    deltaSeconds: number
  ): void {
    const playerBounds =
      new Phaser.Geom.Rectangle(
        this.player.x,
        this.player.y,
        this.player.width,
        this.player.height
      );

    for (const projectile of this.projectiles) {
      if (!projectile.active) {
        continue;
      }

      projectile.lifetime -= deltaSeconds;

      projectile.x +=
        projectile.velocityX *
        deltaSeconds;

      projectile.y +=
        projectile.velocityY *
        deltaSeconds;

      projectile.rotation +=
        9 * deltaSeconds;

      if (
        projectile.lifetime <= 0 ||
        projectile.x < 9500 ||
        projectile.x > 12050 ||
        projectile.y < 10 ||
        projectile.y > 700
      ) {
        projectile.active = false;
        continue;
      }

      const bounds =
        new Phaser.Geom.Rectangle(
          projectile.x - 6,
          projectile.y - 8,
          12,
          16
        );

      if (
        Phaser.Geom.Intersects.RectangleToRectangle(
          bounds,
          playerBounds
        )
      ) {
        const damaged =
          this.playerHealth.receiveDamage(
            1,
            projectile.x,
            205,
            -130
          );

        if (damaged) {
          projectile.active = false;
        }
      }
    }
  }

  private clearProjectiles(): void {
    this.projectiles.length = 0;
    this.projectileGraphics.clear();
  }

  private redrawProjectiles(): void {
    const g = this.projectileGraphics;
    g.clear();

    for (const projectile of this.projectiles) {
      if (!projectile.active) {
        continue;
      }

      g.save();

      g.translateCanvas(
        projectile.x,
        projectile.y
      );

      g.rotateCanvas(
        projectile.rotation
      );

      g.fillStyle(
        0xf5e8c5,
        1
      );

      g.fillRoundedRect(
        -6,
        -8,
        12,
        16,
        2
      );

      g.lineStyle(
        2,
        0xd63767,
        1
      );

      g.strokeRoundedRect(
        -6,
        -8,
        12,
        16,
        2
      );

      g.fillStyle(
        0xd63767,
        1
      );

      g.fillCircle(
        0,
        0,
        2.5
      );

      g.restore();
    }
  }
}
