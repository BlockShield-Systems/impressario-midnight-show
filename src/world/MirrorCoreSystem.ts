import Phaser from "phaser";
import { getWorldEnemySpawns } from "./WorldEnemies";
import {
  getWorldHazards,
  getWorldSupportPickups
} from "./WorldHazards";
import {
  getWorldCheckpoint,
  getWorldGate,
  type WorldGateId
} from "./WorldGameplay";
import { BossView } from "../boss/BossView";
import { EnemyView } from "../enemies/EnemyView";
import { leaderboard } from "../leaderboard/LeaderboardClient";

import type {
  CombatSystem,
  CombatTarget
} from "../combat/CombatSystem";

import type {
  PlayerController
} from "../main";

import type {
  MagicSystem
} from "../magic/MagicSystem";

import type {
  PlayerHealthSystem
} from "../player/PlayerHealthSystem";

export const MIRROR_CORE_START_X = 14400;

function createWorldGate(
  id: WorldGateId
): Phaser.Geom.Rectangle {
  const gate = getWorldGate(id);

  return new Phaser.Geom.Rectangle(
    gate.x,
    gate.y,
    gate.width,
    gate.height
  );
}
export const MIRROR_CORE_END_X = 49824;

interface MovingMirror {
  readonly solid: Phaser.Geom.Rectangle;
  readonly originX: number;
  readonly originY: number;
  readonly travelX: number;
  readonly travelY: number;
  readonly speed: number;
  readonly phase: number;
  previousX: number;
  previousY: number;
}

interface Rose {
  readonly x: number;
  readonly y: number;
  consumed: boolean;
}

interface FinaleParticle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifetime: number;
  maximumLifetime: number;
  color: number;
  size: number;
}

interface CoreProjectile {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifetime: number;
  radius: number;
  color: number;
  active: boolean;
}

interface CoreEnemySpawn {
  readonly kind:
    | "duelist"
    | "caster"
    | "mime";
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly right: number;
}

interface BossCounter {
  readonly x: number;
  readonly y: number;
}

const ENEMY_SPAWNS:
readonly CoreEnemySpawn[] =
  getWorldEnemySpawns("MirrorCore").map(
    spawn => {
      if (
        spawn.kind !== "duelist" &&
        spawn.kind !== "caster" &&
        spawn.kind !== "mime"
      ) {
        throw new Error(
          `Invalid MirrorCore kind: ${spawn.kind}`
        );
      }

      return {
        kind: spawn.kind,
        x: spawn.x,
        y: spawn.y,
        left: spawn.patrolLeft,
        right: spawn.patrolRight
      };
    }
  );

const ROSE_POSITIONS =
  getWorldSupportPickups("MirrorCore");

const SPIKE_RECTS =
  getWorldHazards(
    "MirrorCore",
    "Spike"
  ).map(
    hazard =>
      new Phaser.Geom.Rectangle(
        hazard.x,
        hazard.y,
        hazard.width,
        hazard.height
      )
  );

if (SPIKE_RECTS.length !== 4) {
  throw new Error(
    `Expected 4 MirrorCore spikes, got ${SPIKE_RECTS.length}.`
  );
}

function playerBounds(
  player: PlayerController
): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    player.x,
    player.y,
    player.width,
    player.height
  );
}

function moveTowards(
  current: number,
  target: number,
  maximumDelta: number
): number {
  const difference = target - current;

  if (
    Math.abs(difference) <=
    maximumDelta
  ) {
    return target;
  }

  return (
    current +
    Math.sign(difference) *
    maximumDelta
  );
}

function circleIntersectsRectangle(
  centerX: number,
  centerY: number,
  radius: number,
  rectangle: Phaser.Geom.Rectangle
): boolean {
  const closestX = Phaser.Math.Clamp(
    centerX,
    rectangle.left,
    rectangle.right
  );

  const closestY = Phaser.Math.Clamp(
    centerY,
    rectangle.top,
    rectangle.bottom
  );

  const dx = centerX - closestX;
  const dy = centerY - closestY;

  return (
    dx * dx + dy * dy <=
    radius * radius
  );
}

function lineIntersectsRectangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rectangle: Phaser.Geom.Rectangle,
  thickness: number
): boolean {
  const centerX = rectangle.centerX;
  const centerY = rectangle.centerY;

  const lineX = x2 - x1;
  const lineY = y2 - y1;

  const lengthSquared =
    lineX * lineX +
    lineY * lineY;

  if (lengthSquared <= 0.0001) {
    return circleIntersectsRectangle(
      x1,
      y1,
      thickness,
      rectangle
    );
  }

  const projection =
    Phaser.Math.Clamp(
      (
        (centerX - x1) * lineX +
        (centerY - y1) * lineY
      ) / lengthSquared,
      0,
      1
    );

  const closestX =
    x1 + lineX * projection;

  const closestY =
    y1 + lineY * projection;

  const radius =
    Math.max(
      rectangle.width,
      rectangle.height
    ) * 0.5 +
    thickness;

  return circleIntersectsRectangle(
    closestX,
    closestY,
    radius,
    rectangle
  );
}

class MirrorRelay
implements CombatTarget {
  public active = true;

  private activated = false;
  private flashTimer = 0;

  private readonly graphics:
    Phaser.GameObjects.Graphics;

  public constructor(
    private readonly scene: Phaser.Scene,
    public readonly x: number,
    public readonly y: number,
    private readonly onActivated:
      () => void
  ) {
    this.graphics =
      scene.add.graphics();

    this.graphics.setDepth(45);
  }

  public get isActivated(): boolean {
    return this.activated;
  }

  public get bounds():
  Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x - 15,
      this.y - 19,
      30,
      38
    );
  }

  public receiveHit(
    _damage: number,
    _knockbackX: number,
    _knockbackY: number,
    _facing: -1 | 1
  ): void {
    // Cane and ordinary melee cannot
    // activate a Mirror Relay.
    this.flashTimer = 0.08;
  }

  public receiveRangedHit(
    _damage: number,
    _sourceX: number
  ): boolean {
    if (
      !this.active ||
      this.activated
    ) {
      return false;
    }

    this.activated = true;
    this.active = false;
    this.flashTimer = 0.3;

    this.scene.cameras.main.flash(
      180,
      70,
      225,
      245,
      false
    );

    this.onActivated();

    return true;
  }

  public forceActivated(): void {
    this.activated = true;
    this.active = false;
  }

  public reset(): void {
    this.activated = false;
    this.active = true;
    this.flashTimer = 0;
  }

  public update(
    deltaSeconds: number,
    elapsed: number
  ): void {
    this.flashTimer = Math.max(
      0,
      this.flashTimer - deltaSeconds
    );

    const g = this.graphics;
    g.clear();

    const pulse =
      1 +
      Math.sin(elapsed * 5) *
      0.07;

    const radius = 13 * pulse;

    g.fillStyle(
      this.activated
        ? 0x83f4ee
        : 0x190d2d,
      0.95
    );

    g.fillCircle(
      this.x,
      this.y,
      radius
    );

    g.lineStyle(
      this.flashTimer > 0
        ? 5
        : 2,
      this.activated
        ? 0xffd86a
        : 0xe65ac8,
      1
    );

    g.strokeCircle(
      this.x,
      this.y,
      radius + 4
    );

    g.lineStyle(
      2,
      0x75e8f0,
      0.9
    );

    for (
      let index = 0;
      index < 4;
      index += 1
    ) {
      const angle =
        elapsed * 0.8 +
        index * Math.PI * 0.5;

      g.lineBetween(
        this.x +
          Math.cos(angle) * 8,
        this.y +
          Math.sin(angle) * 8,
        this.x +
          Math.cos(angle) * 19,
        this.y +
          Math.sin(angle) * 19
      );
    }
  }
}

class CoreEnemy
implements CombatTarget {
  public x: number;
  public y: number;

  public readonly width = 20;
  public readonly height = 30;

  public active = false;

  private health: number;
  private defeated = false;

  private velocityX = 0;
  private velocityY = 0;

  private facing: -1 | 1 = -1;

  private actionTimer = 0.5;
  private flashTimer = 0;
  private contactTimer = 0;
  private elapsed = 0;

  private readonly movementHistory:
    number[] = [];

  private readonly view: EnemyView;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player:
      PlayerController,
    private readonly playerHealth:
      PlayerHealthSystem,
    private readonly spawn:
      CoreEnemySpawn,
    private readonly graphics:
      Phaser.GameObjects.Graphics,
    private readonly fireProjectile: (
      x: number,
      y: number,
      targetX: number,
      targetY: number,
      color?: number
    ) => void
  ) {
    this.x = spawn.x;
    this.y = spawn.y;

    this.graphics.setVisible(false);

    this.view = new EnemyView(
      scene,
      44
    );

    this.health =
      spawn.kind === "mime"
        ? 56
        : spawn.kind === "duelist"
          ? 48
          : 40;
  }

  public get isDefeated(): boolean {
    return this.defeated;
  }

  public get bounds():
  Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x,
      this.y,
      this.width,
      this.height
    );
  }

  public setEnabled(
    enabled: boolean
  ): void {
    this.active =
      enabled &&
      !this.defeated;

    this.redraw();
  }

  public reset(): void {
    this.x = this.spawn.x;
    this.y = this.spawn.y;

    this.health =
      this.spawn.kind === "mime"
        ? 56
        : this.spawn.kind === "duelist"
          ? 48
          : 40;

    this.active = false;
    this.defeated = false;

    this.velocityX = 0;
    this.velocityY = 0;

    this.actionTimer = 0.5;
    this.flashTimer = 0;
    this.contactTimer = 0;
    this.elapsed = 0;

    this.movementHistory.length = 0;
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
      knockbackX * facing * 0.55;

    this.velocityY =
      knockbackY * 0.4;

    this.flashTimer = 0.12;

    if (this.health <= 0) {
      this.defeated = true;
      this.active = false;
      this.redraw();

      this.scene.cameras.main.shake(
        90,
        0.003
      );
    }
  }

  public update(
    deltaSeconds: number
  ): void {
    if (
      !this.active ||
      this.defeated
    ) {
      return;
    }

    this.elapsed += deltaSeconds;

    this.actionTimer -= deltaSeconds;

    this.flashTimer = Math.max(
      0,
      this.flashTimer - deltaSeconds
    );

    this.contactTimer = Math.max(
      0,
      this.contactTimer - deltaSeconds
    );

    const distanceX =
      this.player.centerX -
      (this.x + this.width * 0.5);

    if (Math.abs(distanceX) > 2) {
      this.facing =
        distanceX < 0 ? -1 : 1;
    }

    switch (this.spawn.kind) {
      case "duelist":
        this.updateDuelist(
          distanceX,
          deltaSeconds
        );
        break;

      case "caster":
        this.updateCaster(
          distanceX,
          deltaSeconds
        );
        break;

      case "mime":
        this.updateMime(
          deltaSeconds
        );
        break;
    }

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.left,
      this.spawn.right -
        this.width
    );

    if (
      this.spawn.kind !== "caster"
    ) {
      this.velocityY +=
        900 * deltaSeconds;

      this.y +=
        this.velocityY *
        deltaSeconds;

      const floorY =
        this.spawn.y +
        this.height;

      if (
        this.y + this.height >=
        floorY
      ) {
        this.y =
          floorY -
          this.height;

        this.velocityY = 0;
      }
    }

    this.applyContactDamage();
    this.redraw();
  }

  private updateDuelist(
    distanceX: number,
    deltaSeconds: number
  ): void {
    const targetSpeed =
      Math.abs(distanceX) < 68
        ? 0
        : Math.sign(distanceX) * 88;

    this.velocityX = moveTowards(
      this.velocityX,
      targetSpeed,
      410 * deltaSeconds
    );

    if (
      this.actionTimer <= 0 &&
      Math.abs(distanceX) < 210
    ) {
      this.velocityX =
        Math.sign(distanceX) * 255;

      this.actionTimer = 1.05;
    }

    this.x +=
      this.velocityX *
      deltaSeconds;
  }

  private updateCaster(
    distanceX: number,
    deltaSeconds: number
  ): void {
    const hoverTarget =
      this.spawn.y +
      Math.sin(
        this.elapsed * 2.2
      ) * 25;

    this.y = Phaser.Math.Linear(
      this.y,
      hoverTarget,
      1 -
      Math.exp(
        -4 * deltaSeconds
      )
    );

    this.velocityX = moveTowards(
      this.velocityX,
      Math.abs(distanceX) < 135
        ? -Math.sign(distanceX) * 45
        : Math.sign(distanceX) * 24,
      120 * deltaSeconds
    );

    this.x +=
      this.velocityX *
      deltaSeconds;

    if (this.actionTimer <= 0) {
      this.fireProjectile(
        this.x + this.width * 0.5,
        this.y + this.height * 0.5,
        this.player.centerX,
        this.player.centerY,
        0xe762ce
      );

      this.actionTimer = 1.25;
    }
  }

  private updateMime(
    deltaSeconds: number
  ): void {
    this.movementHistory.push(
      this.player.velocityX
    );

    if (
      this.movementHistory.length >
      30
    ) {
      const recorded =
        this.movementHistory.shift() ?? 0;

      const mirrored =
        -Phaser.Math.Clamp(
          recorded,
          -145,
          145
        );

      this.velocityX = moveTowards(
        this.velocityX,
        mirrored,
        520 * deltaSeconds
      );
    }

    this.x +=
      this.velocityX *
      deltaSeconds;

    if (
      this.actionTimer <= 0 &&
      Math.abs(
        this.player.centerX -
        (this.x + this.width * 0.5)
      ) < 180
    ) {
      this.velocityY = -285;
      this.actionTimer = 1.35;
    }
  }

  private applyContactDamage(): void {
    if (
      this.contactTimer > 0 ||
      !Phaser.Geom.Intersects
        .RectangleToRectangle(
          this.bounds,
          playerBounds(this.player)
        )
    ) {
      return;
    }

    if (
      this.playerHealth.receiveDamage(
        1,
        this.x + this.width * 0.5,
        195,
        -145
      )
    ) {
      this.contactTimer = 0.85;
    }
  }

  private visualTag(): string {
    if (this.defeated) {
      return `core_${this.spawn.kind}_defeated`;
    }

    if (this.spawn.kind === "duelist") {
      if (
        Math.abs(this.velocityX) > 180 &&
        this.actionTimer > 0.72
      ) {
        return "core_duelist_dash";
      }

      if (this.actionTimer < 0.18) {
        return "core_duelist_telegraph";
      }

      return Math.abs(this.velocityX) > 5
        ? "core_duelist_patrol"
        : "core_duelist_idle";
    }

    if (this.spawn.kind === "caster") {
      if (this.actionTimer > 1.05) {
        return "core_caster_cast";
      }

      if (this.actionTimer < 0.22) {
        return "core_caster_telegraph";
      }

      return "core_caster_hover";
    }

    if (Math.abs(this.velocityY) > 20) {
      return "core_mime_mimic";
    }

    if (this.movementHistory.length < 30) {
      return "core_mime_record";
    }

    return Math.abs(this.velocityX) > 5
      ? "core_mime_stalk"
      : "core_mime_idle";
  }

  private redraw(): void {
    this.graphics.clear();

    this.view.update({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      facing: this.facing,
      visible:
        this.active ||
        this.defeated,
      tag: this.visualTag(),
      flashing: this.flashTimer > 0
    });
  }
}

class MirrorConductor
implements CombatTarget {
  public x = 18225;
  public y = 205;

  public readonly width = 42;
  public readonly height = 64;

  public active = false;

  private health = 108;
  private shielded = true;
  private defeated = false;
  private markedTimer = 0;
  private flashTimer = 0;

  private visualTimer = 0;
  private visualMode:
    | "idle"
    | "entrance"
    | "cast"
    | "counter"
    | "hurt"
    | "transition12"
    | "transition23" = "idle";

  private previousPhase: 1 | 2 | 3 = 1;
  private facing: -1 | 1 = -1;
  private defeatSequenceStarted = false;

  // Each score is approximately 90 seconds. These minimum windows
  // prevent high damage from skipping an entire musical phase.
  private phaseElapsed = 0;

  private readonly minimumPhaseDuration = {
    1: 55,
    2: 60,
    3: 70
  } as const;

  private readonly view: BossView;

  public constructor(
    private readonly scene:
      Phaser.Scene,
    private readonly graphics:
      Phaser.GameObjects.Graphics,
    private readonly onCounter:
      (counter: BossCounter) => void,
    private readonly onDefeated:
      () => void
  ) {
    this.graphics.setDepth(47);

    this.view = new BossView(
      scene,
      46
    );

    this.view.reset(
      this.viewState(false)
    );
  }

  public get currentHealth(): number {
    return this.health;
  }

  public get phase(): 1 | 2 | 3 {
    if (this.health <= 36) {
      return 3;
    }

    if (this.health <= 72) {
      return 2;
    }

    return 1;
  }

  public get isShielded(): boolean {
    return this.shielded;
  }

  public get isDefeated(): boolean {
    return this.defeated;
  }

  public get bounds():
  Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x,
      this.y,
      this.width,
      this.height
    );
  }

  public setEnabled(
    enabled: boolean
  ): void {
    this.active =
      enabled &&
      !this.defeated;

    if (this.active) {
      this.visualMode = "entrance";
      this.visualTimer = 0.82;
      this.previousPhase = this.phase;
      this.phaseElapsed = 0;
    }

    this.updateView();
  }

  public breakShield(): void {
    if (
      !this.active ||
      !this.shielded
    ) {
      return;
    }

    this.shielded = false;
    this.flashTimer = 0.35;
    this.visualMode = "entrance";
    this.visualTimer = 0.72;

    this.scene.cameras.main.flash(
      220,
      115,
      239,
      255,
      false
    );

    this.scene.cameras.main.shake(
      150,
      0.006
    );
  }

  public receiveRangedHit(
    damage: number,
    sourceX: number
  ): boolean {
    if (!this.active) {
      return false;
    }

    this.markedTimer = 2.2;

    this.receiveHit(
      damage,
      60,
      -20,
      sourceX < this.x
        ? 1
        : -1
    );

    return true;
  }

  public receiveHit(
    damage: number,
    _knockbackX: number,
    _knockbackY: number,
    facing: -1 | 1
  ): void {
    if (!this.active) {
      return;
    }

    this.facing = facing;

    if (this.shielded) {
      this.onCounter({
        x:
          this.x +
          this.width * 0.5,
        y:
          this.y +
          this.height * 0.5
      });

      this.flashTimer = 0.1;
      this.visualMode = "counter";
      this.visualTimer = 0.48;
      return;
    }

    const phaseBefore = this.phase;

    const requestedHealth = Math.max(
      0,
      this.health - damage
    );

    const phaseFloor =
      phaseBefore === 1
        ? 73
        : phaseBefore === 2
          ? 37
          : 1;

    const phaseDuration =
      this.minimumPhaseDuration[
        phaseBefore
      ];

    this.health =
      this.phaseElapsed < phaseDuration
        ? Math.max(
            requestedHealth,
            phaseFloor
          )
        : requestedHealth;

    this.flashTimer = 0.12;

    if (this.health <= 0) {
      this.startDefeatSequence();
      return;
    }

    const phaseAfter = this.phase;

    if (phaseAfter !== phaseBefore) {
      this.phaseElapsed = 0;
    }

    if (
      phaseBefore === 1 &&
      phaseAfter >= 2
    ) {
      this.visualMode = "transition12";
      this.visualTimer = 1.0;
    } else if (
      phaseBefore <= 2 &&
      phaseAfter === 3
    ) {
      this.visualMode = "transition23";
      this.visualTimer = 1.12;
    } else {
      this.visualMode = "hurt";
      this.visualTimer = 0.3;
    }

    this.previousPhase = phaseAfter;
  }

  public reset(): void {
    this.x = 18225;
    this.y = 205;

    this.health = 108;
    this.shielded = true;
    this.active = false;
    this.defeated = false;

    this.markedTimer = 0;
    this.flashTimer = 0;
    this.visualTimer = 0;
    this.visualMode = "idle";
    this.previousPhase = 1;
    this.facing = -1;
    this.defeatSequenceStarted = false;
    this.phaseElapsed = 0;

    this.graphics.clear();

    this.view.reset(
      this.viewState(false)
    );
  }

  public update(
    deltaSeconds: number,
    elapsed: number,
    player: PlayerController,
    fireProjectile: (
      x: number,
      y: number,
      targetX: number,
      targetY: number,
      color?: number
    ) => void
  ): void {
    if (!this.active) {
      return;
    }

    this.phaseElapsed +=
      deltaSeconds;

    this.flashTimer = Math.max(
      0,
      this.flashTimer - deltaSeconds
    );

    this.markedTimer = Math.max(
      0,
      this.markedTimer - deltaSeconds
    );

    this.visualTimer = Math.max(
      0,
      this.visualTimer - deltaSeconds
    );

    this.facing =
      player.centerX <
      this.x + this.width * 0.5
        ? -1
        : 1;

    this.y =
      205 +
      Math.sin(elapsed * 1.8) *
      34;

    const currentPhase = this.phase;

    if (
      currentPhase !==
      this.previousPhase
    ) {
      if (
        this.previousPhase === 1 &&
        currentPhase >= 2
      ) {
        this.visualMode = "transition12";
        this.visualTimer = 1.0;
      } else if (
        this.previousPhase <= 2 &&
        currentPhase === 3
      ) {
        this.visualMode = "transition23";
        this.visualTimer = 1.12;
      }

      this.previousPhase =
        currentPhase;
    }

    if (
      this.visualTimer <= 0 &&
      this.visualMode !== "idle"
    ) {
      this.visualMode = "idle";
    }

    const interval =
      currentPhase === 1
        ? 1.15
        : currentPhase === 2
          ? 0.9
          : 0.62;

    const previousCycle =
      Math.floor(
        (elapsed - deltaSeconds) /
        interval
      );

    const currentCycle =
      Math.floor(
        elapsed /
        interval
      );

    if (
      currentCycle !== previousCycle
    ) {
      const count =
        currentPhase === 3
          ? 3
          : currentPhase === 2
            ? 2
            : 1;

      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        fireProjectile(
          this.x +
            this.width * 0.5,
          this.y +
            this.height * 0.5,
          player.centerX,
          player.centerY +
            (
              index -
              (count - 1) * 0.5
            ) *
            55,
          index % 2 === 0
            ? 0xe95acb
            : 0x75eaf1
        );
      }

      if (
        this.visualMode === "idle"
      ) {
        this.visualMode = "cast";
        this.visualTimer = 0.48;
      }
    }

    this.updateView();
    this.redrawVfx(elapsed);
  }

  private startDefeatSequence(): void {
    if (this.defeatSequenceStarted) {
      return;
    }

    this.defeatSequenceStarted = true;
    this.defeated = true;
    this.active = false;

    this.graphics.clear();

    this.view.playDefeatSequence(
      this.viewState(true),
      () => {
        this.onDefeated();
      }
    );
  }

  private updateView(): void {
    this.view.update(
      this.viewState(this.active),
      this.selectAnimation()
    );
  }

  private viewState(
    visible: boolean
  ): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly facing: -1 | 1;
    readonly phase: 1 | 2 | 3;
    readonly visible: boolean;
    readonly flashing: boolean;
  } {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      facing: this.facing,
      phase: this.phase,
      visible,
      flashing: this.flashTimer > 0
    };
  }

  private selectAnimation(): string {
    const phase = this.phase;

    switch (this.visualMode) {
      case "entrance":
        return "boss_entrance";

      case "transition12":
        return "boss_transition_1_2";

      case "transition23":
        return "boss_transition_2_3";

      case "cast":
        return `boss_phase${phase}_cast`;

      case "counter":
        return `boss_phase${phase}_counter`;

      case "hurt":
        return `boss_hurt_phase${phase}`;

      case "idle":
        return `boss_phase${phase}_idle`;
    }
  }

  private redrawVfx(
    elapsed: number
  ): void {
    const g = this.graphics;
    g.clear();

    if (!this.active) {
      return;
    }

    const centerX =
      this.x +
      this.width * 0.5;

    const centerY =
      this.y +
      this.height * 0.5;

    if (
      this.phase >= 2 &&
      this.markedTimer <= 0
    ) {
      for (
        const offset of [-105, 105]
      ) {
        g.fillStyle(
          0x723769,
          0.2
        );

        g.fillRoundedRect(
          this.x + offset,
          this.y,
          this.width,
          this.height,
          9
        );

        g.lineStyle(
          2,
          0xe95acb,
          0.45
        );

        g.strokeRoundedRect(
          this.x + offset,
          this.y,
          this.width,
          this.height,
          9
        );
      }
    }

    if (this.markedTimer > 0) {
      g.lineStyle(
        4,
        0xf6d466,
        1
      );

      g.strokeCircle(
        centerX,
        centerY,
        38 +
          Math.sin(elapsed * 7) *
          3
      );
    }

    if (this.shielded) {
      g.lineStyle(
        5,
        0x91f5f4,
        0.86
      );

      g.strokeCircle(
        centerX,
        centerY,
        41
      );
    }
  }
}

export class MirrorCoreSystem {
  private elapsed = 0;
  private previousSpotlightCasts = 0;

  private entered = false;
  private relaysCheckpointReached = false;
  private gauntletStarted = false;
  private gauntletCleared = false;
  private bossStarted = false;
  private bossDefeated = false;

  private hazardCooldown = 0;

  private readonly graphics:
    Phaser.GameObjects.Graphics;

  private readonly background:
    Phaser.GameObjects.Graphics;

  private readonly hudText:
    Phaser.GameObjects.Text;

  private finaleActive = false;
  private finaleTime = 0;
  private finaleBurstTimer = 0;
  private finaleCreditsVisible = false;

  private readonly finaleParticles:
    FinaleParticle[] = [];

  private readonly finaleGraphics:
    Phaser.GameObjects.Graphics;

  private readonly finaleOverlay:
    Phaser.GameObjects.Graphics;

  private readonly finaleTitle:
    Phaser.GameObjects.Text;

  private readonly finaleHint:
    Phaser.GameObjects.Text;

  private readonly finaleCredits:
    Phaser.GameObjects.Text;

  private readonly bossHudGraphics:
    Phaser.GameObjects.Graphics;

  private readonly bossHudText:
    Phaser.GameObjects.Text;

  private readonly relayGate =
    createWorldGate("MirrorRelay");

  private readonly bossGate =
    createWorldGate("MirrorBoss");

  private readonly exitGate =
    createWorldGate("MirrorExit");

  private readonly relays:
    MirrorRelay[];

  private readonly enemies:
    CoreEnemy[];

  private readonly projectiles:
    CoreProjectile[] = [];

  private readonly roses:
    Rose[];

  private readonly movingMirrors:
    MovingMirror[];

  private readonly conductor:
    MirrorConductor;

  public constructor(
    private readonly scene:
      Phaser.Scene,
    private readonly player:
      PlayerController,
    private readonly playerHealth:
      PlayerHealthSystem,
    combatSystem:
      CombatSystem,
    private readonly magicSystem:
      MagicSystem,
    private readonly addSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void,
    private readonly removeSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void
  ) {
    this.graphics =
      scene.add.graphics();

    this.graphics.setDepth(42);

    this.background =
      scene.add.graphics();

    this.background.setDepth(-3);

    this.hudText = scene.add.text(
      320,
      62,
      "",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#d7fbff",
        backgroundColor: "#050713e8",
        padding: {
          x: 10,
          y: 7
        }
      }
    );

    this.hudText
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1220)
      .setVisible(false);

    this.finaleGraphics =
      scene.add.graphics();

    this.finaleGraphics
      .setDepth(1320);

    this.finaleOverlay =
      scene.add.graphics();

    this.finaleOverlay
      .setScrollFactor(0)
      .setDepth(1900);

    this.finaleTitle = scene.add.text(
      320,
      88,
      [
        "CONGRATULATION",
        "",
        "NOW YOU ARE AN",
        "IMPRESSARIO TRUE MAGICIAN"
      ].join("\n"),
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "17px",
        color: "#ffe184",
        stroke: "#130718",
        strokeThickness: 5,
        backgroundColor: "#080713d9",
        padding: {
          x: 18,
          y: 12
        }
      }
    );

    this.finaleTitle
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1950)
      .setAlpha(0)
      .setVisible(false);

    this.finaleHint = scene.add.text(
      320,
      272,
      [
        "THE CURTAIN FALLS...",
        "BUT THE GRAND PERFORMANCE MAY CONTINUE."
      ].join("\n"),
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8ff4f2",
        stroke: "#060913",
        strokeThickness: 4,
        backgroundColor: "#050711d9",
        padding: {
          x: 12,
          y: 9
        }
      }
    );

    this.finaleHint
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(1951)
      .setAlpha(0)
      .setVisible(false);

    this.finaleCredits = scene.add.text(
      320,
      72,
      [
        "IMPRESSARIO",
        "THE MIDNIGHT SHOW",
        "",
        "A GAME BY",
        "DEMIAN LIENERT",
        "",
        "PROGRAMMING / LOGIC / DESIGN",
        "TYPESCRIPT",
        "",
        "THANK YOU FOR PLAYING"
      ].join("\n"),
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#f5df9c",
        stroke: "#05060c",
        strokeThickness: 4,
        lineSpacing: 7
      }
    );

    this.finaleCredits
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2000)
      .setAlpha(0)
      .setVisible(false);

    this.bossHudGraphics =
      scene.add.graphics();

    this.bossHudGraphics
      .setScrollFactor(0)
      .setDepth(1240)
      .setVisible(false);

    this.bossHudText = scene.add.text(
      452,
      7,
      "",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f6d675",
        stroke: "#050713",
        strokeThickness: 3
      }
    );

    this.bossHudText
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1241)
      .setVisible(false);

    this.relays = [
      new MirrorRelay(
        scene,
        14865,
        198,
        () => this.onRelayActivated()
      ),
      new MirrorRelay(
        scene,
        15225,
        292,
        () => this.onRelayActivated()
      )
    ];

    for (const relay of this.relays) {
      combatSystem.registerTarget(relay);
    }

    this.enemies =
      ENEMY_SPAWNS.map(
        spawn =>
          new CoreEnemy(
            scene,
            player,
            playerHealth,
            spawn,
            scene.add.graphics().setDepth(44),
            (
              x,
              y,
              targetX,
              targetY,
              color
            ) =>
              this.fireProjectile(
                x,
                y,
                targetX,
                targetY,
                color
              )
          )
      );

    for (const enemy of this.enemies) {
      combatSystem.registerTarget(enemy);
    }

    this.conductor =
      new MirrorConductor(
        scene,
        scene.add.graphics().setDepth(46),
        counter => {
          this.fireProjectile(
            counter.x,
            counter.y,
            player.centerX,
            player.centerY,
            0xf2c963
          );
        },
        () => {
          this.completeBoss();
        }
      );

    combatSystem.registerTarget(
      this.conductor
    );

    this.roses =
      ROSE_POSITIONS.map(
        position => ({
          x: position.x,
          y: position.y,
          consumed: false
        })
      );

    this.movingMirrors = [
      {
        solid:
          new Phaser.Geom.Rectangle(
            14710,
            408,
            82,
            14
          ),
        originX: 14710,
        originY: 408,
        travelX: 0,
        travelY: -82,
        speed: 1.25,
        phase: 0,
        previousX: 14710,
        previousY: 408
      },
      {
        solid:
          new Phaser.Geom.Rectangle(
            15018,
            390,
            82,
            14
          ),
        originX: 15018,
        originY: 390,
        travelX: 86,
        travelY: 0,
        speed: 1.05,
        phase: 1.4,
        previousX: 15018,
        previousY: 390
      },
      {
        solid:
          new Phaser.Geom.Rectangle(
            15805,
            375,
            86,
            14
          ),
        originX: 15805,
        originY: 375,
        travelX: 0,
        travelY: -105,
        speed: 1.45,
        phase: 2.1,
        previousX: 15805,
        previousY: 375
      }
    ];

    for (
      const platform of
      this.movingMirrors
    ) {
      this.addSolid(platform.solid);
    }

    this.addSolid(this.relayGate);
    this.addSolid(this.bossGate);
    this.addSolid(this.exitGate);


    this.previousSpotlightCasts =
      this.magicSystem.castsPerformed;

    this.createEnvironment();
  }

  public update(
    deltaSeconds: number
  ): void {
    this.graphics.clear();
    this.elapsed += deltaSeconds;

    this.hazardCooldown = Math.max(
      0,
      this.hazardCooldown -
        deltaSeconds
    );

    if (
      this.player.x >=
        MIRROR_CORE_START_X &&
      this.player.y > 675
    ) {
      this.playerHealth.fallOut();
      return;
    }

    this.updateProgression();
    this.updateMovingMirrors();
    this.updateRelays(deltaSeconds);
    this.updateEnemies(deltaSeconds);
    this.updateBoss(deltaSeconds);
    this.updateProjectiles(deltaSeconds);
    this.updateHazards();
    this.updateRoses();
    this.updateFinale(deltaSeconds);
    this.redraw();

  }

  public resetAfterDeath(): void {
    this.elapsed = 0;
    this.hazardCooldown = 0;
    this.projectiles.length = 0;

    for (const rose of this.roses) {
      rose.consumed = false;
    }

    if (
      !this.relaysCheckpointReached
    ) {
      for (const relay of this.relays) {
        relay.reset();
      }

      this.addSolid(this.relayGate);
    } else {
      for (const relay of this.relays) {
        relay.forceActivated();
      }

      this.removeSolid(this.relayGate);
    }

    if (!this.gauntletCleared) {
      this.gauntletStarted = false;

      for (
        const enemy of this.enemies
      ) {
        enemy.reset();
      }

      this.addSolid(this.bossGate);
    }

    if (!this.bossDefeated) {
      this.bossStarted = false;
      this.conductor.reset();
      this.addSolid(this.exitGate);
    }

    for (
      const platform of
      this.movingMirrors
    ) {
      platform.solid.x =
        platform.originX;

      platform.solid.y =
        platform.originY;

      platform.previousX =
        platform.originX;

      platform.previousY =
        platform.originY;
    }

    this.hudText
      .setVisible(false)
      .setText("");

    this.previousSpotlightCasts =
      this.magicSystem.castsPerformed;
  }

  private updateProgression(): void {
    if (
      !this.entered &&
      this.player.x >= getWorldCheckpoint("MirrorCore").triggerX
    ) {
      this.entered = true;

      this.playerHealth.setCheckpoint(
        getWorldCheckpoint(
          "MirrorCore"
        )
      );

      this.scene.cameras.main.flash(
        260,
        80,
        220,
        245,
        false
      );
    }

    if (
      !this.gauntletStarted &&
      this.relaysCheckpointReached &&
      this.player.x >= 15345
    ) {
      this.gauntletStarted = true;

      for (
        const enemy of this.enemies
      ) {
        enemy.setEnabled(true);
      }

      this.hudText
        .setVisible(true);
    }

    if (
      this.gauntletStarted &&
      !this.gauntletCleared &&
      this.enemies.every(
        enemy => enemy.isDefeated
      )
    ) {
      this.gauntletCleared = true;
      this.gauntletStarted = false;

      this.removeSolid(this.bossGate);

      this.playerHealth.setCheckpoint(
        getWorldCheckpoint(
          "CoreChamber"
        )
      );

      this.scene.cameras.main.flash(
        220,
        242,
        201,
        94,
        false
      );
    }

    if (
      this.gauntletCleared &&
      !this.bossStarted &&
      !this.bossDefeated &&
      this.player.x >= 17880
    ) {
      this.bossStarted = true;

      this.conductor.setEnabled(true);

      this.hudText
        .setVisible(true);
    }
  }

  private onRelayActivated(): void {
    if (
      !this.relays.every(
        relay => relay.isActivated
      )
    ) {
      return;
    }

    this.relaysCheckpointReached = true;

    this.removeSolid(this.relayGate);

    this.playerHealth.setCheckpoint(
        getWorldCheckpoint(
          "MirrorRelays"
        )
      );

    this.scene.cameras.main.shake(
      180,
      0.004
    );
  }

  private updateMovingMirrors(): void {
    const playerBottom =
      this.player.y +
      this.player.height;

    for (
      const platform of
      this.movingMirrors
    ) {
      platform.previousX =
        platform.solid.x;

      platform.previousY =
        platform.solid.y;

      const wave =
        (
          Math.sin(
            this.elapsed *
              platform.speed +
              platform.phase
          ) +
          1
        ) * 0.5;

      platform.solid.x =
        platform.originX +
        platform.travelX * wave;

      platform.solid.y =
        platform.originY +
        platform.travelY * wave;

      const deltaX =
        platform.solid.x -
        platform.previousX;

      const deltaY =
        platform.solid.y -
        platform.previousY;

      const standing =
        this.player.x +
          this.player.width >
          platform.previousX + 2 &&
        this.player.x <
          platform.previousX +
          platform.solid.width - 2 &&
        Math.abs(
          playerBottom -
          platform.previousY
        ) < 4 &&
        this.player.velocityY >= 0;

      if (standing) {
        this.player.x += deltaX;
        this.player.y += deltaY;
      }
    }
  }

  private updateRelays(
    deltaSeconds: number
  ): void {
    for (const relay of this.relays) {
      relay.update(
        deltaSeconds,
        this.elapsed
      );
    }
  }

  private updateEnemies(
    deltaSeconds: number
  ): void {
    for (const enemy of this.enemies) {
      enemy.update(deltaSeconds);
    }
  }

  private updateBoss(
    deltaSeconds: number
  ): void {
    if (!this.bossStarted) {
      this.bossHudGraphics
        .setVisible(false)
        .clear();

      this.bossHudText
        .setVisible(false)
        .setText("");

      return;
    }

    const casts =
      this.magicSystem
        .castsPerformed;

    if (
      casts !==
      this.previousSpotlightCasts
    ) {
      const distance =
        Phaser.Math.Distance.Between(
          this.player.centerX,
          this.player.centerY,
          this.conductor.bounds.centerX,
          this.conductor.bounds.centerY
        );

      if (distance <= 190) {
        this.conductor.breakShield();
      }
    }

    this.previousSpotlightCasts =
      casts;

    this.conductor.update(
      deltaSeconds,
      this.elapsed,
      this.player,
      (
        x,
        y,
        targetX,
        targetY,
        color
      ) =>
        this.fireProjectile(
          x,
          y,
          targetX,
          targetY,
          color
        )
    );

    this.redrawBossHud();
  }

  private redrawBossHud(): void {
    if (
      !this.bossStarted ||
      this.conductor.isDefeated
    ) {
      this.bossHudGraphics
        .setVisible(false)
        .clear();

      this.bossHudText
        .setVisible(false)
        .setText("");

      return;
    }

    const g =
      this.bossHudGraphics;

    g.setVisible(true);
    g.clear();

    const x = 285;
    const y = 22;
    const width = 335;
    const height = 17;

    const healthRatio =
      Phaser.Math.Clamp(
        this.conductor.currentHealth /
          108,
        0,
        1
      );

    g.fillStyle(
      0x03050d,
      0.94
    );

    g.fillRoundedRect(
      x - 3,
      y - 3,
      width + 6,
      height + 6,
      6
    );

    g.fillStyle(
      0x24112e,
      1
    );

    g.fillRoundedRect(
      x,
      y,
      width,
      height,
      4
    );

    const healthColor =
      this.conductor.phase === 3
        ? 0xe653bf
        : this.conductor.phase === 2
          ? 0x9c58db
          : 0x63dce8;

    g.fillStyle(
      healthColor,
      1
    );

    g.fillRoundedRect(
      x,
      y,
      width * healthRatio,
      height,
      4
    );

    g.lineStyle(
      2,
      0xe5ba55,
      1
    );

    g.strokeRoundedRect(
      x,
      y,
      width,
      height,
      4
    );

    // Phase separators.
    g.lineStyle(
      1,
      0xf6e6bc,
      0.72
    );

    g.lineBetween(
      x + width / 3,
      y,
      x + width / 3,
      y + height
    );

    g.lineBetween(
      x + width * 2 / 3,
      y,
      x + width * 2 / 3,
      y + height
    );

    this.bossHudText
      .setVisible(true)
      .setText(
        `THE MIRROR CONDUCTOR — PHASE ${
          this.conductor.phase
        }`
      );
  }

  private fireProjectile(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    color = 0xe95acb
  ): void {
    const direction =
      new Phaser.Math.Vector2(
        targetX - x,
        targetY - y
      );

    if (
      direction.lengthSq() <=
      0.0001
    ) {
      direction.set(1, 0);
    }

    direction.normalize();

    const speed =
      this.bossStarted
        ? 230
        : 195;

    this.projectiles.push({
      x,
      y,
      velocityX:
        direction.x * speed,
      velocityY:
        direction.y * speed,
      lifetime: 4,
      radius: 6,
      color,
      active: true
    });
  }

  private updateProjectiles(
    deltaSeconds: number
  ): void {
    if (
      this.bossStarted &&
      this.conductor.isDefeated
    ) {
      this.projectiles.length = 0;
      return;
    }

    const bounds =
      playerBounds(this.player);

    for (
      const projectile of
      this.projectiles
    ) {
      if (!projectile.active) {
        continue;
      }

      projectile.lifetime -=
        deltaSeconds;

      projectile.x +=
        projectile.velocityX *
        deltaSeconds;

      projectile.y +=
        projectile.velocityY *
        deltaSeconds;

      if (
        projectile.lifetime <= 0 ||
        projectile.x <
          MIRROR_CORE_START_X - 80 ||
        projectile.x >
          MIRROR_CORE_END_X + 80 ||
        projectile.y < -80 ||
        projectile.y > 760
      ) {
        projectile.active = false;
        continue;
      }

      if (
        circleIntersectsRectangle(
          projectile.x,
          projectile.y,
          projectile.radius,
          bounds
        )
      ) {
        if (
          this.playerHealth
            .receiveDamage(
              1,
              projectile.x,
              190,
              -135
            )
        ) {
          projectile.active = false;
        }
      }
    }

    const active =
      this.projectiles.filter(
        projectile =>
          projectile.active
      );

    this.projectiles.length = 0;
    this.projectiles.push(...active);
  }

  private updateHazards(): void {
    if (
      this.bossStarted &&
      this.conductor.isDefeated
    ) {
      return;
    }

    if (
      this.player.x <
        MIRROR_CORE_START_X ||
      this.hazardCooldown > 0
    ) {
      return;
    }

    const bounds =
      playerBounds(this.player);

    for (
      const spike of SPIKE_RECTS
    ) {
      if (
        Phaser.Geom.Intersects
          .RectangleToRectangle(
            bounds,
            spike
          )
      ) {
        this.damageHazard(
          spike.centerX
        );

        return;
      }
    }

    // Alternating vertical refraction
    // windows in the relay ascent.
    for (
      let index = 0;
      index < 3;
      index += 1
    ) {
      const x =
        14645 + index * 295;

      const cycle =
        (
          this.elapsed +
          index * 0.62
        ) % 2.6;

      const active =
        cycle >= 0.72 &&
        cycle < 1.7;

      if (
        active &&
        Phaser.Geom.Intersects
          .RectangleToRectangle(
            bounds,
            new Phaser.Geom.Rectangle(
              x - 5,
              115,
              10,
              405
            )
          )
      ) {
        this.damageHazard(x);
        return;
      }
    }

    if (
      this.gauntletStarted ||
      this.bossStarted
    ) {
      const centerX =
        this.bossStarted
          ? 18240
          : 15900;

      const centerY =
        this.bossStarted
          ? 250
          : 310;

      const length =
        this.bossStarted
          ? 420
          : 310;

      const count =
        this.bossStarted
          ? this.conductor.phase
          : 2;

      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        const angle =
          this.elapsed *
            (
              this.bossStarted
                ? 1.35
                : 0.9
            ) +
          index *
            Math.PI /
            count;

        const endX =
          centerX +
          Math.cos(angle) *
          length;

        const endY =
          centerY +
          Math.sin(angle) *
          length;

        const beamCycle =
          this.elapsed % 2.4;

        const beamActive =
          !this.bossStarted ||
          (
            beamCycle >= 0.62 &&
            beamCycle < 1.02
          );

        if (
          beamActive &&
          lineIntersectsRectangle(
            centerX,
            centerY,
            endX,
            endY,
            bounds,
            5
          )
        ) {
          this.damageHazard(
            centerX
          );

          return;
        }
      }
    }

    if (
      this.bossStarted &&
      this.conductor.phase === 3
    ) {
      const cycle =
        this.elapsed % 3.2;

      const dangerousLeft =
        cycle < 1.35;

      const floorHazard =
        dangerousLeft
          ? new Phaser.Geom.Rectangle(
              17865,
              312,
              340,
              18
            )
          : new Phaser.Geom.Rectangle(
              18205,
              312,
              390,
              18
            );

      if (
        Phaser.Geom.Intersects
          .RectangleToRectangle(
            bounds,
            floorHazard
          )
      ) {
        this.damageHazard(
          floorHazard.centerX
        );
      }
    }
  }

  private damageHazard(
    sourceX: number
  ): void {
    if (
      this.playerHealth
        .receiveDamage(
          1,
          sourceX,
          175,
          -170
        )
    ) {
      this.hazardCooldown = 1.15;
    }
  }

  private updateRoses(): void {
    const bounds =
      playerBounds(this.player);

    for (const rose of this.roses) {
      if (
        rose.consumed ||
        !Phaser.Geom.Intersects
          .RectangleToRectangle(
            bounds,
            new Phaser.Geom.Rectangle(
              rose.x - 9,
              rose.y - 19,
              18,
              20
            )
          )
      ) {
        continue;
      }

      if (
        this.playerHealth.heal(1)
      ) {
        rose.consumed = true;

        this.scene.cameras.main
          .shake(
            55,
            0.0015
          );
      }
    }
  }

  private completeBoss(): void {
    this.bossDefeated = true;
    this.bossStarted = false;

    this.removeSolid(this.exitGate);

    this.projectiles.length = 0;

    this.startFinale();

    this.bossHudGraphics
      .setVisible(false)
      .clear();

    this.bossHudText
      .setVisible(false)
      .setText("");

    this.hudText.setText(
      "MIRROR CORE STABILIZED — ACT IX AWAITS"
    );

    this.scene.cameras.main.flash(
      420,
      245,
      210,
      105,
      false
    );

    this.scene.time.delayedCall(
      3600,
      () => {
        this.hudText.setVisible(false);
      }
    );
  }

  private startFinale(): void {
    if (this.finaleActive) {
      return;
    }

    this.finaleActive = true;

    void leaderboard.finishRun();

    this.finaleTime = 0;
    this.finaleBurstTimer = 0;
    this.finaleCreditsVisible = false;

    this.projectiles.length = 0;

    this.player.velocityX = 0;
    this.player.velocityY = 0;

    this.hudText
      .setVisible(false)
      .setText("");

    this.bossHudGraphics
      .setVisible(false)
      .clear();

    this.bossHudText
      .setVisible(false)
      .setText("");

    this.finaleTitle
      .setVisible(true)
      .setAlpha(0);

    this.finaleHint
      .setVisible(false)
      .setAlpha(0);

    this.finaleCredits
      .setVisible(false)
      .setAlpha(0);

    this.spawnFinaleBurst(
      18242,
      225,
      48
    );

    this.spawnFinaleBurst(
      18195,
      185,
      30
    );

    this.spawnFinaleBurst(
      18292,
      175,
      30
    );

    this.scene.cameras.main.flash(
      650,
      255,
      222,
      115,
      false
    );

    this.scene.cameras.main.shake(
      420,
      0.009
    );
  }

  private spawnFinaleBurst(
    x: number,
    y: number,
    amount: number
  ): void {
    const colors = [
      0xffd565,
      0xf05ac7,
      0x75edf2,
      0xffffff,
      0x8ff0a8
    ] as const;

    for (
      let index = 0;
      index < amount;
      index += 1
    ) {
      const angle =
        Phaser.Math.FloatBetween(
          0,
          Math.PI * 2
        );

      const speed =
        Phaser.Math.FloatBetween(
          75,
          245
        );

      const lifetime =
        Phaser.Math.FloatBetween(
          0.8,
          1.85
        );

      this.finaleParticles.push({
        x,
        y,
        velocityX:
          Math.cos(angle) *
          speed,
        velocityY:
          Math.sin(angle) *
          speed -
          Phaser.Math.FloatBetween(
            15,
            75
          ),
        lifetime,
        maximumLifetime:
          lifetime,
        color:
          colors[
            Phaser.Math.Between(
              0,
              colors.length - 1
            )
          ] ?? 0xffffff,
        size:
          Phaser.Math.FloatBetween(
            2,
            5
          )
      });
    }
  }

  private updateFinale(
    deltaSeconds: number
  ): void {
    if (!this.finaleActive) {
      return;
    }

    this.finaleTime +=
      deltaSeconds;

    this.finaleBurstTimer -=
      deltaSeconds;

    this.player.velocityY = 0;

    if (this.finaleTime < 4.4) {
      this.player.velocityX = 0;

      if (
        this.finaleBurstTimer <= 0 &&
        this.finaleTime < 3.6
      ) {
        const burstX =
          Phaser.Math.Between(
            18080,
            18460
          );

        const burstY =
          Phaser.Math.Between(
            90,
            275
          );

        this.spawnFinaleBurst(
          burstX,
          burstY,
          Phaser.Math.Between(
            18,
            32
          )
        );

        this.finaleBurstTimer = 0.48;
      }
    } else if (
      this.finaleTime < 8.7
    ) {
      const targetX = 18570;

      const direction =
        targetX >
        this.player.x
          ? 1
          : 0;

      this.player.facing = 1;
      this.player.velocityX =
        direction * 105;

      this.player.x = Math.min(
        targetX,
        this.player.x +
          105 * deltaSeconds
      );
    } else {
      this.player.velocityX = 0;
    }

    for (
      const particle of
      this.finaleParticles
    ) {
      particle.lifetime -=
        deltaSeconds;

      particle.velocityY +=
        155 * deltaSeconds;

      particle.velocityX *=
        Math.pow(
          0.985,
          deltaSeconds * 60
        );

      particle.x +=
        particle.velocityX *
        deltaSeconds;

      particle.y +=
        particle.velocityY *
        deltaSeconds;
    }

    const activeParticles =
      this.finaleParticles.filter(
        particle =>
          particle.lifetime > 0
      );

    this.finaleParticles.length = 0;
    this.finaleParticles.push(
      ...activeParticles
    );

    const titleAlpha =
      this.finaleTime < 0.6
        ? this.finaleTime / 0.6
        : this.finaleTime < 4.2
          ? 1
          : Phaser.Math.Clamp(
              1 -
              (
                this.finaleTime -
                4.2
              ) / 0.8,
              0,
              1
            );

    this.finaleTitle
      .setVisible(
        titleAlpha > 0
      )
      .setAlpha(
        titleAlpha
      );

    const hintAlpha =
      this.finaleTime < 7.5
        ? 0
        : this.finaleTime < 8.3
          ? (
              this.finaleTime -
              7.5
            ) / 0.8
          : this.finaleTime < 10.3
            ? 1
            : Phaser.Math.Clamp(
                1 -
                (
                  this.finaleTime -
                  10.3
                ) / 0.7,
                0,
                1
              );

    this.finaleHint
      .setVisible(
        hintAlpha > 0
      )
      .setAlpha(
        hintAlpha
      );

    if (
      this.finaleTime >= 10.5
    ) {
      const fade =
        Phaser.Math.Clamp(
          (
            this.finaleTime -
            10.5
          ) / 1.2,
          0,
          1
        );

      this.finaleOverlay.clear();

      this.finaleOverlay.fillStyle(
        0x020308,
        fade
      );

      this.finaleOverlay.fillRect(
        0,
        0,
        640,
        360
      );

      if (
        fade >= 0.96 &&
        !this.finaleCreditsVisible
      ) {
        this.finaleCreditsVisible = true;

        this.finaleCredits
          .setVisible(true)
          .setAlpha(0);
      }

      if (
        this.finaleCreditsVisible
      ) {
        this.finaleCredits.setAlpha(
          Phaser.Math.Clamp(
            (
              this.finaleTime -
              11.65
            ) / 1.2,
            0,
            1
          )
        );
      }
    }

    this.redrawFinale();
  }

  private redrawFinale(): void {
    const g =
      this.finaleGraphics;

    g.clear();

    if (!this.finaleActive) {
      return;
    }

    // Majestic illuminated gate.
    const gateX = 18582;
    const gateY = 82;
    const gateWidth = 92;
    const gateHeight = 244;

    const glow =
      0.72 +
      Math.sin(
        this.finaleTime * 3
      ) * 0.18;

    g.fillStyle(
      0xffdf72,
      0.11 * glow
    );

    g.fillRoundedRect(
      gateX - 24,
      gateY - 24,
      gateWidth + 48,
      gateHeight + 28,
      42
    );

    g.fillStyle(
      0x101c36,
      1
    );

    g.fillRoundedRect(
      gateX,
      gateY,
      gateWidth,
      gateHeight,
      34
    );

    g.lineStyle(
      9,
      0xe4b84f,
      0.96
    );

    g.strokeRoundedRect(
      gateX,
      gateY,
      gateWidth,
      gateHeight,
      34
    );

    g.lineStyle(
      4,
      0x7bf2ef,
      0.88
    );

    g.strokeRoundedRect(
      gateX + 13,
      gateY + 14,
      gateWidth - 26,
      gateHeight - 18,
      27
    );

    g.fillStyle(
      0xffed9c,
      0.42 +
      Math.sin(
        this.finaleTime * 4
      ) * 0.12
    );

    g.fillRoundedRect(
      gateX + 23,
      gateY + 27,
      gateWidth - 46,
      gateHeight - 29,
      20
    );

    g.lineStyle(
      2,
      0xffffff,
      0.68
    );

    for (
      let ray = 0;
      ray < 7;
      ray += 1
    ) {
      const angle =
        -Math.PI * 0.88 +
        ray * Math.PI * 0.13;

      g.lineBetween(
        gateX +
          gateWidth * 0.5,
        gateY + 28,
        gateX +
          gateWidth * 0.5 +
          Math.cos(angle) * 150,
        gateY + 28 +
          Math.sin(angle) * 150
      );
    }

    for (
      const particle of
      this.finaleParticles
    ) {
      const alpha =
        Phaser.Math.Clamp(
          particle.lifetime /
          particle.maximumLifetime,
          0,
          1
        );

      g.fillStyle(
        particle.color,
        alpha * 0.18
      );

      g.fillCircle(
        particle.x,
        particle.y,
        particle.size * 3
      );

      g.fillStyle(
        particle.color,
        alpha
      );

      g.fillCircle(
        particle.x,
        particle.y,
        particle.size
      );
    }
  }

  private createEnvironment(): void {
    const g = this.background;

    g.fillStyle(
      0x030711,
      1
    );

    g.fillRect(
      MIRROR_CORE_START_X,
      0,
      MIRROR_CORE_END_X -
        MIRROR_CORE_START_X,
      720
    );

    for (
      let x =
        MIRROR_CORE_START_X;
      x <
        MIRROR_CORE_END_X;
      x += 180
    ) {
      const alternate =
        Math.floor(
          (
            x -
            MIRROR_CORE_START_X
          ) / 180
        ) % 2 === 0;

      g.fillStyle(
        alternate
          ? 0x08182c
          : 0x1b0b2c,
        0.94
      );

      g.fillTriangle(
        x,
        0,
        x + 180,
        0,
        x + 90,
        720
      );

      g.lineStyle(
        2,
        alternate
          ? 0x70e8ef
          : 0xe25bc6,
        0.22
      );

      g.lineBetween(
        x + 90,
        0,
        x + 90,
        720
      );
    }

    for (
      let x = 14520;
      x < 18640;
      x += 360
    ) {
      g.lineStyle(
        5,
        0xd4ae4d,
        0.48
      );

      g.strokeCircle(
        x,
        145,
        62
      );

      g.lineStyle(
        2,
        0x75eaf1,
        0.5
      );

      g.strokeCircle(
        x,
        145,
        43
      );

      for (
        let ray = 0;
        ray < 8;
        ray += 1
      ) {
        const angle =
          ray / 8 *
          Math.PI * 2;

        g.lineBetween(
          x +
            Math.cos(angle) *
            20,
          145 +
            Math.sin(angle) *
            20,
          x +
            Math.cos(angle) *
            58,
          145 +
            Math.sin(angle) *
            58
        );
      }
    }

    this.scene.add.text(
      14445,
      66,
      "ACT VIII — THE MIRROR CORE",
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8ff5f5",
        backgroundColor: "#040711e8",
        padding: {
          x: 11,
          y: 8
        }
      }
    ).setDepth(41);

    this.scene.add.text(
      14445,
      104,
      [
        "Refraction Ascent",
        "Grand Card activates the Mirror Relays."
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f2cd66",
        backgroundColor: "#040711d9",
        padding: {
          x: 8,
          y: 6
        }
      }
    ).setDepth(41);

    this.scene.add.text(
      15355,
      88,
      "KALEIDOSCOPE GAUNTLET",
      {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ea6dce",
        backgroundColor: "#040711d9",
        padding: {
          x: 8,
          y: 6
        }
      }
    ).setDepth(41);

    this.scene.add.text(
      17895,
      82,
      "CORE CHAMBER — MIRROR CONDUCTOR",
      {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f1cf67",
        backgroundColor: "#040711d9",
        padding: {
          x: 8,
          y: 6
        }
      }
    ).setDepth(41);
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();

    for (
      const platform of
      this.movingMirrors
    ) {
      const solid =
        platform.solid;

      g.fillStyle(
        0x12283b,
        1
      );

      g.fillRoundedRect(
        solid.x,
        solid.y,
        solid.width,
        solid.height,
        4
      );

      g.fillStyle(
        0x75eaf1,
        1
      );

      g.fillRect(
        solid.x,
        solid.y,
        solid.width,
        3
      );

      g.lineStyle(
        1,
        0xe65bc9,
        0.9
      );

      g.strokeRoundedRect(
        solid.x,
        solid.y,
        solid.width,
        solid.height,
        4
      );
    }

    for (
      let index = 0;
      index < 3;
      index += 1
    ) {
      const x =
        14645 + index * 295;

      const cycle =
        (
          this.elapsed +
          index * 0.62
        ) % 2.6;

      const active =
        cycle >= 0.72 &&
        cycle < 1.7;

      g.lineStyle(
        active ? 5 : 2,
        active
          ? 0xe95acb
          : 0x75eaf1,
        active
          ? 0.9
          : 0.28
      );

      g.lineBetween(
        x,
        115,
        x,
        520
      );
    }

    for (
      const spike of
      SPIKE_RECTS
    ) {
      const count = Math.max(
        1,
        Math.floor(
          spike.width / 11
        )
      );

      const width =
        spike.width / count;

      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        const x =
          spike.x +
          index * width;

        g.fillStyle(
          index % 2 === 0
            ? 0xe95acb
            : 0x75eaf1,
          1
        );

        g.fillTriangle(
          x,
          spike.bottom,
          x + width * 0.5,
          spike.top,
          x + width,
          spike.bottom
        );
      }
    }

    for (const rose of this.roses) {
      if (rose.consumed) {
        continue;
      }

      const pulse =
        1 +
        Math.sin(
          this.elapsed * 5 +
          rose.x * 0.01
        ) * 0.1;

      g.fillStyle(
        0x62e9b2,
        0.25
      );

      g.fillCircle(
        rose.x,
        rose.y - 10,
        14 * pulse
      );

      g.fillStyle(
        0xe85fbd,
        1
      );

      g.fillCircle(
        rose.x - 4,
        rose.y - 12,
        5
      );

      g.fillCircle(
        rose.x + 4,
        rose.y - 12,
        5
      );

      g.fillCircle(
        rose.x,
        rose.y - 17,
        5
      );

      g.fillStyle(
        0xf4ce68,
        1
      );

      g.fillCircle(
        rose.x,
        rose.y - 12,
        3
      );

      g.lineStyle(
        2,
        0x62e9b2,
        1
      );

      g.lineBetween(
        rose.x,
        rose.y - 8,
        rose.x,
        rose.y
      );
    }

    for (
      const projectile of
      this.projectiles
    ) {
      if (!projectile.active) {
        continue;
      }

      g.fillStyle(
        projectile.color,
        0.22
      );

      g.fillCircle(
        projectile.x,
        projectile.y,
        projectile.radius + 6
      );

      g.fillStyle(
        projectile.color,
        1
      );

      g.fillCircle(
        projectile.x,
        projectile.y,
        projectile.radius
      );
    }

    if (
      this.gauntletStarted ||
      this.bossStarted
    ) {
      const centerX =
        this.bossStarted
          ? 18240
          : 15900;

      const centerY =
        this.bossStarted
          ? 250
          : 310;

      const length =
        this.bossStarted
          ? 420
          : 310;

      const count =
        this.bossStarted
          ? this.conductor.phase
          : 2;

      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        const angle =
          this.elapsed *
            (
              this.bossStarted
                ? 1.35
                : 0.9
            ) +
          index *
            Math.PI /
            count;

        const beamCycle =
          this.elapsed % 2.4;

        const beamTelegraph =
          this.bossStarted &&
          beamCycle < 0.62;

        const beamActive =
          !this.bossStarted ||
          (
            beamCycle >= 0.62 &&
            beamCycle < 1.02
          );

        g.lineStyle(
          beamActive ? 5 : 2,
          index % 2 === 0
            ? 0xe95acb
            : 0x75eaf1,
          beamActive
            ? 0.88
            : beamTelegraph
              ? 0.25
              : 0.06
        );

        g.lineBetween(
          centerX,
          centerY,
          centerX +
            Math.cos(angle) *
            length,
          centerY +
            Math.sin(angle) *
            length
        );
      }
    }

    this.redrawGates();
    this.redrawObjective();
  }

  private redrawGates(): void {
    for (
      const gate of [
        this.relayGate,
        this.bossGate,
        this.exitGate
      ]
    ) {
      const shouldRender =
        gate === this.relayGate
          ? !this.relaysCheckpointReached
          : gate === this.bossGate
            ? !this.gauntletCleared
            : !this.bossDefeated;

      if (!shouldRender) {
        continue;
      }

      const g = this.graphics;

      g.fillStyle(
        0x080817,
        0.94
      );

      g.fillRect(
        gate.x,
        gate.y,
        gate.width,
        gate.height
      );

      g.lineStyle(
        3,
        0xe95acb,
        1
      );

      for (
        let y = 0;
        y < gate.height;
        y += 28
      ) {
        g.lineBetween(
          gate.x + 2,
          y,
          gate.right - 2,
          y + 17
        );
      }

      g.lineStyle(
        2,
        0x75eaf1,
        1
      );

      g.strokeRect(
        gate.x,
        gate.y,
        gate.width,
        gate.height
      );
    }
  }

  private redrawObjective(): void {
    if (
      this.player.x <
        MIRROR_CORE_START_X
    ) {
      this.hudText.setVisible(false);
      return;
    }

    if (this.bossDefeated) {
      return;
    }

    this.hudText.setVisible(true);

    if (
      !this.relaysCheckpointReached
    ) {
      const active =
        this.relays.filter(
          relay =>
            relay.isActivated
        ).length;

      this.hudText.setText(
        `MIRROR RELAYS ${active}/2 — HIT WITH [L] GRAND CARD`
      );

      return;
    }

    if (!this.gauntletCleared) {
      const remaining =
        this.enemies.filter(
          enemy =>
            !enemy.isDefeated
        ).length;

      this.hudText.setText(
        `KALEIDOSCOPE GAUNTLET — REFLECTIONS ${4 - remaining}/4`
      );

      return;
    }

    if (this.bossStarted) {
      const phase =
        this.conductor.phase;

      const mechanic =
        this.conductor.isShielded
          ? "USE [K] SPOTLIGHT NEAR THE SHIELD"
          : phase === 2
            ? "USE [L] GRAND CARD TO MARK THE REAL CONDUCTOR"
            : phase === 3
              ? "CURTAIN COLLAPSE — KEEP MOVING"
              : "REFLECTED GUARD BROKEN";

      this.hudText.setText(
        `MIRROR CONDUCTOR — PHASE ${phase}\n${mechanic}`
      );

      return;
    }

    this.hudText.setText(
      "CORE CHAMBER AHEAD"
    );
  }
}
