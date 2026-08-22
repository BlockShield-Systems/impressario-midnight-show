import { MOVEMENT } from "./MovementConfig.ts";
import type { MovementInputSnapshot } from "./MovementInputEdges.ts";
import {
  KinematicCollisionWorld,
  type CollisionContacts,
  type KinematicBody
} from "./KinematicCollisionWorld.ts";
import {
  hasClearedDroppedPlatform,
  shouldStartOneWayDrop,
  type CollisionRectangle
} from "./OneWayPlatformPolicy.ts";

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

  private readonly world:
    KinematicCollisionWorld;

  public readonly width = MOVEMENT.bodyWidth;
  public readonly height = MOVEMENT.bodyHeight;

  public velocityX = 0;
  public velocityY = 0;

  public facing: -1 | 1 = 1;

  private contacts: CollisionContacts = {
    grounded: false,
    groundedOneWay: null,
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
  private droppedOneWay:
    CollisionRectangle | null = null;

  public constructor(
    world: KinematicCollisionWorld,
    startX: number,
    startY: number
  ) {
    this.world = world;
    this.x = startX;
    this.y = startY;
  }

  public fixedUpdate(
    deltaSeconds: number,
    input: MovementInputSnapshot
  ): void {
    this.tickTimers(deltaSeconds);

    if (
      this.droppedOneWay &&
      hasClearedDroppedPlatform(
        this,
        this.droppedOneWay
      )
    ) {
      this.droppedOneWay = null;
    }

    const droppingThrough =
      shouldStartOneWayDrop(
        input.downHeld,
        input.jumpPressed,
        this.contacts.groundedOneWay
      );

    if (droppingThrough) {
      this.droppedOneWay =
        this.contacts.groundedOneWay;
      this.contacts.grounded = false;
      this.contacts.groundedOneWay = null;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.velocityY = Math.max(
        this.velocityY,
        60
      );
    } else if (input.jumpPressed) {
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

    if (
      input.dashPressed &&
      !droppingThrough
    ) {
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

  public resetTransientState(): void {
    this.velocityX = 0;
    this.velocityY = 0;
    this.contacts = {
      grounded: false,
      groundedOneWay: null,
      ceiling: false,
      wallLeft: false,
      wallRight: false
    };
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.wallControlLockTimer = 0;
    this.jumpsUsed = 0;
    this.airDashAvailable = true;
    this.droppedOneWay = null;
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

  public getDebugSnapshot() {
    return {
      state: this.state,
      grounded: this.contacts.grounded,
      groundedOneWay:
        this.contacts.groundedOneWay,
      ceiling: this.contacts.ceiling,
      wallLeft: this.contacts.wallLeft,
      wallRight: this.contacts.wallRight,
      jumpsUsed: this.jumpsUsed,
      airDashAvailable:
        this.airDashAvailable,
      dashActive: this.dashTimer > 0,
      dashTimer: this.dashTimer,
      dashCooldownTimer:
        this.dashCooldownTimer,
      droppedOneWay:
        this.droppedOneWay
    };
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

  private tryStartDash(input: MovementInputSnapshot): void {
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
    input: MovementInputSnapshot
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
    input: MovementInputSnapshot
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
    input: MovementInputSnapshot
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
    input: MovementInputSnapshot
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
      this.velocityY * deltaSeconds,
      this.droppedOneWay
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
