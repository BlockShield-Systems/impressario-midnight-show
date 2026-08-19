import Phaser from "phaser";

import {
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "../world/WorldLayout";

import { EnemyView } from "../enemies/EnemyView";
import type { PlayerController } from "../main";

export type AttackId =
  | "combo-1"
  | "combo-2"
  | "combo-3"
  | "low"
  | "launcher"
  | "air-neutral"
  | "air-up"
  | "down-strike"
  | "dash-attack";

export type AttackPhase =
  | "idle"
  | "startup"
  | "active"
  | "recovery";

interface AttackDefinition {
  readonly id: AttackId;
  readonly displayName: string;

  readonly startup: number;
  readonly active: number;
  readonly recovery: number;

  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height: number;

  readonly damage: number;
  readonly knockbackX: number;
  readonly knockbackY: number;

  readonly hitstop: number;
  readonly color: number;
}

interface ActiveAttack {
  readonly definition: AttackDefinition;
  phase: AttackPhase;
  elapsed: number;
  hitConnected: boolean;
}

export interface CombatAnimationState {
  readonly attackId: AttackId | null;
  readonly phase: AttackPhase;
  readonly normalizedProgress: number;
  readonly paused: boolean;
}

interface TutorialObjective {
  readonly attack: AttackId;
  readonly label: string;
}

const ATTACKS: Record<AttackId, AttackDefinition> = {
  "combo-1": {
    id: "combo-1",
    displayName: "Cane Strike I",
    startup: 0.07,
    active: 0.08,
    recovery: 0.15,
    offsetX: 8,
    offsetY: -19,
    width: 29,
    height: 17,
    damage: 8,
    knockbackX: 55,
    knockbackY: -12,
    hitstop: 0.045,
    color: 0xf4c768
  },

  "combo-2": {
    id: "combo-2",
    displayName: "Cane Strike II",
    startup: 0.06,
    active: 0.09,
    recovery: 0.16,
    offsetX: 7,
    offsetY: -24,
    width: 34,
    height: 22,
    damage: 9,
    knockbackX: 70,
    knockbackY: -24,
    hitstop: 0.05,
    color: 0xffdd7d
  },

  "combo-3": {
    id: "combo-3",
    displayName: "Cane Finisher",
    startup: 0.11,
    active: 0.1,
    recovery: 0.25,
    offsetX: 5,
    offsetY: -28,
    width: 43,
    height: 31,
    damage: 15,
    knockbackX: 185,
    knockbackY: -75,
    hitstop: 0.075,
    color: 0xffefad
  },

  low: {
    id: "low",
    displayName: "Low Sweep",
    startup: 0.09,
    active: 0.1,
    recovery: 0.21,
    offsetX: 7,
    offsetY: -9,
    width: 38,
    height: 11,
    damage: 11,
    knockbackX: 115,
    knockbackY: -18,
    hitstop: 0.06,
    color: 0xe5a847
  },

  launcher: {
    id: "launcher",
    displayName: "Up Launcher",
    startup: 0.12,
    active: 0.1,
    recovery: 0.24,
    offsetX: -14,
    offsetY: -43,
    width: 36,
    height: 48,
    damage: 10,
    knockbackX: 28,
    knockbackY: -260,
    hitstop: 0.065,
    color: 0xf7d273
  },

  "air-neutral": {
    id: "air-neutral",
    displayName: "Air Cane Strike",
    startup: 0.07,
    active: 0.12,
    recovery: 0.18,
    offsetX: 5,
    offsetY: -25,
    width: 37,
    height: 27,
    damage: 10,
    knockbackX: 100,
    knockbackY: -35,
    hitstop: 0.055,
    color: 0xecc65f
  },

  "air-up": {
    id: "air-up",
    displayName: "Air Up Strike",
    startup: 0.08,
    active: 0.12,
    recovery: 0.2,
    offsetX: -8,
    offsetY: -55,
    width: 34,
    height: 40,
    damage: 10,
    knockbackX: 22,
    knockbackY: -175,
    hitstop: 0.055,
    color: 0xf8dc87
  },

  "down-strike": {
    id: "down-strike",
    displayName: "Down Strike",
    startup: 0.1,
    active: 0.16,
    recovery: 0.22,
    offsetX: -8,
    offsetY: 0,
    width: 34,
    height: 38,
    damage: 13,
    knockbackX: 25,
    knockbackY: 170,
    hitstop: 0.075,
    color: 0xf2b94f
  },

  "dash-attack": {
    id: "dash-attack",
    displayName: "Dash Strike",
    startup: 0.035,
    active: 0.13,
    recovery: 0.2,
    offsetX: 3,
    offsetY: -28,
    width: 48,
    height: 30,
    damage: 14,
    knockbackX: 210,
    knockbackY: -55,
    hitstop: 0.07,
    color: 0xffe290
  }
};

const OBJECTIVES: readonly TutorialObjective[] = [
  {
    attack: "combo-1",
    label: "Hit the training dummy with [J] – Cane Strike I"
  },
  {
    attack: "combo-2",
    label: "Press [J] again – Cane Strike II"
  },
  {
    attack: "combo-3",
    label: "Complete the combo with [J] – Finisher"
  },
  {
    attack: "low",
    label: "Hold [S] and press [J] – Low Sweep"
  },
  {
    attack: "launcher",
    label: "While grounded, hold [W] and press [J] – Up Launcher"
  },
  {
    attack: "air-neutral",
    label: "Jump and press [J] – Air Strike"
  },
  {
    attack: "air-up",
    label: "While airborne, press [W] + [J] – Air Up"
  },
  {
    attack: "down-strike",
    label: "Above the dummy, press [S] + [J] – Down Strike"
  },
  {
    attack: "dash-attack",
    label: "Press [J] during a dash – Dash Strike"
  }
];

class CombatInput {
  private readonly held = new Set<string>();

  private attackQueued = false;
  private previousGamepadAttack = false;

  public constructor() {
    window.addEventListener("keydown", this.handleKeyDown, {
      passive: false
    });

    window.addEventListener("keyup", this.handleKeyUp, {
      passive: false
    });

    window.addEventListener("blur", this.handleBlur);
  }

  public update(): void {
    const gamepad = navigator.getGamepads?.()[0];

    if (!gamepad) {
      this.previousGamepadAttack = false;
      return;
    }

    const attackHeld = Boolean(gamepad.buttons[2]?.pressed);

    if (attackHeld && !this.previousGamepadAttack) {
      this.attackQueued = true;
    }

    this.previousGamepadAttack = attackHeld;
  }

  public consumeAttack(): boolean {
    if (!this.attackQueued) {
      return false;
    }

    this.attackQueued = false;
    return true;
  }

  public get upHeld(): boolean {
    return (
      this.held.has("KeyW") ||
      this.held.has("ArrowUp")
    );
  }

  public get downHeld(): boolean {
    return (
      this.held.has("KeyS") ||
      this.held.has("ArrowDown")
    );
  }

  private readonly handleKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.code === "KeyJ") {
      event.preventDefault();

      if (!event.repeat) {
        this.attackQueued = true;
      }
    }

    this.held.add(event.code);
  };

  private readonly handleKeyUp = (
    event: KeyboardEvent
  ): void => {
    this.held.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.held.clear();
    this.attackQueued = false;
  };
}

export interface CombatTarget {
  readonly bounds: Phaser.Geom.Rectangle;
  readonly active: boolean;

  receiveHit(
    damage: number,
    knockbackX: number,
    knockbackY: number,
    facing: -1 | 1
  ): void;
}

class TrainingDummy implements CombatTarget {
  public readonly active = true;
  public x = 2530;
  public y = 296;

  public readonly width = 18;
  public readonly height = 30;

  public velocityX = 0;
  public velocityY = 0;

  public health = 100;
  public flashTimer = 0;

  private readonly view: EnemyView;
  private readonly healthText: Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene
  ) {
    this.view = new EnemyView(scene, 16);

    this.healthText = scene.add.text(
      this.x - 12,
      this.y - 15,
      "",
      {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f4ddad"
      }
    );

    this.healthText.setDepth(17);
    this.redraw();
  }

  public update(deltaSeconds: number): void {
    this.flashTimer = Math.max(
      0,
      this.flashTimer - deltaSeconds
    );

    this.velocityY += 620 * deltaSeconds;

    this.x += this.velocityX * deltaSeconds;
    this.y += this.velocityY * deltaSeconds;

    this.velocityX = moveTowardsLocal(
      this.velocityX,
      0,
      250 * deltaSeconds
    );

    const platformLeft = 2290;
    const platformRight = 2790;
    const platformTop = 326;

    this.x = Phaser.Math.Clamp(
      this.x,
      platformLeft,
      platformRight - this.width
    );

    if (this.y + this.height >= platformTop) {
      this.y = platformTop - this.height;
      this.velocityY = 0;
    }

    this.redraw();
  }

  public receiveHit(
    damage: number,
    knockbackX: number,
    knockbackY: number,
    facing: -1 | 1
  ): void {
    this.health = Math.max(
      0,
      this.health - damage
    );

    this.velocityX =
      knockbackX * facing;

    this.velocityY = knockbackY;
    this.flashTimer = 0.09;

    if (this.health <= 0) {
      this.health = 100;
    }
  }

  public get bounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x,
      this.y,
      this.width,
      this.height
    );
  }

  private redraw(): void {
    this.view.update({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      facing: 1,
      visible: true,
      tag:
        this.flashTimer > 0
          ? "dummy_hit"
          : "dummy_idle",
      flashing: this.flashTimer > 0
    });

    this.healthText
      .setPosition(
        this.x - 3,
        this.y - 14
      )
      .setText(`HP ${this.health}`);
  }
}

function moveTowardsLocal(
  current: number,
  target: number,
  maxDelta: number
): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }

  return current +
    Math.sign(target - current) * maxDelta;
}

export class CombatSystem {
  private readonly input = new CombatInput();
  private readonly dummy: TrainingDummy;
  private readonly targets: CombatTarget[];

  private readonly hitboxGraphics: Phaser.GameObjects.Graphics;
  private readonly effectGraphics: Phaser.GameObjects.Graphics;

  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly attackText: Phaser.GameObjects.Text;

  private activeAttack: ActiveAttack | null = null;

  private bufferedAttack = false;
  private comboStep = 0;
  private comboResetTimer = 0;

  private objectiveIndex = 0;
  private hitstopTimer = 0;
  private effectTimer = 0;
  private effectX = 0;
  private effectY = 0;

  private debugVisible = false;
  private arenaCameraLocked = false;
  private tutorialCompleted = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerController
  ) {
    this.dummy = new TrainingDummy(scene);
    this.targets = [this.dummy];

    this.hitboxGraphics = scene.add.graphics();
    this.hitboxGraphics.setDepth(100);

    this.effectGraphics = scene.add.graphics();
    this.effectGraphics.setDepth(101);

    scene.add.text(
      2425,
      62,
      "ACT II — COMBAT REHEARSAL",
      {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f0c95e",
        backgroundColor: "#160a10cc",
        padding: {
          x: 7,
          y: 5
        }
      }
    );

    this.objectiveText = scene.add.text(
      8,
      314,
      "",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#fff1cc",
        backgroundColor: "#170a11dd",
        padding: {
          x: 7,
          y: 6
        }
      }
    );

    this.objectiveText
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);

    this.attackText = scene.add.text(
      320,
      32,
      "",
      {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffe39b",
        stroke: "#34131f",
        strokeThickness: 3
      }
    );

    this.attackText
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  public update(deltaSeconds: number): void {
    this.input.update();
    this.dummy.update(deltaSeconds);

    this.comboResetTimer = Math.max(
      0,
      this.comboResetTimer - deltaSeconds
    );

    if (
      this.comboResetTimer <= 0 &&
      this.activeAttack === null
    ) {
      this.comboStep = 0;
    }

    if (this.input.consumeAttack()) {
      this.handleAttackInput();
    }

    this.updateAttack(deltaSeconds);
    this.updateEffects(deltaSeconds);

    const tutorialActive =
      this.player.x >= 2280;

    this.objectiveText.setVisible(
      tutorialActive &&
      this.player.x < 2880
    );

    if (
      tutorialActive &&
      !this.tutorialCompleted &&
      !this.arenaCameraLocked
    ) {
      this.lockArenaCamera();
    }

    if (tutorialActive) {
      this.updateTutorialPrompt();
    }
  }

  public get animationState():
    CombatAnimationState {
    const attack =
      this.activeAttack;

    if (!attack) {
      return {
        attackId: null,
        phase: "idle",
        normalizedProgress: 0,
        paused: false
      };
    }

    const definition =
      attack.definition;

    const totalDuration =
      definition.startup +
      definition.active +
      definition.recovery;

    let elapsed =
      attack.elapsed;

    if (attack.phase === "active") {
      elapsed += definition.startup;
    } else if (
      attack.phase === "recovery"
    ) {
      elapsed +=
        definition.startup +
        definition.active;
    }

    return {
      attackId: definition.id,
      phase: attack.phase,

      normalizedProgress:
        Phaser.Math.Clamp(
          elapsed / totalDuration,
          0,
          1
        ),

      paused:
        this.hitstopTimer > 0
    };
  }

  public registerTarget(
    target: CombatTarget
  ): void {
    if (!this.targets.includes(target)) {
      this.targets.push(target);
    }
  }

  public findNearestTarget(
    centerX: number,
    centerY: number,
    maximumDistance: number
  ): CombatTarget | null {
    let nearest: CombatTarget | null = null;
    let nearestDistanceSquared =
      maximumDistance * maximumDistance;

    for (const target of this.targets) {
      if (!target.active) {
        continue;
      }

      const deltaX =
        target.bounds.centerX - centerX;

      const deltaY =
        target.bounds.centerY - centerY;

      const distanceSquared =
        deltaX * deltaX +
        deltaY * deltaY;

      if (
        distanceSquared <=
        nearestDistanceSquared
      ) {
        nearest = target;
        nearestDistanceSquared =
          distanceSquared;
      }
    }

    return nearest;
  }

  public findTargetIntersecting(
    bounds: Phaser.Geom.Rectangle
  ): CombatTarget | null {
    return (
      this.targets.find(
        target =>
          target.active &&
          Phaser.Geom.Intersects
            .RectangleToRectangle(
              bounds,
              target.bounds
            )
      ) ?? null
    );
  }

  public applyRangedHit(
    target: CombatTarget,
    damage: number,
    sourceX: number
  ): boolean {
    if (!target.active) {
      return false;
    }

    const specializedTarget =
      target as CombatTarget & {
        receiveRangedHit?: (
          damage: number,
          sourceX: number
        ) => boolean;
      };

    if (
      specializedTarget.receiveRangedHit
    ) {
      const accepted =
        specializedTarget.receiveRangedHit(
          damage,
          sourceX
        );

      if (!accepted) {
        return false;
      }

      this.effectX =
        target.bounds.centerX;

      this.effectY =
        target.bounds.centerY;

      this.effectTimer = 0.12;

      this.scene.cameras.main.shake(
        55,
        0.003
      );

      return true;
    }

    const facing: -1 | 1 =
      target.bounds.centerX < sourceX
        ? -1
        : 1;

    target.receiveHit(
      damage,
      105,
      -38,
      facing
    );

    this.effectX =
      target.bounds.centerX;

    this.effectY =
      target.bounds.centerY;

    this.effectTimer = 0.12;

    this.scene.cameras.main.shake(
      55,
      0.003
    );

    return true;
  }

  public toggleDebug(): boolean {
    this.debugVisible = !this.debugVisible;

    if (!this.debugVisible) {
      this.hitboxGraphics.clear();
    }

    return this.debugVisible;
  }

  private lockArenaCamera(): void {
    this.arenaCameraLocked = true;

    this.scene.cameras.main.setBounds(
      2240,
      0,
      640,
      360
    );

    this.scene.cameras.main.flash(
      120,
      110,
      64,
      30,
      false
    );
  }

  private releaseArenaCamera(): void {
    this.arenaCameraLocked = false;
    this.tutorialCompleted = true;

    this.scene.cameras.main.setBounds(
      0,
      0,
      WORLD_WIDTH,
      WORLD_HEIGHT
    );
  }

  private handleAttackInput(): void {
    if (this.activeAttack) {
      this.bufferedAttack = true;
      return;
    }

    this.startAttack(this.selectAttack());
  }

  private selectAttack(): AttackDefinition {
    const airborne =
      this.player.state === "rise" ||
      this.player.state === "fall" ||
      this.player.state === "wall-slide";

    if (this.player.state === "dash") {
      return ATTACKS["dash-attack"];
    }

    if (airborne && this.input.downHeld) {
      return ATTACKS["down-strike"];
    }

    if (airborne && this.input.upHeld) {
      return ATTACKS["air-up"];
    }

    if (airborne) {
      return ATTACKS["air-neutral"];
    }

    if (this.input.downHeld) {
      return ATTACKS.low;
    }

    if (this.input.upHeld) {
      return ATTACKS.launcher;
    }

    const comboId: AttackId =
      this.comboStep === 0
        ? "combo-1"
        : this.comboStep === 1
          ? "combo-2"
          : "combo-3";

    return ATTACKS[comboId];
  }

  private startAttack(
    definition: AttackDefinition
  ): void {
    this.activeAttack = {
      definition,
      phase: "startup",
      elapsed: 0,
      hitConnected: false
    };

    this.attackText.setText(
      definition.displayName
    );

    this.scene.time.delayedCall(
      350,
      () => {
        if (
          this.attackText.text ===
          definition.displayName
        ) {
          this.attackText.setText("");
        }
      }
    );
  }

  private updateAttack(deltaSeconds: number): void {
    this.hitboxGraphics.clear();

    if (!this.activeAttack) {
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(
        0,
        this.hitstopTimer - deltaSeconds
      );

      return;
    }

    const attack = this.activeAttack;
    attack.elapsed += deltaSeconds;

    if (
      attack.phase === "startup" &&
      attack.elapsed >= attack.definition.startup
    ) {
      attack.phase = "active";
      attack.elapsed = 0;
    } else if (
      attack.phase === "active" &&
      attack.elapsed >= attack.definition.active
    ) {
      attack.phase = "recovery";
      attack.elapsed = 0;
    } else if (
      attack.phase === "recovery" &&
      attack.elapsed >= attack.definition.recovery
    ) {
      this.finishAttack(attack.definition.id);
      return;
    }

    if (attack.phase !== "active") {
      return;
    }

    const hitbox = this.createHitbox(
      attack.definition
    );

    this.drawHitbox(
      hitbox,
      attack.definition.color
    );

    if (!attack.hitConnected) {
      const target = this.targets.find(
        candidate =>
          candidate.active &&
          Phaser.Geom.Intersects.RectangleToRectangle(
            hitbox,
            candidate.bounds
          )
      );

      if (target) {
        attack.hitConnected = true;

        target.receiveHit(
          attack.definition.damage,
          attack.definition.knockbackX,
          attack.definition.knockbackY,
          this.player.facing
        );

        this.handleHit(
          attack.definition,
          target.bounds
        );
      }
    }
  }

  private finishAttack(previousId: AttackId): void {
    const continueCombo =
      this.bufferedAttack &&
      (
        previousId === "combo-1" ||
        previousId === "combo-2"
      );

    this.activeAttack = null;

    if (
      previousId === "combo-1" ||
      previousId === "combo-2"
    ) {
      this.comboStep += 1;
      this.comboResetTimer = 0.38;
    } else {
      this.comboStep = 0;
      this.comboResetTimer = 0;
    }

    if (previousId === "combo-3") {
      this.comboStep = 0;
    }

    if (continueCombo) {
      this.bufferedAttack = false;
      this.startAttack(this.selectAttack());
      return;
    }

    this.bufferedAttack = false;
  }

  private createHitbox(
    definition: AttackDefinition
  ): Phaser.Geom.Rectangle {
    const facing = this.player.facing;

    const x =
      facing === 1
        ? this.player.centerX + definition.offsetX
        : this.player.centerX -
          definition.offsetX -
          definition.width;

    const y =
      this.player.centerY +
      definition.offsetY;

    return new Phaser.Geom.Rectangle(
      x,
      y,
      definition.width,
      definition.height
    );
  }

  private drawHitbox(
    hitbox: Phaser.Geom.Rectangle,
    color: number
  ): void {
    if (!this.debugVisible) {
      return;
    }

    this.hitboxGraphics.fillStyle(
      color,
      0.16
    );

    this.hitboxGraphics.fillRect(
      hitbox.x,
      hitbox.y,
      hitbox.width,
      hitbox.height
    );

    this.hitboxGraphics.lineStyle(
      1,
      color,
      0.9
    );

    this.hitboxGraphics.strokeRect(
      hitbox.x,
      hitbox.y,
      hitbox.width,
      hitbox.height
    );
  }

  private handleHit(
    definition: AttackDefinition,
    targetBounds: Phaser.Geom.Rectangle
  ): void {
    this.scene.events.emit(
      "audio:combat-hit",
      definition.id === "combo-3" ||
        definition.id === "launcher" ||
        definition.id === "down-strike",
      targetBounds.centerX
    );

    this.effectX =
      targetBounds.centerX;

    this.effectY =
      targetBounds.centerY;

    if (definition.id === "down-strike") {
      this.player.velocityY = -290;
    }

    this.hitstopTimer = definition.hitstop;
    this.effectTimer = 0.12;

    this.scene.cameras.main.shake(
      55,
      definition.damage >= 14
        ? 0.004
        : 0.002
    );

    this.advanceTutorial(definition.id);
  }

  private advanceTutorial(
    attackId: AttackId
  ): void {
    const objective =
      OBJECTIVES[this.objectiveIndex];

    if (!objective || objective.attack !== attackId) {
      return;
    }

    this.objectiveIndex += 1;

    if (this.objectiveIndex >= OBJECTIVES.length) {
      this.objectiveText.setText(
        "COMBAT REHEARSAL COMPLETE — Bravo, Impressario!"
      );

      this.scene.cameras.main.flash(
        220,
        240,
        201,
        94,
        false
      );

      this.releaseArenaCamera();

      this.scene.add.text(
        2800,
        76,
        "CONTINUE TO ACT III →",
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#f6d778",
          backgroundColor: "#170a11dd",
          padding: {
            x: 7,
            y: 5
          }
        }
      );
    }
  }

  private updateTutorialPrompt(): void {
    if (this.objectiveIndex >= OBJECTIVES.length) {
      return;
    }

    const objective =
      OBJECTIVES[this.objectiveIndex];

    if (!objective) {
      return;
    }

    this.objectiveText.setText(
      `OBJECTIVE ${this.objectiveIndex + 1}/${OBJECTIVES.length}  ${objective.label}`
    );
  }

  private updateEffects(
    deltaSeconds: number
  ): void {
    this.effectGraphics.clear();

    this.effectTimer = Math.max(
      0,
      this.effectTimer - deltaSeconds
    );

    if (this.effectTimer <= 0) {
      return;
    }

    const progress =
      1 - this.effectTimer / 0.12;

    const radius = 5 + progress * 28;

    this.effectGraphics.lineStyle(
      3,
      0xffe39b,
      1 - progress
    );

    this.effectGraphics.strokeCircle(
      this.effectX,
      this.effectY,
      radius
    );

    for (let index = 0; index < 7; index += 1) {
      const angle =
        index / 7 * Math.PI * 2;

      const distance =
        7 + progress * 35;

      this.effectGraphics.fillStyle(
        index % 2 === 0
          ? 0xf5c95d
          : 0x9c2345,
        1 - progress
      );

      this.effectGraphics.fillCircle(
        this.effectX +
          Math.cos(angle) * distance,
        this.effectY +
          Math.sin(angle) * distance,
        2
      );
    }
  }
}
