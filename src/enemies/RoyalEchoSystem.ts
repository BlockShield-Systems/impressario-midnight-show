import Phaser from "phaser";

import { EnemyView } from "./EnemyView";

import type {
  CombatSystem,
  CombatTarget
} from "../combat/CombatSystem";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";

type EchoKind =
  | "duelist"
  | "caster";

type EchoState =
  | "dormant"
  | "patrol"
  | "telegraph"
  | "dash"
  | "cooldown"
  | "stagger"
  | "defeated";

interface EchoSpawn {
  readonly kind: EchoKind;
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly right: number;
  readonly phase: number;
}

interface PrismProjectile {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  lifetime: number;
  active: boolean;
}

const SPAWNS: readonly EchoSpawn[] = [
  {
    kind: "duelist",
    x: 12110,
    y: 294,
    left: 12035,
    right: 12210,
    phase: 0
  },
  {
    kind: "caster",
    x: 12555,
    y: 382,
    left: 12390,
    right: 12710,
    phase: Math.PI * 0.5
  },
  {
    kind: "duelist",
    x: 13120,
    y: 294,
    left: 13020,
    right: 13320,
    phase: Math.PI
  },
  {
    kind: "caster",
    x: 13820,
    y: 255,
    left: 13680,
    right: 14020,
    phase: Math.PI * 1.5
  }
];

class RoyalEcho implements CombatTarget {
  public x: number;
  public y: number;

  public readonly width = 22;
  public readonly height = 32;

  public health: number;

  private enabled = false;
  private state: EchoState = "dormant";

  private velocityX = 0;
  private velocityY = 0;

  private facing: -1 | 1 = -1;

  private elapsed = 0;
  private actionTimer = 0;
  private flashTimer = 0;
  private contactCooldown = 0;

  private readonly view: EnemyView;


  private readonly label:
    Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    private readonly spawn: EchoSpawn,
    private readonly fireProjectile: (
      x: number,
      y: number,
      targetX: number,
      targetY: number
    ) => void
  ) {
    this.x = spawn.x;
    this.y = spawn.y;

    this.health =
      spawn.kind === "duelist"
        ? 52
        : 40;

    this.view = new EnemyView(scene, 31);


    this.label = scene.add.text(
      this.x,
      this.y,
      "",
      {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f8d9ff",
        stroke: "#070812",
        strokeThickness: 2
      }
    );

    this.label.setDepth(32);
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
      this.state = "patrol";
      this.actionTimer =
        this.spawn.kind === "duelist"
          ? 0.7
          : 0.95;
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
    this.facing = -1;

    this.health =
      this.spawn.kind === "duelist"
        ? 52
        : 40;

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

    const distanceX =
      this.player.centerX -
      (this.x + this.width * 0.5);

    if (Math.abs(distanceX) > 2) {
      this.facing =
        distanceX < 0 ? -1 : 1;
    }

    switch (this.state) {
      case "patrol":
        this.updatePatrol(
          distanceX,
          deltaSeconds
        );
        break;

      case "telegraph":
        this.updateTelegraph(
          distanceX,
          deltaSeconds
        );
        break;

      case "dash":
        this.updateDash(deltaSeconds);
        break;

      case "cooldown":
        this.updateCooldown(deltaSeconds);
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

    this.health = Math.max(
      0,
      this.health - damage
    );

    this.velocityX =
      knockbackX * facing * 0.72;

    this.velocityY =
      knockbackY * 0.45;

    this.flashTimer = 0.12;

    if (this.health <= 0) {
      this.state = "defeated";
      this.velocityX = 0;
      this.velocityY = 0;
      this.redraw();
      return;
    }

    this.state = "stagger";
    this.actionTimer = 0.24;
  }

  private updatePatrol(
    distanceX: number,
    deltaSeconds: number
  ): void {
    this.actionTimer -= deltaSeconds;

    if (this.spawn.kind === "caster") {
      const targetY =
        this.spawn.y +
        Math.sin(
          this.elapsed * 2.1 +
          this.spawn.phase
        ) * 24;

      this.velocityY = moveTowards(
        this.velocityY,
        (targetY - this.y) * 4,
        280 * deltaSeconds
      );

      const desiredVelocity =
        Math.abs(distanceX) > 160
          ? this.facing * 38
          : -this.facing * 24;

      this.velocityX = moveTowards(
        this.velocityX,
        desiredVelocity,
        180 * deltaSeconds
      );

      this.moveCaster(deltaSeconds);

      if (
        this.actionTimer <= 0 &&
        Math.abs(distanceX) < 430
      ) {
        this.state = "telegraph";
        this.actionTimer = 0.58;
        this.velocityX = 0;
        this.velocityY = 0;
      }

      return;
    }

    this.velocityX = moveTowards(
      this.velocityX,
      this.facing * 52,
      270 * deltaSeconds
    );

    this.x +=
      this.velocityX * deltaSeconds;

    this.y = this.spawn.y;

    if (this.x <= this.spawn.left) {
      this.x = this.spawn.left;
      this.facing = 1;
    }

    if (
      this.x + this.width >=
      this.spawn.right
    ) {
      this.x =
        this.spawn.right -
        this.width;

      this.facing = -1;
    }

    if (
      this.actionTimer <= 0 &&
      Math.abs(distanceX) < 280
    ) {
      this.state = "telegraph";
      this.actionTimer = 0.42;
      this.velocityX = 0;
    }
  }

  private updateTelegraph(
    distanceX: number,
    deltaSeconds: number
  ): void {
    this.actionTimer -= deltaSeconds;
    this.velocityX = 0;
    this.velocityY = 0;

    if (Math.abs(distanceX) > 2) {
      this.facing =
        distanceX < 0 ? -1 : 1;
    }

    if (this.actionTimer > 0) {
      return;
    }

    if (this.spawn.kind === "caster") {
      this.fireProjectile(
        this.x + this.width * 0.5,
        this.y + this.height * 0.5,
        this.player.centerX,
        this.player.centerY
      );

      this.state = "cooldown";
      this.actionTimer = 1.05;
      return;
    }

    this.state = "dash";
    this.actionTimer = 0.32;
    this.velocityX =
      this.facing * 315;
  }

  private updateDash(
    deltaSeconds: number
  ): void {
    this.actionTimer -= deltaSeconds;

    this.x +=
      this.velocityX * deltaSeconds;

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.left,
      this.spawn.right -
        this.width
    );

    this.y = this.spawn.y;

    if (
      this.actionTimer <= 0 ||
      this.x <= this.spawn.left ||
      this.x + this.width >=
        this.spawn.right
    ) {
      this.state = "cooldown";
      this.actionTimer = 0.72;
      this.velocityX = 0;
    }
  }

  private updateCooldown(
    deltaSeconds: number
  ): void {
    this.actionTimer -= deltaSeconds;

    this.velocityX = moveTowards(
      this.velocityX,
      0,
      360 * deltaSeconds
    );

    if (this.spawn.kind === "caster") {
      this.moveCaster(deltaSeconds);
    } else {
      this.x +=
        this.velocityX * deltaSeconds;

      this.x = Phaser.Math.Clamp(
        this.x,
        this.spawn.left,
        this.spawn.right -
          this.width
      );

      this.y = this.spawn.y;
    }

    if (this.actionTimer <= 0) {
      this.state = "patrol";
      this.actionTimer =
        this.spawn.kind === "duelist"
          ? 0.62
          : 0.78;
    }
  }

  private updateStagger(
    deltaSeconds: number
  ): void {
    this.actionTimer -= deltaSeconds;

    this.velocityX = moveTowards(
      this.velocityX,
      0,
      420 * deltaSeconds
    );

    this.velocityY = moveTowards(
      this.velocityY,
      0,
      520 * deltaSeconds
    );

    this.x +=
      this.velocityX * deltaSeconds;

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.left,
      this.spawn.right -
        this.width
    );

    if (this.spawn.kind === "duelist") {
      this.y = this.spawn.y;
    } else {
      this.y +=
        this.velocityY * deltaSeconds;
    }

    if (this.actionTimer <= 0) {
      this.state = "cooldown";
      this.actionTimer = 0.55;
    }
  }

  private moveCaster(
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
      this.spawn.y - 40,
      this.spawn.y + 40
    );
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

    const force =
      this.state === "dash"
        ? 275
        : 185;

    const damaged =
      this.playerHealth.receiveDamage(
        1,
        this.x + this.width * 0.5,
        force,
        -155
      );

    if (damaged) {
      this.contactCooldown = 0.9;
    }
  }

  private redraw(): void {
    const tag =
      this.spawn.kind === "duelist"
        ? this.state === "defeated"
          ? "echo_duelist_defeat"
          : this.state === "stagger"
            ? "echo_duelist_hurt"
            : this.state === "telegraph"
              ? "echo_duelist_telegraph"
              : this.state === "dash"
                ? "echo_duelist_dash"
                : this.state === "cooldown"
                  ? "echo_duelist_cooldown"
                  : "echo_duelist_patrol"
        : this.state === "defeated"
          ? "echo_caster_defeat"
          : this.state === "stagger"
            ? "echo_caster_hurt"
            : this.state === "telegraph"
              ? "echo_caster_telegraph"
              : this.state === "cooldown"
                ? "echo_caster_cooldown"
                : "echo_caster_hover";

    this.view.update({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      facing: this.facing,
      visible: this.enabled,
      tag,
      flashing: this.flashTimer > 0
    });

    if (
      !this.enabled ||
      this.state === "defeated"
    ) {
      this.label.setVisible(false);
      return;
    }

    this.label
      .setVisible(true)
      .setPosition(
        this.x - 5,
        this.y - 15
      )
      .setText(`${
        this.spawn.kind === "duelist"
          ? "DUEL"
          : "PRISM"
      } ${this.health}`);
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

export class RoyalEchoSystem {
  private enabled = false;

  private readonly enemies:
    RoyalEcho[];

  private readonly projectiles:
    PrismProjectile[] = [];

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

    this.projectileGraphics.setDepth(33);

    this.enemies = SPAWNS.map(
      spawn =>
        new RoyalEcho(
          scene,
          player,
          playerHealth,
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

    if (direction.lengthSq() <= 0.001) {
      direction.set(1, 0);
    } else {
      direction.normalize();
    }

    this.projectiles.push({
      x,
      y,
      velocityX: direction.x * 255,
      velocityY: direction.y * 255,
      rotation: 0,
      lifetime: 3.6,
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
        8.5 * deltaSeconds;

      if (
        projectile.lifetime <= 0 ||
        projectile.x < 11950 ||
        projectile.x > 14450 ||
        projectile.y < 0 ||
        projectile.y > 720
      ) {
        projectile.active = false;
        continue;
      }

      const bounds =
        new Phaser.Geom.Rectangle(
          projectile.x - 7,
          projectile.y - 7,
          14,
          14
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
            225,
            -145
          );

        if (damaged) {
          projectile.active = false;
        }
      }
    }

    if (this.projectiles.length > 48) {
      const active =
        this.projectiles.filter(
          projectile => projectile.active
        );

      this.projectiles.length = 0;
      this.projectiles.push(...active);
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

      g.fillStyle(0xe865c6, 0.92);

      g.fillTriangle(
        0,
        -9,
        9,
        0,
        0,
        9
      );

      g.fillTriangle(
        0,
        -9,
        -9,
        0,
        0,
        9
      );

      g.lineStyle(2, 0x81e9f0, 1);
      g.strokeCircle(0, 0, 8);

      g.restore();
    }
  }
}
