import Phaser from "phaser";

import type {
  CombatAnimationState,
  CombatSystem
} from "../combat/CombatSystem";

import type {
  MovementState,
  PlayerController
} from "../main";

import type {
  PlayerHealthSystem
} from "./PlayerHealthSystem";

const ATLAS_KEY = "impressario";

const SOURCE_CANVAS_SIZE = 128;
const PACKED_FRAME_SIZE = 130;
const PACKING_PADDING = 1;

// The generated figure occupies approximately 56 source
// pixels vertically. A 0.9 display factor restores the visual
// height of the previous roughly 50-pixel procedural figure.
const SOURCE_FRAME_SIZE =
  PACKED_FRAME_SIZE -
  PACKING_PADDING * 2;

const SPRITE_SCALE =
  SOURCE_CANVAS_SIZE /
  SOURCE_FRAME_SIZE *
  0.9;

const FOOTPOINT_X =
  64 + PACKING_PADDING;

const FOOTPOINT_Y =
  98 + PACKING_PADDING;

interface AnimationDefinition {
  readonly duration: number;
  readonly repeat: number;
}

const ANIMATIONS = {
  idle: {
    duration: 1000,
    repeat: -1
  },
  run: {
    duration: 700,
    repeat: -1
  },
  jump_start: {
    duration: 180,
    repeat: 0
  },
  rise: {
    duration: 300,
    repeat: -1
  },
  fall: {
    duration: 330,
    repeat: -1
  },
  land: {
    duration: 190,
    repeat: 0
  },
  dash: {
    duration: 270,
    repeat: 0
  },
  wall_slide: {
    duration: 360,
    repeat: -1
  },
  wall_jump: {
    duration: 250,
    repeat: 0
  },
  hurt: {
    duration: 340,
    repeat: 0
  },
  attack_combo_1: {
    duration: 300,
    repeat: 0
  },
  attack_combo_2: {
    duration: 310,
    repeat: 0
  },
  attack_combo_3: {
    duration: 460,
    repeat: 0
  },
  attack_low: {
    duration: 400,
    repeat: 0
  },
  attack_launcher: {
    duration: 460,
    repeat: 0
  },
  attack_air_neutral: {
    duration: 370,
    repeat: 0
  },
  attack_air_up: {
    duration: 400,
    repeat: 0
  },
  attack_down: {
    duration: 480,
    repeat: 0
  },
  attack_dash: {
    duration: 365,
    repeat: 0
  }
} as const satisfies
  Record<string, AnimationDefinition>;

type AnimationTag =
  keyof typeof ANIMATIONS;

const COMBAT_TAGS = {
  "combo-1": "attack_combo_1",
  "combo-2": "attack_combo_2",
  "combo-3": "attack_combo_3",
  low: "attack_low",
  launcher: "attack_launcher",
  "air-neutral": "attack_air_neutral",
  "air-up": "attack_air_up",
  "down-strike": "attack_down",
  "dash-attack": "attack_dash"
} as const satisfies Record<
  NonNullable<CombatAnimationState["attackId"]>,
  AnimationTag
>;

function isGroundState(
  state: MovementState
): boolean {
  return (
    state === "idle" ||
    state === "run"
  );
}

function animationKey(
  tag: AnimationTag
): string {
  return `${ATLAS_KEY}:${tag}`;
}

export class PlayerView {
  public readonly container:
    Phaser.GameObjects.Container;

  private readonly sprite:
    Phaser.GameObjects.Sprite;

  private readonly shadow:
    Phaser.GameObjects.Ellipse;

  private previousMovementState:
    MovementState;

  private previousWallJumping = false;

  private transition:
    AnimationTag | null = null;

  private transitionTimer = 0;

  private currentTag:
    AnimationTag | null = null;

  private animationPaused = false;

  public static preload(
    scene: Phaser.Scene
  ): void {
    scene.load.atlas(
      ATLAS_KEY,
      "assets/atlases/impressario.png",
      "assets/atlases/impressario.json"
    );
  }

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly combat: CombatSystem,
    private readonly health: PlayerHealthSystem
  ) {
    this.registerAnimations();

    this.sprite = scene.add.sprite(
      0,
      player.height * 0.5,
      ATLAS_KEY,
      "idle_000"
    );

    this.sprite.setOrigin(
      FOOTPOINT_X / PACKED_FRAME_SIZE,
      FOOTPOINT_Y / PACKED_FRAME_SIZE
    );

    this.sprite.setScale(SPRITE_SCALE);
    this.sprite.setDepth(20);

    this.container = scene.add.container(
      player.centerX,
      player.centerY,
      [this.sprite]
    );

    this.container.setDepth(20);

    this.shadow = scene.add.ellipse(
      player.centerX,
      player.y + player.height + 3,
      24,
      6,
      0x000000,
      0.35
    );

    this.shadow.setDepth(5);

    this.previousMovementState =
      player.state;

    this.play("idle");
  }

  public update(
    deltaSeconds: number
  ): void {
    const combatState =
      this.combat.animationState;

    this.updateTransform();

    this.updateTransition(deltaSeconds);

    const tag =
      this.selectAnimation(combatState);

    this.play(tag);

    this.setAnimationPaused(
      combatState.paused &&
      combatState.attackId !== null
    );

    this.updateShadow();

    this.previousMovementState =
      this.player.state;

    this.previousWallJumping =
      this.player.isWallJumping;
  }

  public get activeAnimation():
    string {
    return this.currentTag ?? "none";
  }

  private registerAnimations(): void {
    const texture =
      this.scene.textures.get(ATLAS_KEY);

    const availableFrames =
      texture.getFrameNames();

    for (
      const [tag, definition] of
      Object.entries(ANIMATIONS) as [
        AnimationTag,
        AnimationDefinition
      ][]
    ) {
      const key = animationKey(tag);

      if (this.scene.anims.exists(key)) {
        continue;
      }

      const prefix = `${tag}_`;

      const frameNames =
        availableFrames
          .filter(
            name =>
              name.startsWith(prefix)
          )
          .sort((left, right) =>
            left.localeCompare(
              right,
              "en",
              {
                numeric: true
              }
            )
          );

      if (frameNames.length === 0) {
        throw new Error(
          `Atlas animation contains no frames: ${tag}`
        );
      }

      this.scene.anims.create({
        key,

        frames: frameNames.map(
          frame => ({
            key: ATLAS_KEY,
            frame
          })
        ),

        duration: definition.duration,
        repeat: definition.repeat,
        skipMissedFrames: false
      });
    }
  }

  private updateTransform(): void {
    this.container.setPosition(
      this.player.centerX,
      this.player.centerY
    );

    // Every atlas tag uses the same source-facing convention.
    // Do not change the mirror sign when the animation state changes.
    this.container.setScale(
      -this.player.facing,
      1
    );

    this.shadow.setPosition(
      this.player.centerX,
      this.player.y +
        this.player.height +
        3
    );
  }

  private updateTransition(
    deltaSeconds: number
  ): void {
    this.transitionTimer = Math.max(
      0,
      this.transitionTimer -
        deltaSeconds
    );

    if (this.transitionTimer === 0) {
      this.transition = null;
    }

    const movementState =
      this.player.state;

    const grounded =
      isGroundState(movementState);

    const wasGrounded =
      isGroundState(
        this.previousMovementState
      );

    if (
      this.player.isWallJumping &&
      !this.previousWallJumping
    ) {
      this.startTransition(
        "wall_jump",
        0.25
      );

      return;
    }

    if (
      !wasGrounded &&
      grounded
    ) {
      this.startTransition(
        "land",
        0.19
      );

      return;
    }

    if (
      wasGrounded &&
      movementState === "rise"
    ) {
      this.startTransition(
        "jump_start",
        0.18
      );
    }
  }

  private startTransition(
    tag: AnimationTag,
    duration: number
  ): void {
    this.transition = tag;
    this.transitionTimer = duration;
  }

  private selectAnimation(
    combatState: CombatAnimationState
  ): AnimationTag {
    if (this.health.isHurt) {
      return "hurt";
    }

    if (combatState.attackId !== null) {
      return COMBAT_TAGS[
        combatState.attackId
      ];
    }

    if (this.player.state === "dash") {
      return "dash";
    }

    if (this.transition !== null) {
      return this.transition;
    }

    switch (this.player.state) {
      case "wall-slide":
        return "wall_slide";

      case "rise":
        return "rise";

      case "fall":
        return "fall";

      case "run":
        return "run";

      case "idle":
        return "idle";
    }
  }

  private play(
    tag: AnimationTag
  ): void {
    if (this.currentTag === tag) {
      return;
    }

    if (this.animationPaused) {
      this.sprite.anims.resume();
      this.animationPaused = false;
    }

    this.currentTag = tag;

    this.sprite.anims.timeScale =
      tag === "dash"
        ? ANIMATIONS.dash.duration /
          130
        : 1;

    this.sprite.play(
      animationKey(tag)
    );
  }

  private setAnimationPaused(
    paused: boolean
  ): void {
    if (
      paused &&
      !this.animationPaused
    ) {
      this.sprite.anims.pause();
      this.animationPaused = true;
      return;
    }

    if (
      !paused &&
      this.animationPaused
    ) {
      this.sprite.anims.resume();
      this.animationPaused = false;
    }
  }

  private updateShadow(): void {
    const grounded =
      isGroundState(
        this.player.state
      );

    this.shadow.setScale(
      grounded ? 1 : 0.72,
      1
    );

    this.shadow.setAlpha(
      grounded ? 0.35 : 0.2
    );
  }
}

