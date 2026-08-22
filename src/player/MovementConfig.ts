export const MOVEMENT = {
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
