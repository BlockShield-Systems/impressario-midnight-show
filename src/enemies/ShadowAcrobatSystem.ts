import Phaser from "phaser";

import type {
  CombatSystem,
  CombatTarget
} from "../combat/CombatSystem";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";

type ShadowState =
  | "dormant"
  | "stalk"
  | "telegraph"
  | "leap"
  | "stagger"
  | "defeated";

interface ShadowSpawn {
  readonly x: number;
  readonly groundY: number;
  readonly patrolLeft: number;
  readonly patrolRight: number;
}

const SPAWNS: readonly ShadowSpawn[] = [
  {
    x: 6800,
    groundY: 430,
    patrolLeft: 6740,
    patrolRight: 6890
  },
  {
    x: 7505,
    groundY: 326,
    patrolLeft: 7480,
    patrolRight: 7605
  }
];

class ShadowAcrobat implements CombatTarget {
  public x: number;
  public y: number;

  public readonly width = 19;
  public readonly height = 28;

  public health = 38;

  private enabled = false;
  private state: ShadowState = "dormant";

  private velocityX = 0;
  private velocityY = 0;

  private facing: -1 | 1 = -1;

  private actionTimer = 0;
  private flashTimer = 0;
  private contactCooldown = 0;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    private readonly spawn: ShadowSpawn
  ) {
    this.x = spawn.x;
    this.y =
      spawn.groundY - this.height;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(17);

    this.label = scene.add.text(
      this.x,
      this.y,
      "",
      {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#b9f5ff",
        stroke: "#070b15",
        strokeThickness: 2
      }
    );

    this.label.setDepth(18);
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
      this.state = "stalk";
      this.actionTimer = 0.75;
    }

    this.redraw();
  }

  public reset(): void {
    this.enabled = false;
    this.state = "dormant";

    this.x = this.spawn.x;
    this.y =
      this.spawn.groundY -
      this.height;

    this.velocityX = 0;
    this.velocityY = 0;

    this.health = 38;
    this.facing = -1;

    this.actionTimer = 0;
    this.flashTimer = 0;
    this.contactCooldown = 0;

    this.redraw();
  }

  public update(deltaSeconds: number): void {
    this.flashTimer = Math.max(
      0,
      this.flashTimer - deltaSeconds
    );

    this.contactCooldown = Math.max(
      0,
      this.contactCooldown - deltaSeconds
    );

    if (
      !this.enabled ||
      this.state === "defeated"
    ) {
      this.redraw();
      return;
    }

    const distanceX =
      this.player.centerX -
      (this.x + this.width * 0.5);

    this.facing =
      distanceX < 0 ? -1 : 1;

    switch (this.state) {
      case "stalk":
        this.updateStalk(
          distanceX,
          deltaSeconds
        );
        break;

      case "telegraph":
        this.updateTelegraph(
          deltaSeconds
        );
        break;

      case "leap":
        this.updateLeap(
          deltaSeconds
        );
        break;

      case "stagger":
        this.updateStagger(
          deltaSeconds
        );
        break;

      case "dormant":
        break;
    }

    this.applyContactDamage();
    this.redraw();
  }

  public receiveHit(
    damage: number,
    knockbackX: number,
    knockbackY: number,
    facing: -1 | 1
  ): void {
    if (!this.active) {
      return;
    }

    this.health = Math.max(
      0,
      this.health - damage
    );

    this.velocityX =
      knockbackX * facing;

    this.velocityY = knockbackY;
    this.flashTimer = 0.1;

    if (this.health <= 0) {
      this.state = "defeated";
      this.redraw();
      return;
    }

    this.state = "stagger";
    this.actionTimer = 0.2;
  }

  private updateStalk(
    distanceX: number,
    deltaSeconds: number
  ): void {
    this.actionTimer -= deltaSeconds;

    const desiredDistance = 95;
    let targetVelocity = 0;

    if (
      Math.abs(distanceX) >
      desiredDistance + 18
    ) {
      targetVelocity =
        this.facing * 58;
    } else if (
      Math.abs(distanceX) <
      desiredDistance - 18
    ) {
      targetVelocity =
        this.facing * -52;
    }

    this.velocityX = moveTowards(
      this.velocityX,
      targetVelocity,
      330 * deltaSeconds
    );

    this.x +=
      this.velocityX * deltaSeconds;

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.patrolLeft,
      this.spawn.patrolRight -
        this.width
    );

    this.y =
      this.spawn.groundY -
      this.height;

    if (
      this.actionTimer <= 0 &&
      Math.abs(distanceX) < 245
    ) {
      this.state = "telegraph";
      this.actionTimer = 0.42;
      this.velocityX = 0;
    }
  }

  private updateTelegraph(
    deltaSeconds: number
  ): void {
    this.actionTimer -= deltaSeconds;
    this.velocityX = 0;

    if (this.actionTimer > 0) {
      return;
    }

    this.state = "leap";

    this.velocityX =
      this.facing * 175;

    this.velocityY = -310;
  }

  private updateLeap(
    deltaSeconds: number
  ): void {
    this.velocityY +=
      980 * deltaSeconds;

    this.x +=
      this.velocityX * deltaSeconds;

    this.y +=
      this.velocityY * deltaSeconds;

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.patrolLeft,
      this.spawn.patrolRight -
        this.width
    );

    if (
      this.y + this.height >=
      this.spawn.groundY
    ) {
      this.y =
        this.spawn.groundY -
        this.height;

      this.velocityX = 0;
      this.velocityY = 0;

      this.state = "stalk";
      this.actionTimer = 0.9;
    }
  }

  private updateStagger(
    deltaSeconds: number
  ): void {
    this.actionTimer -= deltaSeconds;

    this.velocityY +=
      900 * deltaSeconds;

    this.x +=
      this.velocityX * deltaSeconds;

    this.y +=
      this.velocityY * deltaSeconds;

    this.velocityX = moveTowards(
      this.velocityX,
      0,
      320 * deltaSeconds
    );

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.patrolLeft,
      this.spawn.patrolRight -
        this.width
    );

    if (
      this.y + this.height >=
      this.spawn.groundY
    ) {
      this.y =
        this.spawn.groundY -
        this.height;

      this.velocityY = 0;
    }

    if (this.actionTimer <= 0) {
      this.state = "stalk";
      this.actionTimer = 0.55;
    }
  }

  private applyContactDamage(): void {
    if (this.contactCooldown > 0) {
      return;
    }

    const playerBounds =
      new Phaser.Geom.Rectangle(
        this.player.x,
        this.player.y,
        this.player.width,
        this.player.height
      );

    if (
      !Phaser.Geom.Intersects.RectangleToRectangle(
        this.bounds,
        playerBounds
      )
    ) {
      return;
    }

    const leapMultiplier =
      this.state === "leap"
        ? 1.18
        : 1;

    const damaged =
      this.playerHealth.receiveDamage(
        1,
        this.x + this.width * 0.5,
        190 * leapMultiplier,
        -145
      );

    if (damaged) {
      this.contactCooldown = 0.9;
    }
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
        0x070b16,
        0.5
      );

      g.fillEllipse(
        this.x + 10,
        this.spawn.groundY - 3,
        31,
        7
      );

      return;
    }

    this.label.setVisible(true);

    const centerX =
      this.x + this.width * 0.5;

    const bodyColor =
      this.flashTimer > 0
        ? 0xeaffff
        : 0x11172b;

    g.fillStyle(
      0x02040b,
      0.38
    );

    g.fillEllipse(
      centerX,
      this.spawn.groundY + 2,
      26,
      6
    );

    g.fillStyle(
      bodyColor,
      1
    );

    g.fillTriangle(
      centerX,
      this.y + 5,
      this.x + 1,
      this.y + 27,
      this.x + 18,
      this.y + 27
    );

    g.fillStyle(
      0x8be8ef,
      0.92
    );

    g.fillCircle(
      centerX,
      this.y + 7,
      6
    );

    g.fillStyle(
      0x07101d,
      1
    );

    g.fillCircle(
      centerX - 2,
      this.y + 6,
      1.3
    );

    g.fillCircle(
      centerX + 2,
      this.y + 6,
      1.3
    );

    g.lineStyle(
      3,
      0x513c79,
      1
    );

    if (this.state === "leap") {
      g.lineBetween(
        centerX,
        this.y + 16,
        centerX - 13,
        this.y + 4
      );

      g.lineBetween(
        centerX,
        this.y + 16,
        centerX + 13,
        this.y + 4
      );
    } else {
      g.lineBetween(
        centerX,
        this.y + 16,
        centerX - 10,
        this.y + 23
      );

      g.lineBetween(
        centerX,
        this.y + 16,
        centerX + 10,
        this.y + 23
      );
    }

    if (this.state === "telegraph") {
      const pulse =
        12 +
        this.actionTimer * 16;

      g.lineStyle(
        2,
        0xd6ae4e,
        0.95
      );

      g.strokeCircle(
        centerX,
        this.spawn.groundY - 2,
        pulse
      );

      g.fillStyle(
        0x76e5ed,
        0.25
      );

      g.fillCircle(
        centerX,
        this.spawn.groundY - 2,
        pulse * 0.65
      );
    }

    this.label
      .setPosition(
        this.x - 5,
        this.y - 16
      )
      .setText(
        `HP ${this.health}`
      );
  }
}

function moveTowards(
  current: number,
  target: number,
  maxDelta: number
): number {
  if (
    Math.abs(target - current) <=
    maxDelta
  ) {
    return target;
  }

  return (
    current +
    Math.sign(target - current) *
    maxDelta
  );
}

export class ShadowAcrobatSystem {
  private enabled = false;

  private readonly enemies: ShadowAcrobat[];

  public constructor(
    scene: Phaser.Scene,
    player: PlayerController,
    playerHealth: PlayerHealthSystem,
    combatSystem: CombatSystem
  ) {
    this.enemies = SPAWNS.map(
      spawn =>
        new ShadowAcrobat(
          scene,
          player,
          playerHealth,
          spawn
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
  }

  public resetEncounter(): void {
    this.enabled = false;

    for (const enemy of this.enemies) {
      enemy.reset();
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.enabled) {
      return;
    }

    for (const enemy of this.enemies) {
      enemy.update(deltaSeconds);
    }
  }
}
