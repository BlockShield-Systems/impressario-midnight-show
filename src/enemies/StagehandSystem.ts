import Phaser from "phaser";

import { EnemyView } from "./EnemyView";
import { getWorldEnemySpawns } from "../world/WorldEnemies";

import type {
  CombatSystem,
  CombatTarget
} from "../combat/CombatSystem";

import type { PlayerController } from "../main";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";

type StagehandState =
  | "dormant"
  | "patrol"
  | "alert"
  | "chase"
  | "stagger"
  | "defeated";

interface StagehandSpawn {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly patrolLeft: number;
  readonly patrolRight: number;
}

const SPAWNS: readonly StagehandSpawn[] =
  getWorldEnemySpawns("Stagehand").map(
    spawn => ({
      id: spawn.id,
      x: spawn.x,
      y: spawn.y,
      patrolLeft: spawn.patrolLeft,
      patrolRight: spawn.patrolRight
    })
  );

class MaskedStagehand implements CombatTarget {
  public x: number;
  public y: number;

  public readonly width = 18;
  public readonly height = 30;

  public velocityX = 0;
  public velocityY = 0;

  public health = 45;
  public state: StagehandState = "dormant";

  private enabled = false;
  private direction: -1 | 1 = 1;

  private staggerTimer = 0;
  private flashTimer = 0;
  private alertTimer = 0;
  private contactCooldown = 0;

  private readonly view: EnemyView;

  private readonly label: Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    private readonly spawn: StagehandSpawn
  ) {
    this.x = spawn.x;
    this.y = spawn.y;

    this.view = new EnemyView(scene, 17);


    this.label = scene.add.text(
      this.x,
      this.y,
      "",
      {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f2d7a1",
        stroke: "#13090f",
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
      this.state = "patrol";
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

    this.health = 45;
    this.direction = 1;

    this.staggerTimer = 0;
    this.flashTimer = 0;
    this.alertTimer = 0;
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

    if (this.state === "stagger") {
      this.updateStagger(deltaSeconds);
    } else {
      this.updateAwareness(deltaSeconds);
      this.updateMovement(deltaSeconds);
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
      this.velocityX *= 0.55;
      this.velocityY = Math.min(
        this.velocityY,
        -110
      );

      this.redraw();
      return;
    }

    this.state = "stagger";
    this.staggerTimer = 0.18;
  }

  private updateAwareness(
    deltaSeconds: number
  ): void {
    const distanceX =
      this.player.centerX -
      (this.x + this.width * 0.5);

    const distanceY =
      this.player.centerY -
      (this.y + this.height * 0.5);

    const seesPlayer =
      Math.abs(distanceX) < 280 &&
      Math.abs(distanceY) < 100;

    if (
      seesPlayer &&
      this.state === "patrol"
    ) {
      this.state = "alert";
      this.alertTimer = 0.22;
      this.velocityX = 0;
    }

    if (this.state === "alert") {
      this.alertTimer -= deltaSeconds;

      if (this.alertTimer <= 0) {
        this.state = "chase";
      }

      return;
    }

    if (
      this.state === "chase" &&
      Math.abs(distanceX) > 390
    ) {
      this.state = "patrol";
    }
  }

  private updateMovement(
    deltaSeconds: number
  ): void {
    if (this.state === "alert") {
      this.velocityX = moveTowards(
        this.velocityX,
        0,
        500 * deltaSeconds
      );

      return;
    }

    if (this.state === "patrol") {
      if (this.x <= this.spawn.patrolLeft) {
        this.direction = 1;
      }

      if (
        this.x + this.width >=
        this.spawn.patrolRight
      ) {
        this.direction = -1;
      }

      this.velocityX = moveTowards(
        this.velocityX,
        this.direction * 38,
        250 * deltaSeconds
      );

      return;
    }

    const distanceX =
      this.player.centerX -
      (this.x + this.width * 0.5);

    if (Math.abs(distanceX) > 27) {
      this.direction =
        distanceX < 0 ? -1 : 1;

      this.velocityX = moveTowards(
        this.velocityX,
        this.direction * 76,
        390 * deltaSeconds
      );
    } else {
      this.velocityX = moveTowards(
        this.velocityX,
        0,
        600 * deltaSeconds
      );
    }
  }

  private updateStagger(
    deltaSeconds: number
  ): void {
    this.staggerTimer -= deltaSeconds;

    if (this.staggerTimer <= 0) {
      this.state = "chase";
    }
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
      this.spawn.patrolLeft,
      this.spawn.patrolRight - this.width
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
        165,
        -125
      );

    if (damaged) {
      this.contactCooldown = 0.9;
    }
  }

  private redraw(): void {
    const tag =
      this.state === "defeated"
        ? "stagehand_defeat"
        : this.state === "stagger"
          ? "stagehand_hurt"
          : this.state === "alert"
            ? "stagehand_alert"
            : Math.abs(this.velocityX) > 5
              ? "stagehand_walk"
              : "stagehand_idle";

    this.view.update({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      facing: this.direction,
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

export class StagehandSystem {
  private readonly enemies: MaskedStagehand[];

  public constructor(
    scene: Phaser.Scene,
    player: PlayerController,
    playerHealth: PlayerHealthSystem,
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
        "Stagehand spawn selection is incomplete."
      );
    }

    this.enemies = selectedSpawns.map(
      spawn =>
        new MaskedStagehand(
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

  public get total(): number {
    return this.enemies.length;
  }

  public get remaining(): number {
    return this.enemies.filter(
      enemy => !enemy.defeated
    ).length;
  }

  public setEncounterActive(
    active: boolean
  ): void {
    for (const enemy of this.enemies) {
      enemy.setEnabled(active);
    }
  }

  public resetEncounter(): void {
    for (const enemy of this.enemies) {
      enemy.reset();
    }
  }

  public update(deltaSeconds: number): void {
    for (const enemy of this.enemies) {
      enemy.update(deltaSeconds);
    }
  }
}
