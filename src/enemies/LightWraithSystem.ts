import Phaser from "phaser";

import type {
  CombatSystem,
  CombatTarget
} from "../combat/CombatSystem";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";

type WraithState =
  | "dormant"
  | "hover"
  | "telegraph"
  | "charge"
  | "stagger"
  | "defeated";

interface WraithSpawn {
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly right: number;
  readonly phase: number;
}

const SPAWNS: readonly WraithSpawn[] = [
  {
    x: 8620,
    y: 270,
    left: 8500,
    right: 8780,
    phase: 0
  },
  {
    x: 9020,
    y: 270,
    left: 8880,
    right: 9190,
    phase: Math.PI
  }
];

class LightWraith implements CombatTarget {
  public x: number;
  public y: number;

  public readonly width = 24;
  public readonly height = 32;

  public health = 30;

  private enabled = false;
  private state: WraithState = "dormant";

  private velocityX = 0;
  private velocityY = 0;

  private elapsed = 0;
  private actionTimer = 0;
  private flashTimer = 0;
  private contactCooldown = 0;

  private readonly graphics:
    Phaser.GameObjects.Graphics;

  private readonly label:
    Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    private readonly spawn: WraithSpawn
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
        color: "#d5fbff",
        stroke: "#07101d",
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
      this.state = "hover";
      this.actionTimer = 0.9;
    }

    this.redraw();
  }

  public reset(): void {
    this.enabled = false;
    this.state = "dormant";

    this.x = this.spawn.x;
    this.y = this.spawn.y;

    this.velocityX = 0;
    this.velocityY = 0;

    this.health = 30;

    this.elapsed = 0;
    this.actionTimer = 0;
    this.flashTimer = 0;
    this.contactCooldown = 0;

    this.redraw();
  }

  public update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;

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

    switch (this.state) {
      case "hover":
        this.updateHover(deltaSeconds);
        break;

      case "telegraph":
        this.updateTelegraph(deltaSeconds);
        break;

      case "charge":
        this.updateCharge(deltaSeconds);
        break;

      case "stagger":
        this.updateStagger(deltaSeconds);
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

    // Physical attacks work, but inefficiently.
    const reducedDamage = Math.max(
      1,
      Math.ceil(damage * 0.2)
    );

    this.health = Math.max(
      0,
      this.health - reducedDamage
    );

    this.velocityX =
      knockbackX *
      facing *
      0.35;

    this.velocityY =
      knockbackY *
      0.35;

    this.flashTimer = 0.08;

    if (this.health <= 0) {
      this.state = "defeated";
      this.redraw();
      return;
    }

    this.state = "stagger";
    this.actionTimer = 0.12;
  }

  public receiveSpotlight(
    centerX: number,
    centerY: number,
    radius: number
  ): boolean {
    if (!this.active) {
      return false;
    }

    const targetX =
      this.x +
      this.width * 0.5;

    const targetY =
      this.y +
      this.height * 0.5;

    const deltaX =
      targetX - centerX;

    const deltaY =
      targetY - centerY;

    if (
      deltaX * deltaX +
      deltaY * deltaY >
      radius * radius
    ) {
      return false;
    }

    this.health = Math.max(
      0,
      this.health - 18
    );

    this.flashTimer = 0.28;

    const direction: -1 | 1 =
      deltaX < 0 ? -1 : 1;

    this.velocityX =
      direction * 150;

    this.velocityY = -120;

    if (this.health <= 0) {
      this.state = "defeated";
    } else {
      this.state = "stagger";
      this.actionTimer = 0.5;
    }

    this.redraw();
    return true;
  }

  private updateHover(
    deltaSeconds: number
  ): void {
    const targetY =
      this.spawn.y +
      Math.sin(
        this.elapsed * 2.2 +
        this.spawn.phase
      ) * 22;

    const distanceX =
      this.player.centerX -
      (this.x + this.width * 0.5);

    const desiredVelocity =
      Math.abs(distanceX) > 100
        ? Math.sign(distanceX) * 48
        : 0;

    this.velocityX = moveTowards(
      this.velocityX,
      desiredVelocity,
      240 * deltaSeconds
    );

    this.velocityY = moveTowards(
      this.velocityY,
      (targetY - this.y) * 4,
      300 * deltaSeconds
    );

    this.x +=
      this.velocityX * deltaSeconds;

    this.y +=
      this.velocityY * deltaSeconds;

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.left,
      this.spawn.right -
        this.width
    );

    this.actionTimer -= deltaSeconds;

    if (
      this.actionTimer <= 0 &&
      Math.abs(distanceX) < 260
    ) {
      this.state = "telegraph";
      this.actionTimer = 0.48;
      this.velocityX = 0;
      this.velocityY = 0;
    }
  }

  private updateTelegraph(
    deltaSeconds: number
  ): void {
    this.actionTimer -= deltaSeconds;

    if (this.actionTimer > 0) {
      return;
    }

    const direction =
      new Phaser.Math.Vector2(
        this.player.centerX -
          (this.x + this.width * 0.5),
        this.player.centerY -
          (this.y + this.height * 0.5)
      );

    direction.normalize();

    this.velocityX =
      direction.x * 210;

    this.velocityY =
      direction.y * 210;

    this.state = "charge";
    this.actionTimer = 0.55;
  }

  private updateCharge(
    deltaSeconds: number
  ): void {
    this.x +=
      this.velocityX * deltaSeconds;

    this.y +=
      this.velocityY * deltaSeconds;

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.left,
      this.spawn.right -
        this.width
    );

    this.y = Phaser.Math.Clamp(
      this.y,
      150,
      300
    );

    this.actionTimer -= deltaSeconds;

    if (this.actionTimer <= 0) {
      this.state = "hover";
      this.actionTimer = 1.05;
    }
  }

  private updateStagger(
    deltaSeconds: number
  ): void {
    this.velocityY +=
      450 * deltaSeconds;

    this.x +=
      this.velocityX * deltaSeconds;

    this.y +=
      this.velocityY * deltaSeconds;

    this.velocityX = moveTowards(
      this.velocityX,
      0,
      300 * deltaSeconds
    );

    this.velocityY = moveTowards(
      this.velocityY,
      0,
      240 * deltaSeconds
    );

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.left,
      this.spawn.right -
        this.width
    );

    this.y = Phaser.Math.Clamp(
      this.y,
      150,
      300
    );

    this.actionTimer -= deltaSeconds;

    if (this.actionTimer <= 0) {
      this.state = "hover";
      this.actionTimer = 0.8;
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

    const damaged =
      this.playerHealth.receiveDamage(
        1,
        this.x + this.width * 0.5,
        185,
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
        0x7de9ef,
        0.16
      );

      g.fillCircle(
        this.x + 12,
        this.y + 16,
        18
      );

      return;
    }

    this.label.setVisible(true);

    const centerX =
      this.x +
      this.width * 0.5;

    const centerY =
      this.y +
      this.height * 0.5;

    const bodyColor =
      this.flashTimer > 0
        ? 0xffffff
        : 0x16213d;

    g.fillStyle(
      0x62dce8,
      0.13
    );

    g.fillCircle(
      centerX,
      centerY,
      21
    );

    g.fillStyle(
      bodyColor,
      0.94
    );

    g.fillTriangle(
      centerX,
      this.y,
      this.x,
      this.y + 31,
      this.x + 24,
      this.y + 31
    );

    g.fillStyle(
      0x8cecf3,
      1
    );

    g.fillCircle(
      centerX,
      this.y + 10,
      7
    );

    g.fillStyle(
      0x06101d,
      1
    );

    g.fillCircle(
      centerX - 2.5,
      this.y + 9,
      1.5
    );

    g.fillCircle(
      centerX + 2.5,
      this.y + 9,
      1.5
    );

    if (this.state === "telegraph") {
      const radius =
        16 +
        this.actionTimer * 24;

      g.lineStyle(
        2,
        0xe9c75e,
        0.95
      );

      g.strokeCircle(
        centerX,
        centerY,
        radius
      );

      g.lineStyle(
        1,
        0x78e7ef,
        0.8
      );

      g.strokeCircle(
        centerX,
        centerY,
        radius * 0.7
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

export class LightWraithSystem {
  private enabled = false;

  private readonly enemies:
    LightWraith[];

  public constructor(
    scene: Phaser.Scene,
    player: PlayerController,
    playerHealth: PlayerHealthSystem,
    combatSystem: CombatSystem
  ) {
    this.enemies = SPAWNS.map(
      spawn =>
        new LightWraith(
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

  public applySpotlight(
    centerX: number,
    centerY: number,
    radius: number
  ): {
    targetsHit: number;
    targetsDefeated: number;
  } {
    let targetsHit = 0;
    let targetsDefeated = 0;

    for (const enemy of this.enemies) {
      const wasDefeated =
        enemy.defeated;

      const hit =
        enemy.receiveSpotlight(
          centerX,
          centerY,
          radius
        );

      if (hit) {
        targetsHit += 1;
      }

      if (
        !wasDefeated &&
        enemy.defeated
      ) {
        targetsDefeated += 1;
      }
    }

    return {
      targetsHit,
      targetsDefeated
    };
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
