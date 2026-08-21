import Phaser from "phaser";

import { EnemyView } from "./EnemyView";
import { getWorldEnemySpawns } from "../world/WorldEnemies";

import type {
  CombatSystem,
  CombatTarget
} from "../combat/CombatSystem";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";

type CardThrowerState =
  | "dormant"
  | "ready"
  | "telegraph"
  | "cooldown"
  | "stagger"
  | "defeated";

interface CardThrowerSpawn {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly right: number;
}

const PROJECTILE_MARGIN = 256;

interface CardProjectile {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  lifetime: number;
  active: boolean;
}

const SPAWNS: readonly CardThrowerSpawn[] =
  getWorldEnemySpawns("CardThrower").map(
    spawn => ({
      id: spawn.id,
      x: spawn.x,
      y: spawn.y,
      left: spawn.patrolLeft,
      right: spawn.patrolRight
    })
  );

class CardThrower implements CombatTarget {
  public x: number;
  public y: number;

  public readonly width = 18;
  public readonly height = 30;

  public health = 32;

  private enabled = false;
  private state: CardThrowerState = "dormant";

  private velocityX = 0;
  private velocityY = 0;

  private facing: -1 | 1 = -1;

  private actionTimer = 0;
  private flashTimer = 0;
  private contactCooldown = 0;

  private readonly view: EnemyView;

  private readonly label: Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    private readonly spawn: CardThrowerSpawn,
    private readonly spawnProjectile: (
      x: number,
      y: number,
      direction: -1 | 1
    ) => void
  ) {
    this.x = spawn.x;
    this.y = spawn.y;

    this.view = new EnemyView(scene, 15);


    this.label = scene.add.text(
      this.x,
      this.y,
      "",
      {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#d8e8ff",
        stroke: "#120a12",
        strokeThickness: 2
      }
    );

    this.label.setDepth(16);
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
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;

    if (
      enabled &&
      this.state === "dormant"
    ) {
      this.state = "ready";
      this.actionTimer = 0.65;
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

    this.health = 32;
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

    if (this.state === "stagger") {
      this.actionTimer -= deltaSeconds;

      if (this.actionTimer <= 0) {
        this.state = "cooldown";
        this.actionTimer = 0.65;
      }
    } else if (this.state === "telegraph") {
      this.velocityX = moveTowards(
        this.velocityX,
        0,
        700 * deltaSeconds
      );

      this.actionTimer -= deltaSeconds;

      if (this.actionTimer <= 0) {
        this.spawnProjectile(
          this.x + this.width * 0.5,
          this.y + 10,
          this.facing
        );

        this.state = "cooldown";
        this.actionTimer = 1.15;
      }
    } else {
      this.updateSpacing(
        distanceX,
        deltaSeconds
      );

      this.actionTimer -= deltaSeconds;

      if (
        this.actionTimer <= 0 &&
        Math.abs(distanceX) < 390
      ) {
        this.state = "telegraph";
        this.actionTimer = 0.38;
        this.velocityX = 0;
      }
    }

    this.applyPhysics(deltaSeconds);
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
      this.velocityX *= 0.5;
      this.velocityY = Math.min(
        this.velocityY,
        -100
      );

      this.redraw();
      return;
    }

    this.state = "stagger";
    this.actionTimer = 0.22;
  }

  private updateSpacing(
    distanceX: number,
    deltaSeconds: number
  ): void {
    const absoluteDistance =
      Math.abs(distanceX);

    let targetVelocity = 0;

    if (absoluteDistance < 115) {
      targetVelocity =
        distanceX < 0 ? 62 : -62;
    } else if (absoluteDistance > 235) {
      targetVelocity =
        distanceX < 0 ? -44 : 44;
    }

    this.velocityX = moveTowards(
      this.velocityX,
      targetVelocity,
      320 * deltaSeconds
    );
  }

  private applyPhysics(
    deltaSeconds: number
  ): void {
    this.velocityY +=
      900 * deltaSeconds;

    this.x +=
      this.velocityX * deltaSeconds;

    this.y +=
      this.velocityY * deltaSeconds;

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.left,
      this.spawn.right - this.width
    );

    if (this.y + this.height >= 326) {
      this.y = 326 - this.height;
      this.velocityY = 0;
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
        145,
        -110
      );

    if (damaged) {
      this.contactCooldown = 0.9;
    }
  }

  private redraw(): void {
    const tag =
      this.state === "defeated"
        ? "thrower_defeat"
        : this.state === "stagger"
          ? "thrower_hurt"
          : this.state === "telegraph"
            ? "thrower_telegraph"
            : this.state === "cooldown"
              ? "thrower_cooldown"
              : Math.abs(this.velocityX) > 5
                ? "thrower_move"
                : "thrower_idle";

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
      .setText(`HP ${this.health}`);
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

  return current +
    Math.sign(target - current) *
    maxDelta;
}

export class CardThrowerSystem {
  private readonly throwers: CardThrower[];
  private readonly projectiles: CardProjectile[] = [];

  private readonly projectileGraphics: Phaser.GameObjects.Graphics;
  private readonly projectileLeft: number;
  private readonly projectileRight: number;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    combatSystem: CombatSystem,
    spawnIds?: readonly string[]
  ) {
    const selectedSpawns = spawnIds
      ? SPAWNS.filter(spawn =>
          spawnIds.includes(spawn.id)
        )
      : SPAWNS;

    if (
      spawnIds &&
      selectedSpawns.length !== spawnIds.length
    ) {
      throw new Error(
        "Card Thrower spawn selection is incomplete."
      );
    }

    this.projectileLeft = Math.min(
      ...selectedSpawns.map(spawn => spawn.left)
    ) - PROJECTILE_MARGIN;

    this.projectileRight = Math.max(
      ...selectedSpawns.map(spawn => spawn.right)
    ) + PROJECTILE_MARGIN;

    this.projectileGraphics = scene.add.graphics();
    this.projectileGraphics.setDepth(18);

    this.throwers = selectedSpawns.map(
      spawn =>
        new CardThrower(
          scene,
          player,
          playerHealth,
          spawn,
          (
            x: number,
            y: number,
            direction: -1 | 1
          ) => {
            this.createProjectile(
              x,
              y,
              direction
            );
          }
        )
    );

    for (const thrower of this.throwers) {
      combatSystem.registerTarget(thrower);
    }
  }

  public get total(): number {
    return this.throwers.length;
  }

  public get remaining(): number {
    return this.throwers.filter(
      thrower => !thrower.defeated
    ).length;
  }

  public setEncounterActive(
    active: boolean
  ): void {
    for (const thrower of this.throwers) {
      thrower.setEnabled(active);
    }

    if (!active) {
      for (const projectile of this.projectiles) {
        projectile.active = false;
      }
    }
  }

  public resetEncounter(): void {
    for (const thrower of this.throwers) {
      thrower.reset();
    }

    for (const projectile of this.projectiles) {
      projectile.active = false;
    }

    this.projectiles.length = 0;
    this.projectileGraphics.clear();
  }

  public update(deltaSeconds: number): void {
    for (const thrower of this.throwers) {
      thrower.update(deltaSeconds);
    }

    this.updateProjectiles(deltaSeconds);
    this.redrawProjectiles();
  }

  private createProjectile(
    x: number,
    y: number,
    direction: -1 | 1
  ): void {
    this.projectiles.push({
      x,
      y,
      velocityX: direction * 205,
      velocityY: -18,
      rotation: 0,
      lifetime: 3.2,
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
        projectile.velocityX * deltaSeconds;

      projectile.y +=
        projectile.velocityY * deltaSeconds;

      projectile.rotation +=
        11 * deltaSeconds;

      if (
        projectile.lifetime <= 0 ||
        projectile.x < this.projectileLeft ||
        projectile.x > this.projectileRight ||
        projectile.y < 20 ||
        projectile.y > 340
      ) {
        projectile.active = false;
        continue;
      }

      const cardBounds =
        new Phaser.Geom.Rectangle(
          projectile.x - 5,
          projectile.y - 7,
          10,
          14
        );

      if (
        Phaser.Geom.Intersects.RectangleToRectangle(
          cardBounds,
          playerBounds
        )
      ) {
        const damaged =
          this.playerHealth.receiveDamage(
            1,
            projectile.x,
            190,
            -105
          );

        if (damaged) {
          projectile.active = false;
        }
      }
    }

    if (this.projectiles.length > 40) {
      const activeProjectiles =
        this.projectiles.filter(
          projectile => projectile.active
        );

      this.projectiles.length = 0;
      this.projectiles.push(
        ...activeProjectiles
      );
    }
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
        0xf5f2e8,
        1
      );

      g.fillRoundedRect(
        -5,
        -7,
        10,
        14,
        2
      );

      g.lineStyle(
        1,
        0x62c9ef,
        1
      );

      g.strokeRoundedRect(
        -5,
        -7,
        10,
        14,
        2
      );

      g.fillStyle(
        0xb51d46,
        1
      );

      g.fillCircle(
        0,
        0,
        2
      );

      g.restore();
    }
  }
}
