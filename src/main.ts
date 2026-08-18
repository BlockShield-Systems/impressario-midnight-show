import Phaser from "phaser";
import { leaderboard } from "./leaderboard/LeaderboardClient";
import "./style.css";
import { CombatSystem } from "./combat/CombatSystem";
import { StagehandSystem } from "./enemies/StagehandSystem";
import { CardThrowerSystem } from "./enemies/CardThrowerSystem";
import { PlayerHealthSystem } from "./player/PlayerHealthSystem";
import { PlayerView } from "./player/PlayerView";
import { EnemyView } from "./enemies/EnemyView";
import { ShadowAcrobatSystem } from "./enemies/ShadowAcrobatSystem";
import { GalleryHazardSystem } from "./world/GalleryHazardSystem";
import { MagicSystem } from "./magic/MagicSystem";
import { LightWraithSystem } from "./enemies/LightWraithSystem";
import { CardSentrySystem } from "./enemies/CardSentrySystem";
import { CardSanctumHazardSystem } from "./world/CardSanctumHazardSystem";
import { RoyalEchoSystem } from "./enemies/RoyalEchoSystem";
import { RoyalBoxHazardSystem } from "./world/RoyalBoxHazardSystem";
import { RoyalBoxSupportSystem } from "./world/RoyalBoxSupportSystem";
import { MirrorCoreSystem } from "./world/MirrorCoreSystem";

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const GAME_WIDTH = 640;
const GAME_HEIGHT = 360;

const WORLD_WIDTH = 17280;
const WORLD_HEIGHT = 720;

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
  private shadowAcrobatSystem!: ShadowAcrobatSystem;
  private galleryHazardSystem!: GalleryHazardSystem;
  private lightWraithSystem!: LightWraithSystem;
  private magicSystem!: MagicSystem;
  private cardSentrySystem!: CardSentrySystem;
  private cardSanctumHazardSystem!: CardSanctumHazardSystem;
  private royalEchoSystem!: RoyalEchoSystem;
  private royalBoxHazardSystem!: RoyalBoxHazardSystem;
  private royalBoxSupportSystem!: RoyalBoxSupportSystem;
  private mirrorCoreSystem!: MirrorCoreSystem;
  private playerHealth!: PlayerHealthSystem;

  private collisionWorld!: CollisionWorld;

  private readonly arenaLeftGate =
    new Phaser.Geom.Rectangle(
      3020,
      0,
      18,
      326
    );

  private readonly arenaRightGate =
    new Phaser.Geom.Rectangle(
      4170,
      0,
      18,
      326
    );

  private arenaGateGraphics!: Phaser.GameObjects.Graphics;
  private encounterText!: Phaser.GameObjects.Text;

  private encounterActive = false;
  private encounterCleared = false;
  private checkpointActivated = false;

  private grandGalleryEntered = false;
  private grandGalleryCheckpointActivated = false;
  private grandGalleryTitle!: Phaser.GameObjects.Text;

  private galleryGauntletEntered = false;
  private galleryMidpointActivated = false;
  private galleryGauntletEnabled = false;
  private galleryObjectiveText!: Phaser.GameObjects.Text;

  private spotlightVaultEntered = false;
  private spotlightVaultActive = false;
  private spotlightVaultCleared = false;

  private readonly vaultLeftGate =
    new Phaser.Geom.Rectangle(
      8420,
      0,
      18,
      326
    );

  private readonly vaultRightGate =
    new Phaser.Geom.Rectangle(
      9300,
      0,
      18,
      326
    );

  private vaultGateGraphics!: Phaser.GameObjects.Graphics;
  private vaultObjectiveText!: Phaser.GameObjects.Text;

  private cardSanctumEntered = false;
  private cardSanctumActive = false;
  private cardSanctumCleared = false;

  private readonly sanctumExitGate =
    new Phaser.Geom.Rectangle(
      11820,
      0,
      18,
      520
    );

  private sanctumGateGraphics!: Phaser.GameObjects.Graphics;
  private sanctumObjectiveText!: Phaser.GameObjects.Text;

  private royalBoxEntered = false;
  private royalBoxActive = false;
  private royalBoxCleared = false;

  private readonly royalBoxExitGate =
    new Phaser.Geom.Rectangle(
      14220,
      0,
      18,
      520
    );

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
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#0b0710");

    this.createBackdrop();

    const solids = this.createLevel();

    this.createGrandGallery();
    this.createGalleryGauntlet();
    this.createSpotlightVault();
    this.createCardSanctum();
    this.createRoyalBox();

    this.collisionWorld =
      new CollisionWorld(solids);

    this.playerInput = new PlayerInput();

    this.player = new PlayerController(
      this.collisionWorld,
      72,
      270
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
      this.combatSystem
    );

    this.cardThrowerSystem =
      new CardThrowerSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem
      );

    this.shadowAcrobatSystem =
      new ShadowAcrobatSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem
      );

    this.galleryHazardSystem =
      new GalleryHazardSystem(
        this,
        this.player,
        this.playerHealth
      );

    this.lightWraithSystem =
      new LightWraithSystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem
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
          this.lightWraithSystem
            .applySpotlight(
              centerX,
              centerY,
              radius
            )
      );

    this.cardSentrySystem =
      new CardSentrySystem(
        this,
        this.player,
        this.playerHealth,
        this.combatSystem
      );

    this.cardSanctumHazardSystem =
      new CardSanctumHazardSystem(
        this,
        this.player,
        this.playerHealth
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
    this.shadowAcrobatSystem.update(frameDelta);
    this.galleryHazardSystem.update(frameDelta);
    this.lightWraithSystem.update(frameDelta);
    this.magicSystem.update(frameDelta);
    this.cardSentrySystem.update(frameDelta);
    this.cardSanctumHazardSystem.update(frameDelta);
    this.royalEchoSystem.update(frameDelta);
    this.royalBoxHazardSystem.update(frameDelta);
    this.royalBoxSupportSystem.update(frameDelta);
    this.mirrorCoreSystem.update(frameDelta);

    this.updateEncounter();
    this.updateGrandGallery();
    this.updateGalleryGauntlet();
    this.updateSpotlightVault();
    this.updateCardSanctum();
    this.updateRoyalBox();
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
    const solids = [
      // Existing acts retain their continuous floor.
      new Phaser.Geom.Rectangle(
        0,
        326,
        6400,
        34
      ),

      new Phaser.Geom.Rectangle(245, 282, 105, 16),
      new Phaser.Geom.Rectangle(390, 242, 90, 16),
      new Phaser.Geom.Rectangle(520, 202, 85, 16),

      new Phaser.Geom.Rectangle(680, 190, 24, 136),
      new Phaser.Geom.Rectangle(820, 132, 24, 194),
      // Accessible wall-jump rehearsal:
      // staggered safety ledges prevent the player from getting trapped.
      new Phaser.Geom.Rectangle(704, 282, 42, 14),
      new Phaser.Geom.Rectangle(778, 230, 42, 14),
      new Phaser.Geom.Rectangle(704, 176, 52, 14),

      new Phaser.Geom.Rectangle(930, 278, 90, 14),
      new Phaser.Geom.Rectangle(1110, 232, 100, 14),
      new Phaser.Geom.Rectangle(1300, 190, 105, 14),

      new Phaser.Geom.Rectangle(1450, 205, 290, 18),
      new Phaser.Geom.Rectangle(1450, 310, 290, 16),

      new Phaser.Geom.Rectangle(1810, 270, 100, 14),
      new Phaser.Geom.Rectangle(1950, 222, 100, 14),
      new Phaser.Geom.Rectangle(2090, 172, 110, 14),

      // Safe descent from the movement rehearsal.
      new Phaser.Geom.Rectangle(2235, 220, 90, 14),
      new Phaser.Geom.Rectangle(2345, 270, 90, 14),

      // Combat arena accent platforms.
      new Phaser.Geom.Rectangle(2390, 244, 90, 14),
      new Phaser.Geom.Rectangle(2660, 244, 90, 14),

      // Act III: Main Stage combat platforms.
      new Phaser.Geom.Rectangle(3090, 270, 120, 14),
      new Phaser.Geom.Rectangle(3270, 225, 110, 14),
      new Phaser.Geom.Rectangle(3470, 270, 120, 14),
      new Phaser.Geom.Rectangle(3670, 215, 120, 14),
      new Phaser.Geom.Rectangle(3880, 260, 120, 14),

      // Exit route unlocked after the Act III encounter.
      new Phaser.Geom.Rectangle(4260, 275, 120, 14),
      new Phaser.Geom.Rectangle(4440, 230, 120, 14),
      new Phaser.Geom.Rectangle(4620, 185, 100, 14),

      // Act IV: The Grand Gallery.
      new Phaser.Geom.Rectangle(4870, 276, 125, 14),
      new Phaser.Geom.Rectangle(5060, 232, 120, 14),
      new Phaser.Geom.Rectangle(5250, 184, 110, 14),
      new Phaser.Geom.Rectangle(5435, 244, 125, 14),
      new Phaser.Geom.Rectangle(5640, 198, 110, 14),
      new Phaser.Geom.Rectangle(5825, 266, 130, 14),
      new Phaser.Geom.Rectangle(6035, 220, 120, 14),
      new Phaser.Geom.Rectangle(6210, 170, 105, 14),

      // Act IV-B: Gallery Gauntlet.
      // Entry and first fatal void.
      new Phaser.Geom.Rectangle(6320, 270, 130, 14),
      new Phaser.Geom.Rectangle(6400, 326, 150, 34),
      new Phaser.Geom.Rectangle(6590, 286, 70, 14),
      new Phaser.Geom.Rectangle(6675, 236, 70, 14),

      // Lower combat floor.
      new Phaser.Geom.Rectangle(6710, 430, 340, 34),
      new Phaser.Geom.Rectangle(6720, 360, 90, 14),

      // Vertical ascent.
      new Phaser.Geom.Rectangle(7040, 382, 90, 14),
      new Phaser.Geom.Rectangle(7145, 326, 88, 14),
      new Phaser.Geom.Rectangle(7255, 270, 88, 14),
      new Phaser.Geom.Rectangle(7365, 214, 88, 14),

      // Midpoint combat floor.
      new Phaser.Geom.Rectangle(7475, 326, 330, 34),

      // Second fatal void and exit.
      new Phaser.Geom.Rectangle(7835, 272, 68, 14),
      new Phaser.Geom.Rectangle(7920, 218, 68, 14),
      new Phaser.Geom.Rectangle(7995, 326, 205, 34),

      // Act V: Spotlight Vault.
      new Phaser.Geom.Rectangle(8200, 326, 1400, 34),
      new Phaser.Geom.Rectangle(8330, 270, 105, 14),
      new Phaser.Geom.Rectangle(8520, 235, 120, 14),
      new Phaser.Geom.Rectangle(8750, 275, 105, 14),
      new Phaser.Geom.Rectangle(8960, 225, 120, 14),
      new Phaser.Geom.Rectangle(9170, 270, 105, 14),
      new Phaser.Geom.Rectangle(9400, 215, 110, 14),

      // Act VI: Card Sanctum entrance.
      new Phaser.Geom.Rectangle(9600, 326, 180, 34),

      // Upper acrobatics route.
      new Phaser.Geom.Rectangle(9820, 275, 75, 14),
      new Phaser.Geom.Rectangle(9945, 220, 72, 14),
      new Phaser.Geom.Rectangle(10075, 168, 70, 14),
      new Phaser.Geom.Rectangle(10210, 225, 72, 14),

      // Lower hazard route.
      new Phaser.Geom.Rectangle(9800, 520, 330, 34),
      new Phaser.Geom.Rectangle(10200, 520, 260, 34),

      // Wall-jump shaft.
      new Phaser.Geom.Rectangle(10420, 250, 22, 270),
      new Phaser.Geom.Rectangle(10575, 170, 22, 350),
      new Phaser.Geom.Rectangle(10442, 470, 54, 14),
      new Phaser.Geom.Rectangle(10520, 408, 55, 14),
      new Phaser.Geom.Rectangle(10442, 346, 55, 14),
      new Phaser.Geom.Rectangle(10520, 284, 55, 14),

      // Route convergence.
      new Phaser.Geom.Rectangle(10640, 326, 270, 34),
      new Phaser.Geom.Rectangle(10955, 270, 80, 14),
      new Phaser.Geom.Rectangle(11085, 210, 78, 14),
      new Phaser.Geom.Rectangle(11220, 155, 76, 14),

      // Second lower route.
      new Phaser.Geom.Rectangle(10980, 520, 300, 34),
      new Phaser.Geom.Rectangle(11340, 520, 260, 34),

      // Fixed ascent from the lower route after the final sentry.
      // The opposed walls create a real wall-jump shaft instead of an
      // unreachable 210-pixel vertical step.
      new Phaser.Geom.Rectangle(11570, 360, 22, 160),
      new Phaser.Geom.Rectangle(11690, 270, 22, 250),

      // Final aerial sequence.
      new Phaser.Geom.Rectangle(11330, 310, 74, 14),
      new Phaser.Geom.Rectangle(11465, 255, 72, 14),
      new Phaser.Geom.Rectangle(11610, 205, 72, 14),
      new Phaser.Geom.Rectangle(11745, 270, 70, 14),

      // Exit floor.
      new Phaser.Geom.Rectangle(11840, 326, 380, 34),

      // Act VII: The Fractured Royal Box — entry.
      new Phaser.Geom.Rectangle(12000, 326, 220, 34),

      // First upper technical route.
      new Phaser.Geom.Rectangle(12245, 270, 72, 14),
      new Phaser.Geom.Rectangle(12365, 210, 72, 14),
      new Phaser.Geom.Rectangle(12490, 155, 72, 14),
      new Phaser.Geom.Rectangle(12625, 215, 74, 14),
      new Phaser.Geom.Rectangle(12760, 260, 72, 14),
      new Phaser.Geom.Rectangle(12968, 235, 92, 14),

      // First lower hazard route.
      new Phaser.Geom.Rectangle(12190, 520, 430, 34),
      new Phaser.Geom.Rectangle(12680, 520, 280, 34),

      // Mandatory wall-jump shaft from the lower route.
      new Phaser.Geom.Rectangle(12810, 300, 22, 160),
      new Phaser.Geom.Rectangle(12940, 230, 22, 290),

      // First convergence arena.
      new Phaser.Geom.Rectangle(13000, 326, 340, 34),

      // Second upper master route.
      new Phaser.Geom.Rectangle(13380, 270, 74, 14),
      new Phaser.Geom.Rectangle(13505, 210, 72, 14),
      new Phaser.Geom.Rectangle(13635, 150, 72, 14),
      new Phaser.Geom.Rectangle(13770, 205, 72, 14),
      new Phaser.Geom.Rectangle(13820, 260, 72, 14),

      // Second lower hazard route.
      new Phaser.Geom.Rectangle(13370, 520, 320, 34),
      new Phaser.Geom.Rectangle(13760, 520, 290, 34),

      // Final opposed-wall ascent.
      new Phaser.Geom.Rectangle(13910, 350, 22, 170),
      new Phaser.Geom.Rectangle(14040, 270, 22, 250),
      new Phaser.Geom.Rectangle(14110, 270, 72, 14),

      // Royal Box exit.
      new Phaser.Geom.Rectangle(14150, 326, 250, 34),

      // Act VIII: The Mirror Core — Refraction Ascent.
      new Phaser.Geom.Rectangle(14400, 326, 230, 34),
      new Phaser.Geom.Rectangle(14540, 270, 85, 14),
      new Phaser.Geom.Rectangle(14690, 225, 82, 14),
      new Phaser.Geom.Rectangle(14810, 175, 82, 14),
      new Phaser.Geom.Rectangle(14935, 235, 82, 14),

      // Refraction lower route and safe look-down landings.
      new Phaser.Geom.Rectangle(14620, 520, 250, 34),
      new Phaser.Geom.Rectangle(14920, 520, 240, 34),

      // Relay wall-jump convergence.
      new Phaser.Geom.Rectangle(15080, 350, 22, 170),
      new Phaser.Geom.Rectangle(15200, 280, 22, 240),
      new Phaser.Geom.Rectangle(15025, 286, 86, 14),
      new Phaser.Geom.Rectangle(15125, 286, 110, 14),
      new Phaser.Geom.Rectangle(15240, 326, 96, 34),

      // Kaleidoscope Gauntlet.
      new Phaser.Geom.Rectangle(15336, 326, 300, 34),
      new Phaser.Geom.Rectangle(15670, 270, 90, 14),
      new Phaser.Geom.Rectangle(15790, 326, 420, 34),
      new Phaser.Geom.Rectangle(15865, 238, 90, 14),
      new Phaser.Geom.Rectangle(16010, 190, 88, 14),
      new Phaser.Geom.Rectangle(16145, 250, 88, 14),
      new Phaser.Geom.Rectangle(16240, 326, 165, 34),

      // Core Chamber and post-boss exit.
      new Phaser.Geom.Rectangle(16423, 326, 757, 34),
      new Phaser.Geom.Rectangle(16530, 255, 100, 14),
      new Phaser.Geom.Rectangle(16680, 205, 92, 14),
      new Phaser.Geom.Rectangle(16830, 255, 96, 14),
      new Phaser.Geom.Rectangle(16985, 210, 95, 14),

      new Phaser.Geom.Rectangle(
        -20,
        0,
        20,
        WORLD_HEIGHT
      ),

      new Phaser.Geom.Rectangle(
        WORLD_WIDTH,
        0,
        20,
        WORLD_HEIGHT
      )
    ];

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

    this.add.text(
      3070,
      74,
      "ACT III — THE MAIN STAGE",
      {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#f0c95e",
        backgroundColor: "#170a11dd",
        padding: {
          x: 8,
          y: 6
        }
      }
    );

    this.add.text(
      3070,
      104,
      "Defeat the Masked Stagehands",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#ead8b4"
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
    if (
      !this.royalBoxEntered &&
      this.player.x >= 12020
    ) {
      this.royalBoxEntered = true;

      this.playerHealth.setCheckpoint(
        12030,
        296,
        "The Fractured Royal Box"
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

  private createCardSanctum(): void {
    const startX = 9580;
    const endX = 12000;

    const background = this.add.graphics();

    background
      .setDepth(-2)
      .setScrollFactor(1);

    background.fillStyle(
      0x170817,
      1
    );

    background.fillRect(
      startX,
      0,
      endX - startX,
      WORLD_HEIGHT
    );

    for (
      let x = 9600;
      x < endX;
      x += 240
    ) {
      background.fillStyle(
        0x2a1029,
        0.94
      );

      background.fillRect(
        x,
        0,
        150,
        WORLD_HEIGHT
      );

      background.fillStyle(
        0x10182d,
        0.88
      );

      background.fillRect(
        x + 150,
        0,
        90,
        WORLD_HEIGHT
      );

      background.lineStyle(
        3,
        0xb98c38,
        0.55
      );

      background.lineBetween(
        x + 10,
        0,
        x + 10,
        WORLD_HEIGHT
      );

      background.lineBetween(
        x + 140,
        0,
        x + 140,
        WORLD_HEIGHT
      );
    }

    // Giant card arches.
    for (
      let x = 9720;
      x < endX;
      x += 480
    ) {
      background.fillStyle(
        0x0d0d1d,
        0.95
      );

      background.fillRoundedRect(
        x,
        45,
        130,
        205,
        16
      );

      background.lineStyle(
        5,
        0xd7aa45,
        0.92
      );

      background.strokeRoundedRect(
        x,
        45,
        130,
        205,
        16
      );

      background.lineStyle(
        2,
        0xd43b6c,
        0.8
      );

      background.strokeRoundedRect(
        x + 10,
        55,
        110,
        185,
        11
      );

      background.fillStyle(
        0xd73a69,
        0.7
      );

      background.fillCircle(
        x + 65,
        137,
        18
      );

      background.fillTriangle(
        x + 39,
        142,
        x + 91,
        142,
        x + 65,
        180
      );
    }

    this.add.text(
      9630,
      86,
      "ACT VI — THE CARD SANCTUM",
      {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#f1ce69",
        backgroundColor: "#130714e8",
        padding: {
          x: 10,
          y: 7
        }
      }
    ).setDepth(35);

    this.add.text(
      9630,
      123,
      [
        "UPPER ROUTE",
        "Double-jump · Air-dash · Faster"
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#82e8ef",
        backgroundColor: "#130714dd",
        padding: {
          x: 7,
          y: 6
        }
      }
    ).setDepth(35);

    this.add.text(
      9700,
      468,
      [
        "LOWER ROUTE",
        "Longer · Traps · More cover"
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#efbd64",
        backgroundColor: "#130714dd",
        padding: {
          x: 7,
          y: 6
        }
      }
    ).setDepth(35);

    this.add.text(
      10395,
      218,
      "WALL-JUMP SHAFT",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#89e9ef",
        backgroundColor: "#130714dd",
        padding: {
          x: 7,
          y: 5
        }
      }
    ).setDepth(35);

    this.add.text(
      11215,
      112,
      [
        "MASTER ROUTE",
        "Jump → Dash → Double-jump"
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f0cf69",
        backgroundColor: "#130714dd",
        padding: {
          x: 7,
          y: 6
        }
      }
    ).setDepth(35);

    this.sanctumGateGraphics =
      this.add.graphics();

    this.sanctumGateGraphics.setDepth(27);

    this.sanctumObjectiveText = this.add.text(
      GAME_WIDTH * 0.5,
      42,
      "",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffe29a",
        backgroundColor: "#130714e8",
        padding: {
          x: 9,
          y: 6
        }
      }
    );

    this.sanctumObjectiveText
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1170)
      .setVisible(false);
  }

  private updateCardSanctum(): void {
    if (
      !this.cardSanctumEntered &&
      this.player.x >= 9620
    ) {
      this.cardSanctumEntered = true;

      this.playerHealth.setCheckpoint(
        9620,
        296,
        "The Card Sanctum"
      );
    }

    if (
      !this.cardSanctumActive &&
      !this.cardSanctumCleared &&
      this.player.x >= 9680
    ) {
      this.startCardSanctum();
    }

    if (!this.cardSanctumActive) {
      return;
    }

    const remaining =
      this.cardSentrySystem.remaining;

    this.sanctumObjectiveText.setText(
      [
        `CARD SANCTUM — SENTRIES ${3 - remaining}/3`,
        "Choose your route. Reach and destroy every sentry."
      ].join("\n")
    );

    if (remaining === 0) {
      this.completeCardSanctum();
    }
  }

  private startCardSanctum(): void {
    this.cardSanctumActive = true;

    this.collisionWorld.addSolid(
      this.sanctumExitGate
    );

    this.cardSentrySystem
      .setEnabled(true);

    this.cardSanctumHazardSystem
      .setEnabled(true);

    this.sanctumObjectiveText
      .setVisible(true);

    this.redrawSanctumGate();
  }

  private completeCardSanctum(): void {
    this.cardSanctumActive = false;
    this.cardSanctumCleared = true;

    this.collisionWorld.removeSolid(
      this.sanctumExitGate
    );

    this.cardSanctumHazardSystem
      .setEnabled(false);

    this.sanctumGateGraphics.clear();

    this.sanctumObjectiveText.setText(
      "CARD SANCTUM CLEARED — THE ROYAL BOX AWAITS"
    );

    this.cameras.main.flash(
      300,
      224,
      180,
      76,
      false
    );

    this.time.delayedCall(
      2600,
      () => {
        this.sanctumObjectiveText
          .setVisible(false);
      }
    );
  }

  private resetCardSanctumAfterDeath(): void {
    if (
      !this.cardSentrySystem ||
      !this.cardSanctumHazardSystem ||
      this.cardSanctumCleared
    ) {
      return;
    }

    this.cardSanctumActive = false;

    this.collisionWorld?.removeSolid(
      this.sanctumExitGate
    );

    this.cardSentrySystem
      .resetEncounter();

    this.cardSanctumHazardSystem
      .reset();

    this.sanctumGateGraphics?.clear();

    this.sanctumObjectiveText
      ?.setVisible(false)
      .setText("");
  }

  private redrawSanctumGate(): void {
    const g = this.sanctumGateGraphics;
    g.clear();

    const gate =
      this.sanctumExitGate;

    g.fillStyle(
      0x1d0819,
      0.97
    );

    g.fillRect(
      gate.x,
      gate.y,
      gate.width,
      gate.height
    );

    g.lineStyle(
      3,
      0xd83b6a,
      1
    );

    for (
      let y = 8;
      y < gate.height;
      y += 24
    ) {
      g.lineBetween(
        gate.x + 2,
        y,
        gate.right - 2,
        y + 14
      );
    }

    g.lineStyle(
      2,
      0xe4ba55,
      1
    );

    g.strokeRect(
      gate.x,
      gate.y,
      gate.width,
      gate.height
    );
  }

  private createSpotlightVault(): void {
    const startX = 8180;

    const background = this.add.graphics();

    background
      .setDepth(-4)
      .setScrollFactor(1);

    background.fillStyle(
      0x06131b,
      1
    );

    background.fillRect(
      startX,
      0,
      WORLD_WIDTH - startX,
      360
    );

    for (
      let x = 8220;
      x < WORLD_WIDTH;
      x += 220
    ) {
      background.fillStyle(
        0x102c38,
        0.92
      );

      background.fillRoundedRect(
        x,
        28,
        150,
        270,
        26
      );

      background.lineStyle(
        4,
        0xc3973e,
        0.9
      );

      background.strokeRoundedRect(
        x,
        28,
        150,
        270,
        26
      );

      background.lineStyle(
        2,
        0x6de0e9,
        0.48
      );

      background.strokeCircle(
        x + 75,
        142,
        42
      );

      background.strokeCircle(
        x + 75,
        142,
        25
      );

      for (
        let ray = 0;
        ray < 8;
        ray += 1
      ) {
        const angle =
          ray / 8 *
          Math.PI * 2;

        background.lineBetween(
          x + 75 +
            Math.cos(angle) * 29,
          142 +
            Math.sin(angle) * 29,
          x + 75 +
            Math.cos(angle) * 49,
          142 +
            Math.sin(angle) * 49
        );
      }
    }

    background.fillStyle(
      0xd0a344,
      1
    );

    background.fillRect(
      startX,
      24,
      WORLD_WIDTH - startX,
      5
    );

    background.fillRect(
      startX,
      315,
      WORLD_WIDTH - startX,
      4
    );

    background.fillStyle(
      0x71e2eb,
      1
    );

    background.fillRect(
      startX,
      326,
      WORLD_WIDTH - startX,
      3
    );

    // Spotlight Sigil.
    background.fillStyle(
      0xe8c65f,
      0.18
    );

    background.fillCircle(
      8345,
      222,
      62
    );

    background.lineStyle(
      4,
      0xf1ce68,
      1
    );

    background.strokeCircle(
      8345,
      222,
      42
    );

    background.lineStyle(
      2,
      0x78e7ef,
      0.95
    );

    background.strokeCircle(
      8345,
      222,
      25
    );

    this.add.text(
      8240,
      82,
      "ACT V — THE SPOTLIGHT VAULT",
      {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#9bf3f8",
        backgroundColor: "#06131be8",
        padding: {
          x: 10,
          y: 7
        }
      }
    ).setDepth(35);

    this.add.text(
      8260,
      116,
      [
        "The staff remembers the light.",
        "",
        "Press [K] to cast Spotlight."
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f1d575",
        backgroundColor: "#06131bdd",
        padding: {
          x: 8,
          y: 6
        }
      }
    ).setDepth(35);

    this.vaultGateGraphics =
      this.add.graphics();

    this.vaultGateGraphics.setDepth(24);

    this.vaultObjectiveText = this.add.text(
      GAME_WIDTH * 0.5,
      44,
      "",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#c8f9ff",
        backgroundColor: "#06131be8",
        padding: {
          x: 9,
          y: 6
        }
      }
    );

    this.vaultObjectiveText
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1160)
      .setVisible(false);
  }

  private updateSpotlightVault(): void {
    if (
      !this.spotlightVaultEntered &&
      this.player.x >= 8250
    ) {
      this.spotlightVaultEntered = true;

      this.playerHealth.setCheckpoint(
        8240,
        296,
        "The Spotlight Vault"
      );

      this.magicSystem.unlock();

      this.cameras.main.flash(
        280,
        118,
        230,
        239,
        false
      );
    }

    if (
      !this.spotlightVaultActive &&
      !this.spotlightVaultCleared &&
      this.player.x >= 8460
    ) {
      this.startSpotlightVault();
    }

    if (!this.spotlightVaultActive) {
      return;
    }

    const remaining =
      this.lightWraithSystem.remaining;

    this.vaultObjectiveText.setText(
      [
        `SPOTLIGHT TRAINING — WRAITHS ${2 - remaining}/2`,
        "Physical attacks are weak. Press [K] within range."
      ].join("\n")
    );

    if (remaining === 0) {
      this.completeSpotlightVault();
    }
  }

  private startSpotlightVault(): void {
    this.spotlightVaultActive = true;

    this.collisionWorld.addSolid(
      this.vaultLeftGate
    );

    this.collisionWorld.addSolid(
      this.vaultRightGate
    );

    this.lightWraithSystem
      .setEnabled(true);

    this.vaultObjectiveText
      .setVisible(true);

    this.redrawVaultGates();
  }

  private completeSpotlightVault(): void {
    this.spotlightVaultActive = false;
    this.spotlightVaultCleared = true;

    this.collisionWorld.removeSolid(
      this.vaultLeftGate
    );

    this.collisionWorld.removeSolid(
      this.vaultRightGate
    );

    this.vaultGateGraphics.clear();

    this.vaultObjectiveText.setText(
      "SPOTLIGHT MASTERED — THE VAULT IS OPEN"
    );

    this.cameras.main.flash(
      300,
      242,
      210,
      104,
      false
    );

    this.time.delayedCall(
      2400,
      () => {
        this.vaultObjectiveText
          .setVisible(false);
      }
    );

    this.add.text(
      9360,
      176,
      "TO THE CARD SANCTUM →",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f4d776",
        backgroundColor: "#06131bdd",
        padding: {
          x: 8,
          y: 6
        }
      }
    ).setDepth(35);
  }

  private resetSpotlightVaultAfterDeath(): void {
    if (
      !this.lightWraithSystem ||
      !this.magicSystem ||
      this.spotlightVaultCleared
    ) {
      return;
    }

    this.spotlightVaultActive = false;

    this.collisionWorld?.removeSolid(
      this.vaultLeftGate
    );

    this.collisionWorld?.removeSolid(
      this.vaultRightGate
    );

    this.lightWraithSystem
      .resetEncounter();

    this.magicSystem
      .resetEncounter();

    this.vaultGateGraphics?.clear();

    this.vaultObjectiveText
      ?.setVisible(false)
      .setText("");
  }

  private redrawVaultGates(): void {
    const g = this.vaultGateGraphics;
    g.clear();

    for (
      const gate of [
        this.vaultLeftGate,
        this.vaultRightGate
      ]
    ) {
      g.fillStyle(
        0x071720,
        0.96
      );

      g.fillRect(
        gate.x,
        gate.y,
        gate.width,
        gate.height
      );

      g.lineStyle(
        3,
        0x72e2eb,
        1
      );

      for (
        let y = 8;
        y < gate.height;
        y += 24
      ) {
        g.lineBetween(
          gate.x + 2,
          y,
          gate.right - 2,
          y + 14
        );
      }

      g.lineStyle(
        2,
        0xe7c45d,
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

  private createGalleryGauntlet(): void {
    const g = this.add.graphics();

    // Environment artwork must remain behind the collision geometry.
    // Level solids are rendered at depth 0, hazards at depth 25.
    g.setDepth(-3);
    g.setScrollFactor(1);

    // The gallery descends into a colder, fractured backstage void.
    g.fillStyle(
      0x050914,
      1
    );

    g.fillRect(
      6380,
      360,
      WORLD_WIDTH - 6380,
      WORLD_HEIGHT - 360
    );

    g.fillStyle(
      0x0d1730,
      0.94
    );

    g.fillRect(
      6380,
      300,
      WORLD_WIDTH - 6380,
      60
    );

    // Deep vertical architectural lines.
    for (
      let x = 6420;
      x < WORLD_WIDTH;
      x += 150
    ) {
      g.lineStyle(
        2,
        0x3b6b86,
        0.25
      );

      g.lineBetween(
        x,
        300,
        x,
        WORLD_HEIGHT
      );
    }

    // Void silhouettes.
    for (
      let x = 6470;
      x < WORLD_WIDTH;
      x += 290
    ) {
      g.fillStyle(
        0x02040a,
        0.62
      );

      g.fillTriangle(
        x,
        WORLD_HEIGHT,
        x + 80,
        350,
        x + 160,
        WORLD_HEIGHT
      );
    }

    // Cyan route markers.
    const routePoints = [
      [6420, 304],
      [6625, 260],
      [6750, 404],
      [7100, 356],
      [7410, 188],
      [7520, 300],
      [7870, 246],
      [8040, 300]
    ] as const;

    for (const point of routePoints) {
      const [x, y] = point;

      g.fillStyle(
        0x73e3eb,
        0.75
      );

      g.fillCircle(
        x,
        y,
        3
      );

      g.lineStyle(
        1,
        0xd6ad49,
        0.65
      );

      g.strokeCircle(
        x,
        y,
        7
      );
    }

    this.add.text(
      6410,
      250,
      [
        "THE GALLERY GAUNTLET",
        "Mind the void. Watch the rhythm."
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8beaf1",
        backgroundColor: "#050914e8",
        padding: {
          x: 8,
          y: 7
        }
      }
    ).setDepth(30);

    this.add.text(
      7050,
      448,
      "ASCEND BEFORE THE SHADOW STRIKES",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#d8b456",
        backgroundColor: "#050914dd",
        padding: {
          x: 7,
          y: 5
        }
      }
    ).setDepth(30);

    this.add.text(
      8000,
      286,
      "THE SPOTLIGHT VAULT →",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f3d36b",
        backgroundColor: "#050914dd",
        padding: {
          x: 8,
          y: 6
        }
      }
    ).setDepth(30);

    this.galleryObjectiveText = this.add.text(
      GAME_WIDTH * 0.5,
      12,
      "",
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#a9f4fa",
        backgroundColor: "#050914e8",
        padding: {
          x: 9,
          y: 6
        }
      }
    );

    this.galleryObjectiveText
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1150)
      .setVisible(false);
  }

  private updateGalleryGauntlet(): void {
    if (
      !this.galleryGauntletEntered &&
      this.player.x >= 6370
    ) {
      this.galleryGauntletEntered = true;

      this.playerHealth.setCheckpoint(
        6385,
        296,
        "Gallery Gauntlet"
      );
    }

    if (
      !this.galleryGauntletEnabled &&
      this.player.x >= 6400 &&
      this.player.x < 7995
    ) {
      this.galleryGauntletEnabled = true;

      this.shadowAcrobatSystem
        .setEnabled(true);

      this.galleryHazardSystem
        .setEnabled(true);

      this.galleryObjectiveText
        .setVisible(true);
    }

    if (
      this.galleryGauntletEnabled
    ) {
      const shadows =
        this.shadowAcrobatSystem.remaining;

      this.galleryObjectiveText.setText(
        `GALLERY GAUNTLET — SHADOWS ${2 - shadows}/2`
      );
    }

    if (
      !this.galleryMidpointActivated &&
      this.player.x >= 7490
    ) {
      this.galleryMidpointActivated = true;

      this.playerHealth.setCheckpoint(
        7490,
        296,
        "Gauntlet Midpoint"
      );
    }

    if (
      this.player.x >= 7995 &&
      this.galleryGauntletEnabled
    ) {
      this.galleryGauntletEnabled = false;

      this.galleryHazardSystem
        .setEnabled(false);

      this.galleryObjectiveText
        .setText(
          "GAUNTLET CLEARED — THE SPOTLIGHT VAULT AWAITS"
        );

      this.time.delayedCall(
        2200,
        () => {
          this.galleryObjectiveText
            .setVisible(false);
        }
      );
    }
  }

  private createGrandGallery(): void {
    const galleryStart = 4760;

    // The Grand Gallery ends where the Gallery Gauntlet begins.
    // Do not use WORLD_WIDTH here: later milestones expand the world,
    // but the Gallery artwork must not cover subsequent level sections.
    const galleryEnd = 6400;

    // Solid background layer: this deliberately covers the red theater
    // backdrop and makes the biome transition immediately readable.
    const background = this.add.graphics();

    background.setDepth(-90);
    background.setScrollFactor(1);

    background.fillStyle(
      0x07111f,
      1
    );

    background.fillRect(
      galleryStart,
      0,
      galleryEnd - galleryStart,
      WORLD_HEIGHT
    );

    // Deep blue wall panels.
    for (
      let x = galleryStart;
      x < galleryEnd;
      x += 180
    ) {
      background.fillStyle(
        0x101c35,
        1
      );

      background.fillRect(
        x,
        0,
        116,
        326
      );

      background.fillStyle(
        0x261943,
        0.72
      );

      background.fillRect(
        x + 116,
        0,
        64,
        326
      );

      background.lineStyle(
        2,
        0x3d6d8c,
        0.28
      );

      background.lineBetween(
        x + 10,
        0,
        x + 10,
        326
      );

      background.lineBetween(
        x + 106,
        0,
        x + 106,
        326
      );
    }

    // Tall gallery windows.
    for (
      let x = 4900;
      x < galleryEnd - 80;
      x += 360
    ) {
      background.fillStyle(
        0x030812,
        1
      );

      background.fillRoundedRect(
        x,
        38,
        92,
        172,
        42
      );

      background.lineStyle(
        4,
        0xb88938,
        0.88
      );

      background.strokeRoundedRect(
        x,
        38,
        92,
        172,
        42
      );

      background.lineStyle(
        1,
        0x64d6e8,
        0.38
      );

      background.lineBetween(
        x + 46,
        42,
        x + 46,
        205
      );

      background.lineBetween(
        x + 8,
        122,
        x + 84,
        122
      );

      // Stars visible through the windows.
      for (
        let star = 0;
        star < 6;
        star += 1
      ) {
        const starX =
          x + 17 +
          ((star * 29) % 62);

        const starY =
          63 +
          ((star * 43) % 118);

        background.fillStyle(
          star % 2 === 0
            ? 0x7de5f2
            : 0xf1c75b,
          0.85
        );

        background.fillCircle(
          starX,
          starY,
          star % 3 === 0 ? 2 : 1
        );
      }
    }

    // Ornate picture frames and card-suit emblems.
    const framePositions = [
      5075,
      5435,
      5795,
      6155
    ];

    for (
      let index = 0;
      index < framePositions.length;
      index += 1
    ) {
      const x = framePositions[index];

      if (x === undefined) {
        continue;
      }

      background.fillStyle(
        0x191027,
        1
      );

      background.fillRoundedRect(
        x,
        78,
        72,
        94,
        7
      );

      background.lineStyle(
        5,
        0xa9782e,
        1
      );

      background.strokeRoundedRect(
        x,
        78,
        72,
        94,
        7
      );

      background.lineStyle(
        1,
        0xf0cd6b,
        0.8
      );

      background.strokeRoundedRect(
        x + 7,
        85,
        58,
        80,
        4
      );

      const centerX = x + 36;
      const centerY = 125;

      if (index % 2 === 0) {
        background.fillStyle(
          0x65d9eb,
          0.78
        );

        background.fillTriangle(
          centerX,
          centerY - 18,
          centerX - 15,
          centerY,
          centerX + 15,
          centerY
        );

        background.fillTriangle(
          centerX,
          centerY + 18,
          centerX - 15,
          centerY,
          centerX + 15,
          centerY
        );
      } else {
        background.fillStyle(
          0xb82e68,
          0.82
        );

        background.fillCircle(
          centerX - 8,
          centerY - 5,
          10
        );

        background.fillCircle(
          centerX + 8,
          centerY - 5,
          10
        );

        background.fillTriangle(
          centerX - 17,
          centerY,
          centerX + 17,
          centerY,
          centerX,
          centerY + 20
        );
      }
    }

    // Gold wall trim.
    background.fillStyle(
      0x9d7130,
      1
    );

    background.fillRect(
      galleryStart,
      26,
      galleryEnd - galleryStart,
      4
    );

    background.fillRect(
      galleryStart,
      314,
      galleryEnd - galleryStart,
      5
    );

    background.fillStyle(
      0xe0ba57,
      0.6
    );

    background.fillRect(
      galleryStart,
      27,
      galleryEnd - galleryStart,
      1
    );

    // Transition arch between the theater and gallery.
    const architecture = this.add.graphics();

    architecture.setDepth(-5);
    architecture.setScrollFactor(1);

    architecture.fillStyle(
      0x090916,
      1
    );

    architecture.fillRect(
      4750,
      0,
      38,
      326
    );

    architecture.lineStyle(
      5,
      0xd0a33e,
      1
    );

    architecture.lineBetween(
      4762,
      0,
      4762,
      326
    );

    architecture.lineBetween(
      4778,
      0,
      4778,
      326
    );

    for (
      let y = 16;
      y < 326;
      y += 30
    ) {
      architecture.lineStyle(
        2,
        0x69d5e6,
        0.72
      );

      architecture.lineBetween(
        4763,
        y,
        4777,
        y + 14
      );
    }

    // Chandeliers.
    for (
      let x = 5000;
      x < galleryEnd;
      x += 420
    ) {
      architecture.lineStyle(
        2,
        0xb98734,
        0.9
      );

      architecture.lineBetween(
        x,
        0,
        x,
        46
      );

      architecture.lineBetween(
        x - 22,
        54,
        x + 22,
        54
      );

      architecture.lineBetween(
        x - 22,
        54,
        x - 30,
        67
      );

      architecture.lineBetween(
        x + 22,
        54,
        x + 30,
        67
      );

      architecture.fillStyle(
        0x7de4ef,
        0.88
      );

      architecture.fillCircle(
        x,
        53,
        5
      );

      architecture.fillCircle(
        x - 30,
        67,
        4
      );

      architecture.fillCircle(
        x + 30,
        67,
        4
      );
    }

    // Repaint the gallery floor so it no longer uses the theater palette.
    const foreground = this.add.graphics();

    foreground.setDepth(2);
    foreground.setScrollFactor(1);

    foreground.fillStyle(
      0x11182b,
      1
    );

    foreground.fillRect(
      galleryStart,
      326,
      galleryEnd - galleryStart,
      34
    );

    foreground.fillStyle(
      0x5bc6d8,
      1
    );

    foreground.fillRect(
      galleryStart,
      326,
      galleryEnd - galleryStart,
      3
    );

    foreground.fillStyle(
      0xb88a37,
      0.9
    );

    foreground.fillRect(
      galleryStart,
      330,
      galleryEnd - galleryStart,
      2
    );

    // Gallery platform overlays.
    const galleryPlatforms = [
      [4870, 276, 125],
      [5060, 232, 120],
      [5250, 184, 110],
      [5435, 244, 125],
      [5640, 198, 110],
      [5825, 266, 130],
      [6035, 220, 120],
      [6210, 170, 105]
    ] as const;

    for (const platform of galleryPlatforms) {
      const [x, y, width] = platform;

      foreground.fillStyle(
        0x182741,
        1
      );

      foreground.fillRoundedRect(
        x,
        y,
        width,
        14,
        4
      );

      foreground.fillStyle(
        0x65d8e8,
        1
      );

      foreground.fillRect(
        x,
        y,
        width,
        3
      );

      foreground.lineStyle(
        1,
        0xc8963e,
        0.9
      );

      foreground.strokeRoundedRect(
        x,
        y,
        width,
        14,
        4
      );
    }

    this.add.text(
      4890,
      92,
      "ACT IV — THE GRAND GALLERY",
      {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#82e5ef",
        backgroundColor: "#07101ddd",
        padding: {
          x: 9,
          y: 7
        }
      }
    ).setDepth(4);

    this.add.text(
      4890,
      124,
      "Beyond the stage, the casino dreams.",
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#e8d7ab"
      }
    ).setDepth(4);

    this.add.text(
      6130,
      126,
      [
        "THE SPOTLIGHT SIGIL",
        "",
        "A forbidden light waits ahead..."
      ].join("\n"),
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f2cf69",
        backgroundColor: "#080e1bdd",
        padding: {
          x: 8,
          y: 7
        }
      }
    ).setDepth(4);

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
    if (
      !this.grandGalleryEntered &&
      this.player.x >= 4800
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
      this.player.x >= 4860
    ) {
      this.grandGalleryCheckpointActivated = true;

      this.playerHealth.setCheckpoint(
        4840,
        296,
        "The Grand Gallery"
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
  }

  private updateEncounter(): void {
    if (
      !this.checkpointActivated &&
      this.player.x >= 2940
    ) {
      this.checkpointActivated = true;

      this.playerHealth.setCheckpoint(
        2960,
        296,
        "The Main Stage"
      );
    }

    if (
      !this.encounterActive &&
      !this.encounterCleared &&
      this.player.x >= 3070
    ) {
      this.startEncounter();
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
      `ACT III — DEFEAT THE TROUPE   ${total - remaining}/${total}`
    );

    if (remaining === 0) {
      this.completeEncounter();
    }
  }

  private resetEncounterAfterDeath(): void {
    this.shadowAcrobatSystem?.resetEncounter();
    this.galleryHazardSystem?.reset();
    this.resetSpotlightVaultAfterDeath();
    this.resetCardSanctumAfterDeath();
    this.resetRoyalBoxAfterDeath();
    this.mirrorCoreSystem?.resetAfterDeath();

    this.galleryGauntletEnabled = false;

    this.galleryObjectiveText
      ?.setVisible(false)
      .setText("");

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

    this.encounterText
      .setText(
        "ACT III — DEFEAT THE TROUPE   0/5"
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

    this.encounterText.setText(
      "ACT III COMPLETE — THE EXIT IS OPEN"
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
      4240,
      238,
      "TO THE GRAND GALLERY →",
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
        this.arenaLeftGate,
        this.arenaRightGate
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
