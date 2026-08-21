import Phaser from "phaser";
import { leaderboard } from "./leaderboard/LeaderboardClient";
import "./style.css";
import { CombatSystem } from "./combat/CombatSystem";
import { StagehandSystem } from "./enemies/StagehandSystem";
import { CardThrowerSystem } from "./enemies/CardThrowerSystem";
import { PlayerHealthSystem } from "./player/PlayerHealthSystem";
import { PlayerView } from "./player/PlayerView";
import { EnemyView } from "./enemies/EnemyView";
import { BossView } from "./boss/BossView";
import { GalleryGauntletEncounterSystem } from "./world/GalleryGauntletEncounterSystem";
import { SpotlightVaultEncounterSystem } from "./world/SpotlightVaultEncounterSystem";
import { MagicSystem } from "./magic/MagicSystem";
import { CardSanctumEncounterSystem } from "./world/CardSanctumEncounterSystem";
import { RoyalEchoSystem } from "./enemies/RoyalEchoSystem";
import { RoyalBoxHazardSystem } from "./world/RoyalBoxHazardSystem";
import { RoyalBoxSupportSystem } from "./world/RoyalBoxSupportSystem";
import { MirrorCoreSystem } from "./world/MirrorCoreSystem";
import { AudioDirector } from "./audio/AudioDirector";
import { MusicDirector } from "./audio/MusicDirector";
import { AudioRuntimeBridge } from "./audio/AudioRuntimeBridge";
import { AudioDebugHud } from "./audio/AudioDebugHud";
import {
  WORLD_HEIGHT,
  WORLD_SOLIDS,
  WORLD_WIDTH
} from "./world/WorldLayout";
import {
  getWorldCheckpoint,
  getWorldGate,
  type WorldGateId
} from "./world/WorldGameplay";
import { EnvironmentTileRenderer } from "./world/EnvironmentTileRenderer";
import { MovementRehearsalVisuals } from "./world/MovementRehearsalVisuals";
import { CombatRehearsalVisuals } from "./world/CombatRehearsalVisuals";
import { CombatRehearsalHazardSystem } from "./world/CombatRehearsalHazardSystem";
import { MainStageVisuals } from "./world/MainStageVisuals";
import { MainStageEncounterSystem } from "./world/MainStageEncounterSystem";
import { GrandGalleryVisuals } from "./world/GrandGalleryVisuals";
import { GalleryGauntletVisuals } from "./world/GalleryGauntletVisuals";
import { SpotlightVaultVisuals } from "./world/SpotlightVaultVisuals";
import { CardSanctumVisuals } from "./world/CardSanctumVisuals";

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const GAME_WIDTH = 640;
const GAME_HEIGHT = 360;

const FIXED_TIMESTEP = 1 / 120;
const MAX_FRAME_DELTA = 0.05;

const MOVEMENT = {
  bodyWidth: 18,
  bodyHeight: 30,

  maxRunSpeed: 190,
  groundAcceleration: 1850,
  airAcceleration: 1120,
  groundDeceleration: 2300,
  airDeceleration: 520,

  gravity: 1600,
  fastFallGravityMultiplier: 1.65,
  maxFallSpeed: 430,
  fastFallMaxSpeed: 590,

  jumpSpeed: 455,
  doubleJumpSpeed: 420,

  wallJumpSpeedX: 245,
  wallJumpSpeedY: 430,
  wallSlideSpeed: 88,
  wallJumpControlLockTime: 0.09,

  jumpCutGravityMultiplier: 2.25,
  coyoteTime: 0.11,
  jumpBufferTime: 0.12,

  dashSpeed: 430,
  dashDuration: 0.13,
  dashCooldown: 0.18,

  gamepadDeadzone: 0.22
} as const;

/* -------------------------------------------------------------------------- */
/* Utility                                                                    */
/* -------------------------------------------------------------------------- */

function moveTowards(
  current: number,
  target: number,
  maxDelta: number
): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maxDelta;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.max(minimum, Math.min(maximum, value));
}

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

/* -------------------------------------------------------------------------- */
/* Input                                                                      */
/* -------------------------------------------------------------------------- */

interface InputSnapshot {
  readonly moveX: number;
  readonly downHeld: boolean;
  readonly jumpHeld: boolean;
  readonly jumpPressed: boolean;
  readonly dashPressed: boolean;
}

class PlayerInput {
  private readonly heldKeys = new Set<string>();

  private jumpQueued = false;
  private dashQueued = false;

  private previousGamepadJump = false;
  private previousGamepadDash = false;

  private gamepadMoveX = 0;
  private gamepadDown = false;
  private gamepadJump = false;

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
    const gamepads = navigator.getGamepads?.() ?? [];
    const gamepad = gamepads[0];

    this.gamepadMoveX = 0;
    this.gamepadDown = false;
    this.gamepadJump = false;

    if (!gamepad) {
      this.previousGamepadJump = false;
      this.previousGamepadDash = false;
      return;
    }

    const axisX = gamepad.axes[0] ?? 0;
    const axisY = gamepad.axes[1] ?? 0;

    if (Math.abs(axisX) >= MOVEMENT.gamepadDeadzone) {
      this.gamepadMoveX = clamp(axisX, -1, 1);
    }

    this.gamepadDown =
      axisY > MOVEMENT.gamepadDeadzone ||
      Boolean(gamepad.buttons[13]?.pressed);

    const jumpHeld = Boolean(gamepad.buttons[0]?.pressed);

    const dashHeld =
      Boolean(gamepad.buttons[1]?.pressed) ||
      Boolean(gamepad.buttons[7]?.pressed);

    if (jumpHeld && !this.previousGamepadJump) {
      this.jumpQueued = true;
    }

    if (dashHeld && !this.previousGamepadDash) {
      this.dashQueued = true;
    }

    this.gamepadJump = jumpHeld;
    this.previousGamepadJump = jumpHeld;
    this.previousGamepadDash = dashHeld;
  }

  public snapshot(consumeEdges: boolean): InputSnapshot {
    const keyboardMove =
      (this.isHeld("KeyD") || this.isHeld("ArrowRight") ? 1 : 0) -
      (this.isHeld("KeyA") || this.isHeld("ArrowLeft") ? 1 : 0);

    const moveX =
      Math.abs(this.gamepadMoveX) > Math.abs(keyboardMove)
        ? this.gamepadMoveX
        : keyboardMove;

    const snapshot: InputSnapshot = {
      moveX,

      downHeld:
        this.isHeld("KeyS") ||
        this.isHeld("ArrowDown") ||
        this.gamepadDown,

      jumpHeld:
        this.isHeld("Space") ||
        this.gamepadJump,

      jumpPressed:
        consumeEdges && this.jumpQueued,

      dashPressed:
        consumeEdges && this.dashQueued
    };

    if (consumeEdges) {
      this.jumpQueued = false;
      this.dashQueued = false;
    }

    return snapshot;
  }

  private readonly handleKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (this.isGameKey(event.code)) {
      event.preventDefault();
    }

    if (!event.repeat) {
      if (event.code === "Space") {
        this.jumpQueued = true;
      }

      if (
        event.code === "ShiftLeft" ||
        event.code === "ShiftRight"
      ) {
        this.dashQueued = true;
      }
    }

    this.heldKeys.add(event.code);
  };

  private readonly handleKeyUp = (
    event: KeyboardEvent
  ): void => {
    if (this.isGameKey(event.code)) {
      event.preventDefault();
    }

    this.heldKeys.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.heldKeys.clear();
    this.previousGamepadJump = false;
    this.previousGamepadDash = false;
  };

  private isHeld(code: string): boolean {
    return this.heldKeys.has(code);
  }

  private isGameKey(code: string): boolean {
    return [
      "KeyA",
      "KeyD",
      "KeyS",
      "KeyW",
      "KeyK",
      "ArrowLeft",
      "ArrowRight",
      "ArrowDown",
      "Space",
      "ShiftLeft",
      "ShiftRight"
    ].includes(code);
  }
}

/* -------------------------------------------------------------------------- */
/* Collision                                                                  */
/* -------------------------------------------------------------------------- */

interface KinematicBody {
  x: number;
  y: number;
  readonly width: number;
  readonly height: number;
}

interface CollisionContacts {
  grounded: boolean;
  ceiling: boolean;
  wallLeft: boolean;
  wallRight: boolean;
}

class CollisionWorld {
  public constructor(
    private readonly solids: Phaser.Geom.Rectangle[]
  ) {}

  public addSolid(
    solid: Phaser.Geom.Rectangle
  ): void {
    if (!this.solids.includes(solid)) {
      this.solids.push(solid);
    }
  }

  public removeSolid(
    solid: Phaser.Geom.Rectangle
  ): void {
    const index = this.solids.indexOf(solid);

    if (index >= 0) {
      this.solids.splice(index, 1);
    }
  }

  public move(
    body: KinematicBody,
    deltaX: number,
    deltaY: number
  ): CollisionContacts {
    const contacts: CollisionContacts = {
      grounded: false,
      ceiling: false,
      wallLeft: false,
      wallRight: false
    };

    this.moveHorizontal(body, deltaX, contacts);
    this.moveVertical(body, deltaY, contacts);

    return contacts;
  }

  private moveHorizontal(
    body: KinematicBody,
    deltaX: number,
    contacts: CollisionContacts
  ): void {
    if (deltaX === 0) {
      return;
    }

    const previousX = body.x;
    body.x += deltaX;

    for (const solid of this.solids) {
      if (!this.overlaps(body, solid)) {
        continue;
      }

      if (
        deltaX > 0 &&
        previousX + body.width <= solid.left + 0.01
      ) {
        body.x = solid.left - body.width;
        contacts.wallRight = true;
      } else if (
        deltaX < 0 &&
        previousX >= solid.right - 0.01
      ) {
        body.x = solid.right;
        contacts.wallLeft = true;
      }
    }
  }

  private moveVertical(
    body: KinematicBody,
    deltaY: number,
    contacts: CollisionContacts
  ): void {
    if (deltaY === 0) {
      return;
    }

    const previousY = body.y;
    body.y += deltaY;

    for (const solid of this.solids) {
      if (!this.overlaps(body, solid)) {
        continue;
      }

      if (
        deltaY > 0 &&
        previousY + body.height <= solid.top + 0.01
      ) {
        body.y = solid.top - body.height;
        contacts.grounded = true;
      } else if (
        deltaY < 0 &&
        previousY >= solid.bottom - 0.01
      ) {
        body.y = solid.bottom;
        contacts.ceiling = true;
      }
    }
  }

  private overlaps(
    body: KinematicBody,
    solid: Phaser.Geom.Rectangle
  ): boolean {
    return (
      body.x < solid.right &&
      body.x + body.width > solid.left &&
      body.y < solid.bottom &&
      body.y + body.height > solid.top
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Character controller                                                       */
/* -------------------------------------------------------------------------- */

export type MovementState =
  | "idle"
  | "run"
  | "rise"
  | "fall"
  | "wall-slide"
  | "dash";

export class PlayerController implements KinematicBody {
  public x: number;
  public y: number;

  public readonly width = MOVEMENT.bodyWidth;
  public readonly height = MOVEMENT.bodyHeight;

  public velocityX = 0;
  public velocityY = 0;

  public facing: -1 | 1 = 1;

  private contacts: CollisionContacts = {
    grounded: false,
    ceiling: false,
    wallLeft: false,
    wallRight: false
  };

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;

  private dashTimer = 0;
  private dashCooldownTimer = 0;
  private dashDirection: -1 | 1 = 1;

  private wallControlLockTimer = 0;

  private jumpsUsed = 0;
  private airDashAvailable = true;

  public constructor(
    private readonly world: CollisionWorld,
    startX: number,
    startY: number
  ) {
    this.x = startX;
    this.y = startY;
  }

  public fixedUpdate(
    deltaSeconds: number,
    input: InputSnapshot
  ): void {
    this.tickTimers(deltaSeconds);

    if (input.jumpPressed) {
      this.jumpBufferTimer = MOVEMENT.jumpBufferTime;
    }

    if (this.contacts.grounded) {
      this.coyoteTimer = MOVEMENT.coyoteTime;
      this.jumpsUsed = 0;
      this.airDashAvailable = true;
    }

    if (Math.abs(input.moveX) > 0.01) {
      this.facing = input.moveX < 0 ? -1 : 1;
    }

    if (input.dashPressed) {
      this.tryStartDash(input);
    }

    if (this.dashTimer > 0) {
      this.updateDash(deltaSeconds);
      return;
    }

    this.tryConsumeBufferedJump(input);
    this.updateHorizontalMovement(deltaSeconds, input);
    this.updateGravity(deltaSeconds, input);
    this.applyMovement(deltaSeconds);
  }

  public get centerX(): number {
    return this.x + this.width * 0.5;
  }

  public get centerY(): number {
    return this.y + this.height * 0.5;
  }

  public get isGrounded(): boolean {
    return this.contacts.grounded;
  }

  public get isWallJumping(): boolean {
    return this.wallControlLockTimer > 0;
  }

  public get state(): MovementState {
    if (this.dashTimer > 0) {
      return "dash";
    }

    if (
      !this.contacts.grounded &&
      this.velocityY > 0 &&
      (this.contacts.wallLeft || this.contacts.wallRight)
    ) {
      return "wall-slide";
    }

    if (this.contacts.grounded) {
      return Math.abs(this.velocityX) > 12
        ? "run"
        : "idle";
    }

    return this.velocityY < 0 ? "rise" : "fall";
  }

  public getDebugLines(): string[] {
    return [
      `STATE  ${this.state.toUpperCase()}`,
      `POS    ${this.x.toFixed(1)}, ${this.y.toFixed(1)}`,
      `VEL    ${this.velocityX.toFixed(1)}, ${this.velocityY.toFixed(1)}`,
      `GROUND ${this.contacts.grounded ? "YES" : "NO"}`,
      `WALL   L:${this.contacts.wallLeft ? 1 : 0} R:${this.contacts.wallRight ? 1 : 0}`,
      `JUMPS  ${this.jumpsUsed}/2`,
      `DASH   ${this.airDashAvailable ? "READY" : "USED"}`,
      `COYOTE ${this.coyoteTimer.toFixed(3)}`,
      `BUFFER ${this.jumpBufferTimer.toFixed(3)}`
    ];
  }

  private tickTimers(deltaSeconds: number): void {
    this.coyoteTimer = Math.max(
      0,
      this.coyoteTimer - deltaSeconds
    );

    this.jumpBufferTimer = Math.max(
      0,
      this.jumpBufferTimer - deltaSeconds
    );

    this.dashTimer = Math.max(
      0,
      this.dashTimer - deltaSeconds
    );

    this.dashCooldownTimer = Math.max(
      0,
      this.dashCooldownTimer - deltaSeconds
    );

    this.wallControlLockTimer = Math.max(
      0,
      this.wallControlLockTimer - deltaSeconds
    );
  }

  private tryStartDash(input: InputSnapshot): void {
    if (this.dashCooldownTimer > 0) {
      return;
    }

    if (
      !this.contacts.grounded &&
      !this.airDashAvailable
    ) {
      return;
    }

    const requestedDirection =
      Math.abs(input.moveX) > 0.15
        ? input.moveX
        : this.facing;

    this.dashDirection =
      requestedDirection < 0 ? -1 : 1;

    this.facing = this.dashDirection;

    this.dashTimer = MOVEMENT.dashDuration;

    this.dashCooldownTimer =
      MOVEMENT.dashDuration +
      MOVEMENT.dashCooldown;

    this.velocityX =
      this.dashDirection * MOVEMENT.dashSpeed;

    this.velocityY = 0;

    if (!this.contacts.grounded) {
      this.airDashAvailable = false;
    }
  }

  private updateDash(deltaSeconds: number): void {
    this.velocityX =
      this.dashDirection * MOVEMENT.dashSpeed;

    this.velocityY = 0;

    this.applyMovement(deltaSeconds);

    if (
      this.contacts.wallLeft ||
      this.contacts.wallRight
    ) {
      this.dashTimer = 0;
      this.velocityX = 0;
    }
  }

  private tryConsumeBufferedJump(
    input: InputSnapshot
  ): void {
    if (this.jumpBufferTimer <= 0) {
      return;
    }

    const wallDirection = this.getWallDirection(input);

    if (
      !this.contacts.grounded &&
      wallDirection !== 0
    ) {
      this.performWallJump(wallDirection);
      return;
    }

    if (
      this.contacts.grounded ||
      this.coyoteTimer > 0
    ) {
      this.velocityY = -MOVEMENT.jumpSpeed;
      this.jumpsUsed = 1;

      this.contacts.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      return;
    }

    if (this.jumpsUsed < 2) {
      this.velocityY = -MOVEMENT.doubleJumpSpeed;
      this.jumpsUsed = 2;
      this.jumpBufferTimer = 0;
    }
  }

  private getWallDirection(
    input: InputSnapshot
  ): -1 | 0 | 1 {
    if (
      this.contacts.wallLeft &&
      (input.moveX < -0.1 || this.velocityX <= 0)
    ) {
      return -1;
    }

    if (
      this.contacts.wallRight &&
      (input.moveX > 0.1 || this.velocityX >= 0)
    ) {
      return 1;
    }

    return 0;
  }

  private performWallJump(
    wallDirection: -1 | 1
  ): void {
    this.velocityX =
      -wallDirection * MOVEMENT.wallJumpSpeedX;

    this.velocityY = -MOVEMENT.wallJumpSpeedY;

    this.facing = wallDirection === -1 ? 1 : -1;

    this.jumpsUsed = 1;
    this.airDashAvailable = true;
    this.jumpBufferTimer = 0;

    this.wallControlLockTimer =
      MOVEMENT.wallJumpControlLockTime;
  }

  private updateHorizontalMovement(
    deltaSeconds: number,
    input: InputSnapshot
  ): void {
    if (this.wallControlLockTimer > 0) {
      return;
    }

    if (Math.abs(input.moveX) > 0.01) {
      const targetVelocity =
        input.moveX * MOVEMENT.maxRunSpeed;

      const acceleration = this.contacts.grounded
        ? MOVEMENT.groundAcceleration
        : MOVEMENT.airAcceleration;

      this.velocityX = moveTowards(
        this.velocityX,
        targetVelocity,
        acceleration * deltaSeconds
      );

      return;
    }

    const deceleration = this.contacts.grounded
      ? MOVEMENT.groundDeceleration
      : MOVEMENT.airDeceleration;

    this.velocityX = moveTowards(
      this.velocityX,
      0,
      deceleration * deltaSeconds
    );
  }

  private updateGravity(
    deltaSeconds: number,
    input: InputSnapshot
  ): void {
    let gravityMultiplier = 1;

    if (this.velocityY < 0 && !input.jumpHeld) {
      gravityMultiplier *=
        MOVEMENT.jumpCutGravityMultiplier;
    }

    if (input.downHeld && this.velocityY > 0) {
      gravityMultiplier *=
        MOVEMENT.fastFallGravityMultiplier;
    }

    this.velocityY +=
      MOVEMENT.gravity *
      gravityMultiplier *
      deltaSeconds;

    if (
      !this.contacts.grounded &&
      (this.contacts.wallLeft ||
        this.contacts.wallRight) &&
      this.velocityY > MOVEMENT.wallSlideSpeed
    ) {
      this.velocityY = MOVEMENT.wallSlideSpeed;
    }

    const terminalVelocity = input.downHeld
      ? MOVEMENT.fastFallMaxSpeed
      : MOVEMENT.maxFallSpeed;

    this.velocityY = Math.min(
      this.velocityY,
      terminalVelocity
    );
  }

  private applyMovement(deltaSeconds: number): void {
    this.contacts = this.world.move(
      this,
      this.velocityX * deltaSeconds,
      this.velocityY * deltaSeconds
    );

    if (
      this.contacts.wallLeft ||
      this.contacts.wallRight
    ) {
      this.velocityX = 0;
    }

    if (
      this.contacts.grounded &&
      this.velocityY > 0
    ) {
      this.velocityY = 0;
    }

    if (
      this.contacts.ceiling &&
      this.velocityY < 0
    ) {
      this.velocityY = 0;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                      */
/* -------------------------------------------------------------------------- */

class GameScene extends Phaser.Scene {
  private playerInput!: PlayerInput;
  private player!: PlayerController;
  private playerView!: PlayerView;
  private combatSystem!: CombatSystem;
  private stagehandSystem!: StagehandSystem;
  private cardThrowerSystem!: CardThrowerSystem;
  private combatHazardSystem!: CombatRehearsalHazardSystem;
  private mainStageEncounterSystem!: MainStageEncounterSystem;
  private galleryGauntletEncounterSystem!:
    GalleryGauntletEncounterSystem;
  private spotlightVaultEncounterSystem!:
    SpotlightVaultEncounterSystem;
  private magicSystem!: MagicSystem;
  private cardSanctumEncounterSystem!:
    CardSanctumEncounterSystem;
  private royalEchoSystem!: RoyalEchoSystem;
  private royalBoxHazardSystem!: RoyalBoxHazardSystem;
  private royalBoxSupportSystem!: RoyalBoxSupportSystem;
  private mirrorCoreSystem!: MirrorCoreSystem;
  private playerHealth!: PlayerHealthSystem;
  private audioDirector!: AudioDirector;
  private musicDirector!: MusicDirector;
  private audioBridge!: AudioRuntimeBridge;
  private audioDebugHud!: AudioDebugHud;

  private collisionWorld!: CollisionWorld;

  private readonly tutorialExitGate =
    createWorldGate("CombatTutorialExit");

  private readonly arenaLeftGate =
    createWorldGate("CombatArenaLeft");

  private readonly arenaRightGate =
    createWorldGate("CombatArenaRight");

  private arenaGateGraphics!: Phaser.GameObjects.Graphics;
  private encounterText!: Phaser.GameObjects.Text;

  private encounterActive = false;
  private encounterCleared = false;
  private tutorialExitLocked = true;
  private checkpointActivated = false;
  private masteryCheckpointActivated = false;

  private grandGalleryEntered = false;
  private grandGalleryCheckpointActivated = false;
  private grandGalleryTitle!: Phaser.GameObjects.Text;

  private royalBoxEntered = false;
  private royalBoxActive = false;
  private royalBoxCleared = false;

  private readonly royalBoxExitGate =
    createWorldGate("RoyalBoxExit");

  private royalBoxGateGraphics!: Phaser.GameObjects.Graphics;
  private royalBoxObjectiveText!: Phaser.GameObjects.Text;

  private debugText!: Phaser.GameObjects.Text;
  private accumulator = 0;

  public constructor() {
    super("game");
  }

  public preload(): void {
    PlayerView.preload(this);
    EnemyView.preload(this);
    BossView.preload(this);
    AudioDirector.preload(this);
    EnvironmentTileRenderer.preload(
      this
    );
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#0b0710");

    this.createBackdrop();

    new EnvironmentTileRenderer(
      this
    );
    new MovementRehearsalVisuals(this);
    new CombatRehearsalVisuals(this);
    new MainStageVisuals(this);
    new GrandGalleryVisuals(this);
    new GalleryGauntletVisuals(this);
    new SpotlightVaultVisuals(this);
    new CardSanctumVisuals(this);

    const solids = this.createLevel();

    this.createGrandGallery();
    this.createRoyalBox();

    this.collisionWorld =
      new CollisionWorld(solids);

    this.collisionWorld.addSolid(
      this.tutorialExitGate
    );

    this.playerInput = new PlayerInput();

    const initialCheckpoint =
      getWorldCheckpoint(
        "InitialSpawn"
      );

    this.player = new PlayerController(
      this.collisionWorld,
      initialCheckpoint.x,
      initialCheckpoint.y
    );

    this.playerHealth =
      new PlayerHealthSystem(
        this,
        this.player,
        () => {
          this.resetEncounterAfterDeath();
        }
      );

    this.combatSystem = new CombatSystem(
      this,
      this.player
    );

    this.playerView = new PlayerView(
      this,
      this.player,
      this.combatSystem,
      this.playerHealth
    );

    this.stagehandSystem = new StagehandSystem(
      this,
      this.player,
      this.playerHealth,
      this.combatSystem,
      [
        "CombatStagehandA",
        "CombatStagehandB",
        "CombatStagehandC"
      ]
    );

    this.cardThrowerSystem =
      new CardThrowerSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem,
        [
          "CombatCardThrowerA",
          "CombatCardThrowerB"
        ]
      );

    this.combatHazardSystem =
      new CombatRehearsalHazardSystem(
        this,
        this.player,
        this.playerHealth
      );

    this.mainStageEncounterSystem =
      new MainStageEncounterSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem,
        solid => {
          this.collisionWorld.addSolid(solid);
        },
        solid => {
          this.collisionWorld.removeSolid(solid);
        }
      );

    this.galleryGauntletEncounterSystem =
      new GalleryGauntletEncounterSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem,
        solid => {
          this.collisionWorld.addSolid(solid);
        },
        solid => {
          this.collisionWorld.removeSolid(solid);
        }
      );

    this.magicSystem =
      new MagicSystem(
        this,
        this.player,
        (
          centerX: number,
          centerY: number,
          radius: number
        ) =>
          this.spotlightVaultEncounterSystem
            .applySpotlight(
              centerX,
              centerY,
              radius
            )
      );

    this.spotlightVaultEncounterSystem =
      new SpotlightVaultEncounterSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem,
        this.magicSystem,
        solid => {
          this.collisionWorld.addSolid(solid);
        },
        solid => {
          this.collisionWorld.removeSolid(solid);
        }
      );

    this.cardSanctumEncounterSystem =
      new CardSanctumEncounterSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem,
        solid => {
          this.collisionWorld.addSolid(solid);
        },
        solid => {
          this.collisionWorld.removeSolid(solid);
        }
      );

    this.royalEchoSystem =
      new RoyalEchoSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem
      );

    this.royalBoxHazardSystem =
      new RoyalBoxHazardSystem(
        this,
        this.player,
        this.playerHealth
      );

    this.royalBoxSupportSystem =
      new RoyalBoxSupportSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem,
        this.magicSystem
      );

    this.mirrorCoreSystem =
      new MirrorCoreSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem,
        this.magicSystem,
        solid => {
          this.collisionWorld.addSolid(
            solid
          );
        },
        solid => {
          this.collisionWorld.removeSolid(
            solid
          );
        }
      );

    this.audioDirector =
      new AudioDirector(this);

    if (import.meta.env.DEV) {
      const debugWindow =
        window as Window & {
          __IMPRESSARIO_AUDIO_DEBUG__?:
            () => ReturnType<
              AudioDirector[
                "getDebugSnapshot"
              ]
            >;
        };

      debugWindow
        .__IMPRESSARIO_AUDIO_DEBUG__ =
          () =>
            this.audioDirector
              .getDebugSnapshot();

      this.events.once(
        Phaser.Scenes.Events.SHUTDOWN,
        () => {
          delete debugWindow
            .__IMPRESSARIO_AUDIO_DEBUG__;
        }
      );
    }

    this.musicDirector =
      new MusicDirector(
        this,
        this.audioDirector
      );

    this.audioBridge =
      new AudioRuntimeBridge(
        this,
        this.audioDirector,
        this.musicDirector,
        this.player,
        this.combatSystem,
        this.playerHealth,
        this.magicSystem
      );

    this.audioDebugHud =
      new AudioDebugHud(
        this,
        this.audioDirector
      );

    this.createLabels();
    this.createEncounterPresentation();
    this.createDebugHud();

    this.debugText.setVisible(false);

    this.input.keyboard?.on(
      "keydown-F3",
      () => {
        const debugVisible =
          this.combatSystem.toggleDebug();

        this.debugText.setVisible(debugVisible);
      }
    );

    this.cameras.main.setBounds(
      0,
      0,
      WORLD_WIDTH,
      WORLD_HEIGHT
    );

    this.cameras.main.startFollow(
      this.playerView.container,
      true,
      0.12,
      0.12
    );

    this.cameras.main.setDeadzone(180, 100);
  }

  public update(
    _time: number,
    deltaMilliseconds: number
  ): void {
    this.playerInput.update();

    const frameDelta = Math.min(
      deltaMilliseconds / 1000,
      MAX_FRAME_DELTA
    );

    this.playerHealth.update(frameDelta);

    if (this.playerHealth.controlsLocked) {
      this.accumulator = 0;
    } else {
      this.accumulator += frameDelta;

      let consumeInputEdges = true;

      while (this.accumulator >= FIXED_TIMESTEP) {
        this.player.fixedUpdate(
          FIXED_TIMESTEP,
          this.playerInput.snapshot(
            consumeInputEdges
          )
        );

        consumeInputEdges = false;
        this.accumulator -= FIXED_TIMESTEP;
      }
    }

    this.combatSystem.update(frameDelta);
    this.playerView.update(frameDelta);
    this.stagehandSystem.update(frameDelta);
    this.cardThrowerSystem.update(frameDelta);
    this.combatHazardSystem.update();
    this.mainStageEncounterSystem.update(frameDelta);
    this.galleryGauntletEncounterSystem.update(frameDelta);
    this.spotlightVaultEncounterSystem.update(frameDelta);
    this.magicSystem.update(frameDelta);
    this.cardSanctumEncounterSystem.update(frameDelta);
    this.royalEchoSystem.update(frameDelta);
    this.royalBoxHazardSystem.update(frameDelta);
    this.royalBoxSupportSystem.update(frameDelta);
    this.mirrorCoreSystem.update(frameDelta);

    this.updateEncounter();
    this.updateGrandGallery();
    this.updateRoyalBox();

    this.audioBridge.update(frameDelta);
    this.audioDirector.update(frameDelta);
    this.audioDebugHud.update(frameDelta);

    this.updateDebugHud();
  }

  private createBackdrop(): void {
    const background = this.add.graphics();

    background.setScrollFactor(0.08);
    background.setDepth(-100);

    background.fillStyle(0x130a12, 1);
    background.fillRect(
      -GAME_WIDTH,
      0,
      WORLD_WIDTH + GAME_WIDTH * 2,
      GAME_HEIGHT
    );

    for (
      let x = -100;
      x < WORLD_WIDTH + 200;
      x += 160
    ) {
      background.fillStyle(0x28111d, 0.7);

      background.fillTriangle(
        x,
        0,
        x + 80,
        GAME_HEIGHT,
        x + 160,
        0
      );
    }

    const curtains = this.add.graphics();

    curtains.setScrollFactor(0.35);
    curtains.setDepth(-50);

    for (
      let x = -50;
      x < WORLD_WIDTH + 100;
      x += 120
    ) {
      curtains.fillStyle(0x3b0e1e, 0.55);
      curtains.fillRoundedRect(
        x,
        0,
        70,
        210,
        30
      );

      curtains.lineStyle(3, 0x7b2038, 0.25);
      curtains.lineBetween(x + 15, 0, x + 20, 210);
      curtains.lineBetween(x + 45, 0, x + 50, 210);
    }

    for (
      let x = 120;
      x < WORLD_WIDTH;
      x += 320
    ) {
      const light = this.add.circle(
        x,
        25,
        6,
        0xf2c55f,
        0.75
      );

      light.setScrollFactor(0.6);
      light.setDepth(-20);

      const beam = this.add.triangle(
        x,
        135,
        0,
        0,
        -55,
        210,
        55,
        210,
        0xf5c85f,
        0.035
      );

      beam.setScrollFactor(0.6);
      beam.setDepth(-25);
    }
  }

  private createLevel(): Phaser.Geom.Rectangle[] {
    const solids =
      WORLD_SOLIDS.map(
        solid =>
          new Phaser.Geom.Rectangle(
            solid.x,
            solid.y,
            solid.width,
            solid.height
          )
      );

    const graphics = this.add.graphics();
    graphics.setDepth(0);

    for (const solid of solids) {
      graphics.fillStyle(0x341622, 1);

      graphics.fillRoundedRect(
        solid.x,
        solid.y,
        solid.width,
        solid.height,
        4
      );

      graphics.fillStyle(0xbd8733, 1);

      graphics.fillRect(
        solid.x,
        solid.y,
        solid.width,
        Math.min(3, solid.height)
      );

      graphics.lineStyle(1, 0x7d4b2b, 0.8);

      graphics.strokeRoundedRect(
        solid.x,
        solid.y,
        solid.width,
        solid.height,
        4
      );
    }

    return solids;
  }

  private createLabels(): void {
    this.add.text(
      46,
      245,
      [
        "MOVEMENT REHEARSAL",
        "",
        "A / D or arrows   Move",
        "Space             Jump / Double Jump",
        "Shift             Dash",
        "J                 Cane Attack",
        "S or down         Fast Fall",
        "",
        "Gamepad: Left Stick / A / RT or B"
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ead8b4",
        lineSpacing: 3
      }
    );

    this.add.text(
      680,
      88,
      "WALL-JUMP\nSHAFT",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#d6a94c"
      }
    );

    this.add.text(
      930,
      249,
      "AIR-DASH",
      {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#d6a94c"
      }
    );

    this.add.text(
      1485,
      250,
      "FAST-FALL TUNNEL",
      {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#d6a94c"
      }
    );

    this.add.text(
      2070,
      132,
      "TO COMBAT\nREHEARSAL →",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f0c95e"
      }
    );

  }







  private createRoyalBox(): void {
    const startX = 11980;
    const endX = 14400;

    const background = this.add.graphics();

    background
      .setDepth(-1)
      .setScrollFactor(1);

    background.fillStyle(0x090713, 1);

    background.fillRect(
      startX,
      0,
      endX - startX,
      WORLD_HEIGHT
    );

    for (
      let x = 12000;
      x < endX;
      x += 260
    ) {
      background.fillStyle(
        0x22102f,
        0.96
      );

      background.fillRect(
        x,
        0,
        150,
        WORLD_HEIGHT
      );

      background.fillStyle(
        0x091d2c,
        0.96
      );

      background.fillRect(
        x + 150,
        0,
        110,
        WORLD_HEIGHT
      );

      background.lineStyle(
        3,
        0xe15bbd,
        0.38
      );

      background.lineBetween(
        x + 12,
        0,
        x + 12,
        WORLD_HEIGHT
      );

      background.lineStyle(
        2,
        0x72e5ed,
        0.34
      );

      background.lineBetween(
        x + 145,
        0,
        x + 145,
        WORLD_HEIGHT
      );
    }

    // Broken mirror panels.
    for (
      let x = 12110;
      x < endX;
      x += 390
    ) {
      background.fillStyle(
        0x10182b,
        0.94
      );

      background.fillRoundedRect(
        x,
        42,
        116,
        205,
        14
      );

      background.lineStyle(
        4,
        0xc7a34b,
        0.9
      );

      background.strokeRoundedRect(
        x,
        42,
        116,
        205,
        14
      );

      background.lineStyle(
        2,
        0x79e6ef,
        0.62
      );

      background.lineBetween(
        x + 58,
        48,
        x + 37,
        128
      );

      background.lineBetween(
        x + 37,
        128,
        x + 77,
        170
      );

      background.lineBetween(
        x + 77,
        170,
        x + 50,
        241
      );

      background.lineStyle(
        2,
        0xe05ebd,
        0.65
      );

      background.lineBetween(
        x + 58,
        48,
        x + 91,
        104
      );

      background.lineBetween(
        x + 91,
        104,
        x + 77,
        170
      );

      background.lineBetween(
        x + 37,
        128,
        x + 10,
        184
      );
    }

    // Route lights make safe surfaces readable.
    const routeLights = [
      [12245, 270, 72],
      [12365, 210, 72],
      [12490, 155, 72],
      [12625, 215, 74],
      [12760, 260, 72],
      [12968, 235, 92],
      [13000, 326, 340],
      [13380, 270, 74],
      [13505, 210, 72],
      [13635, 150, 72],
      [13770, 205, 72],
      [13820, 260, 72],
      [14110, 270, 72],
      [14150, 326, 250]
    ] as const;

    const foreground = this.add.graphics();

    foreground
      .setDepth(2)
      .setScrollFactor(1);

    for (const route of routeLights) {
      const [x, y, width] = route;

      foreground.fillStyle(
        0x73e7ef,
        0.95
      );

      foreground.fillRect(
        x,
        y,
        width,
        3
      );

      foreground.lineStyle(
        1,
        0xe461c0,
        0.82
      );

      foreground.lineBetween(
        x,
        y + 4,
        x + width,
        y + 4
      );
    }

    this.add.text(
      12040,
      76,
      "ACT VII — THE FRACTURED ROYAL BOX",
      {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#f17bd0",
        backgroundColor: "#080611e8",
        padding: {
          x: 10,
          y: 7
        }
      }
    ).setDepth(36);

    this.add.text(
      12040,
      112,
      [
        "Every reflection lies.",
        "Read the lasers. Choose your route."
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#8cebf2",
        backgroundColor: "#080611dd",
        padding: {
          x: 8,
          y: 6
        }
      }
    ).setDepth(36);

    this.add.text(
      12215,
      470,
      "LOWER ROUTE — TRAPS / COVER",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#edc75f",
        backgroundColor: "#080611dd",
        padding: {
          x: 7,
          y: 5
        }
      }
    ).setDepth(36);

    this.add.text(
      12320,
      126,
      "UPPER ROUTE — DOUBLE-JUMP / AIR-DASH",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#84e9f0",
        backgroundColor: "#080611dd",
        padding: {
          x: 7,
          y: 5
        }
      }
    ).setDepth(36);

    this.add.text(
      12800,
      548,
      "WALL-JUMP ASCENT",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#ef73cf",
        backgroundColor: "#080611dd",
        padding: {
          x: 7,
          y: 5
        }
      }
    ).setDepth(36);

    this.add.text(
      13520,
      112,
      "MASTER SEQUENCE — JUMP → DASH → DOUBLE-JUMP",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#efca62",
        backgroundColor: "#080611dd",
        padding: {
          x: 7,
          y: 5
        }
      }
    ).setDepth(36);

    this.royalBoxGateGraphics =
      this.add.graphics();

    this.royalBoxGateGraphics.setDepth(34);

    this.royalBoxObjectiveText = this.add.text(
      GAME_WIDTH * 0.5,
      62,
      "",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffd9f7",
        backgroundColor: "#080611e8",
        padding: {
          x: 9,
          y: 6
        }
      }
    );

    this.royalBoxObjectiveText
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1180)
      .setVisible(false);
  }

  private updateRoyalBox(): void {
    if (this.player.x < 31664) {
      return;
    }

    if (
      !this.royalBoxEntered &&
      this.player.x >= getWorldCheckpoint("RoyalBox").triggerX
    ) {
      this.royalBoxEntered = true;

      this.playerHealth.setCheckpoint(
        getWorldCheckpoint(
          "RoyalBox"
        )
      );

      this.cameras.main.flash(
        260,
        220,
        76,
        187,
        false
      );
    }

    if (
      !this.royalBoxActive &&
      !this.royalBoxCleared &&
      this.player.x >= 12080
    ) {
      this.startRoyalBox();
    }

    if (!this.royalBoxActive) {
      return;
    }

    const remaining =
      this.royalEchoSystem.remaining;

    this.royalBoxObjectiveText.setText(
      [
        `ROYAL ECHOES ${4 - remaining}/4`,
        "Duelists rush. Prism Casters control the air."
      ].join("\n")
    );

    if (remaining === 0) {
      this.completeRoyalBox();
    }
  }

  private startRoyalBox(): void {
    this.royalBoxActive = true;

    this.collisionWorld.addSolid(
      this.royalBoxExitGate
    );

    this.royalEchoSystem
      .setEnabled(true);

    this.royalBoxHazardSystem
      .setEnabled(true);

    this.royalBoxObjectiveText
      .setVisible(true);

    this.redrawRoyalBoxGate();
  }

  private completeRoyalBox(): void {
    this.royalBoxActive = false;
    this.royalBoxCleared = true;

    this.collisionWorld.removeSolid(
      this.royalBoxExitGate
    );

    this.royalEchoSystem
      .setEnabled(false);

    this.royalBoxHazardSystem
      .setEnabled(false);

    this.royalBoxGateGraphics.clear();

    this.royalBoxObjectiveText.setText(
      "ROYAL BOX CLEARED — THE MIRROR CORE OPENS"
    );

    this.cameras.main.flash(
      320,
      230,
      92,
      202,
      false
    );

    this.time.delayedCall(
      2800,
      () => {
        this.royalBoxObjectiveText
          .setVisible(false);
      }
    );

    this.add.text(
      14145,
      235,
      "TO THE MIRROR CORE →",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8ceaf1",
        backgroundColor: "#080611dd",
        padding: {
          x: 8,
          y: 6
        }
      }
    ).setDepth(36);
  }

  private resetRoyalBoxAfterDeath(): void {
    if (
      !this.royalEchoSystem ||
      !this.royalBoxHazardSystem ||
      this.royalBoxCleared
    ) {
      return;
    }

    this.royalBoxActive = false;

    this.collisionWorld?.removeSolid(
      this.royalBoxExitGate
    );

    this.royalEchoSystem
      .resetEncounter();

    this.royalBoxHazardSystem
      .reset();

    this.royalBoxSupportSystem
      .resetAfterDeath();

    this.royalBoxGateGraphics?.clear();

    this.royalBoxObjectiveText
      ?.setVisible(false)
      .setText("");
  }

  private redrawRoyalBoxGate(): void {
    const g = this.royalBoxGateGraphics;
    g.clear();

    const gate =
      this.royalBoxExitGate;

    g.fillStyle(0x100819, 0.97);

    g.fillRect(
      gate.x,
      gate.y,
      gate.width,
      gate.height
    );

    g.lineStyle(
      3,
      0xe85fc5,
      1
    );

    for (
      let y = 8;
      y < gate.height;
      y += 25
    ) {
      g.lineBetween(
        gate.x + 2,
        y,
        gate.right - 2,
        y + 15
      );
    }

    g.lineStyle(
      2,
      0x77e5ed,
      1
    );

    g.strokeRect(
      gate.x,
      gate.y,
      gate.width,
      gate.height
    );
  }

  private createGrandGallery(): void {
    this.grandGalleryTitle = this.add.text(
      GAME_WIDTH * 0.5,
      52,
      [
        "ACT IV",
        "THE GRAND GALLERY"
      ].join("\n"),
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8be9f2",
        backgroundColor: "#07101dee",
        padding: {
          x: 16,
          y: 10
        }
      }
    );

    this.grandGalleryTitle
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1200)
      .setAlpha(0)
      .setVisible(false);
  }

  private updateGrandGallery(): void {
    if (this.player.x < 13744) {
      return;
    }

    if (
      !this.grandGalleryEntered &&
      this.player.x >= 13744
    ) {
      this.grandGalleryEntered = true;

      this.grandGalleryTitle
        .setVisible(true)
        .setAlpha(1);

      this.tweens.add({
        targets: this.grandGalleryTitle,
        alpha: 0,
        delay: 1600,
        duration: 900,
        ease: "Sine.InOut",
        onComplete: () => {
          this.grandGalleryTitle.setVisible(false);
        }
      });

      this.cameras.main.flash(
        180,
        76,
        176,
        205,
        false
      );
    }

    if (
      !this.grandGalleryCheckpointActivated &&
      this.player.x >= getWorldCheckpoint("GrandGallery").triggerX
    ) {
      this.grandGalleryCheckpointActivated = true;

      this.playerHealth.setCheckpoint(
        getWorldCheckpoint(
          "GrandGallery"
        )
      );
    }
  }

  private createEncounterPresentation(): void {
    this.arenaGateGraphics =
      this.add.graphics();

    this.arenaGateGraphics.setDepth(12);

    this.encounterText = this.add.text(
      320,
      12,
      "",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffe7a3",
        backgroundColor: "#170a11dd",
        padding: {
          x: 8,
          y: 6
        }
      }
    );

    this.encounterText
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1050)
      .setVisible(false);

    this.redrawArenaGates();
  }

  private updateEncounter(): void {
    if (
      !this.checkpointActivated &&
      this.player.x >= getWorldCheckpoint("CombatEntry").triggerX
    ) {
      this.checkpointActivated = true;

      this.playerHealth.setCheckpoint(
        getWorldCheckpoint(
          "CombatEntry"
        )
      );
    }

    if (
      this.tutorialExitLocked &&
      this.combatSystem.completed
    ) {
      this.tutorialExitLocked = false;
      this.collisionWorld.removeSolid(
        this.tutorialExitGate
      );
      this.redrawArenaGates();
    }

    if (
      !this.encounterActive &&
      !this.encounterCleared &&
      this.combatSystem.completed &&
      this.player.x >= 6728
    ) {
      this.startEncounter();
    }

    if (
      this.encounterCleared &&
      !this.masteryCheckpointActivated &&
      this.player.x >= getWorldCheckpoint("CombatMastery").triggerX
    ) {
      this.masteryCheckpointActivated = true;
      this.playerHealth.setCheckpoint(
        getWorldCheckpoint("CombatMastery")
      );
    }

    if (
      !this.encounterActive ||
      this.encounterCleared
    ) {
      return;
    }

    const remaining =
      this.stagehandSystem.remaining +
      this.cardThrowerSystem.remaining;

    const total =
      this.stagehandSystem.total +
      this.cardThrowerSystem.total;

    this.encounterText.setText(
      `COMBAT MASTERY — DEFEAT THE TROUPE   ${total - remaining}/${total}`
    );

    if (remaining === 0) {
      this.completeEncounter();
    }
  }

  private resetEncounterAfterDeath(): void {
    this.combatHazardSystem?.reset();
    this.mainStageEncounterSystem?.resetAfterDeath();
    this.galleryGauntletEncounterSystem?.resetAfterDeath();
    this.spotlightVaultEncounterSystem?.resetAfterDeath();
    this.cardSanctumEncounterSystem?.resetAfterDeath();
    this.resetRoyalBoxAfterDeath();
    this.mirrorCoreSystem?.resetAfterDeath();

    if (this.encounterCleared) {
      return;
    }

    this.encounterActive = false;

    this.collisionWorld.removeSolid(
      this.arenaLeftGate
    );

    this.collisionWorld.removeSolid(
      this.arenaRightGate
    );

    this.stagehandSystem.resetEncounter();
    this.cardThrowerSystem.resetEncounter();

    this.arenaGateGraphics.clear();

    this.encounterText
      .setText("")
      .setVisible(false);
  }

  private startEncounter(): void {
    this.encounterActive = true;

    this.collisionWorld.addSolid(
      this.arenaLeftGate
    );

    this.collisionWorld.addSolid(
      this.arenaRightGate
    );

    this.stagehandSystem
      .setEncounterActive(true);

    this.cardThrowerSystem
      .setEncounterActive(true);

    this.combatHazardSystem.setEnabled(true);

    this.encounterText
      .setText(
        "COMBAT MASTERY — DEFEAT THE TROUPE   0/5"
      )
      .setVisible(true);

    this.redrawArenaGates();

    this.cameras.main.flash(
      180,
      120,
      28,
      52,
      false
    );

    this.cameras.main.shake(
      120,
      0.003
    );
  }

  private completeEncounter(): void {
    this.encounterCleared = true;
    this.encounterActive = false;

    this.collisionWorld.removeSolid(
      this.arenaLeftGate
    );

    this.collisionWorld.removeSolid(
      this.arenaRightGate
    );

    this.arenaGateGraphics.clear();
    this.combatHazardSystem.setEnabled(false);

    this.encounterText.setText(
      "COMBAT REHEARSAL COMPLETE — THE EXIT IS OPEN"
    );

    this.cameras.main.flash(
      260,
      242,
      201,
      94,
      false
    );

    this.time.delayedCall(
      2400,
      () => {
        this.encounterText.setVisible(false);
      }
    );

    this.add.text(
      10096,
      238,
      "TO THE MAIN STAGE →",
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

  private redrawArenaGates(): void {
    const g = this.arenaGateGraphics;
    g.clear();

    for (
      const gate of [
        ...(this.tutorialExitLocked
          ? [this.tutorialExitGate]
          : []),
        ...(this.encounterActive
          ? [this.arenaLeftGate, this.arenaRightGate]
          : [])
      ]
    ) {
      g.fillStyle(
        0x250b17,
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
        0xc8923d,
        1
      );

      for (
        let y = 0;
        y < gate.height;
        y += 24
      ) {
        g.lineBetween(
          gate.x + 3,
          y,
          gate.right - 3,
          y + 16
        );
      }

      g.lineStyle(
        2,
        0xe5bc5b,
        0.9
      );

      g.strokeRect(
        gate.x,
        gate.y,
        gate.width,
        gate.height
      );
    }
  }

  private createDebugHud(): void {
    this.debugText = this.add.text(
      8,
      8,
      "",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f4e6c9",
        backgroundColor: "#09060bcc",
        padding: {
          x: 6,
          y: 5
        }
      }
    );

    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(1000);
  }

  private updateDebugHud(): void {
    this.debugText.setText(
      this.player.getDebugLines()
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Phaser bootstrap                                                           */
/* -------------------------------------------------------------------------- */

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,

  parent: "game-container",

  width: GAME_WIDTH,
  height: GAME_HEIGHT,

  backgroundColor: "#0b0710",

  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: "high-performance"
  },

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },

  scene: [
    GameScene
  ]
};

void leaderboard.boot(() => {
  new Phaser.Game(config);
});
