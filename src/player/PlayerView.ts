import Phaser from "phaser";

import type {
  PlayerController
} from "../main";

const TEXTURE_KEY =
  "impressario-player";

const FRAME_PREFIXES = {
  idle: "idle_",
  run: "run_",
  jumpStart: "jump_start_",
  rise: "rise_",
  fall: "fall_"
} as const;

const ANIMATION_KEYS = {
  idle: "impressario-idle",
  run: "impressario-run",
  jumpStart: "impressario-jump-start",
  rise: "impressario-rise",
  fall: "impressario-fall"
} as const;

interface AnimationDefinition {
  readonly key: string;
  readonly prefix: string;
  readonly frameRate: number;
  readonly repeat: number;
}

const ANIMATION_DEFINITIONS:
readonly AnimationDefinition[] = [
  {
    key: ANIMATION_KEYS.idle,
    prefix: FRAME_PREFIXES.idle,
    frameRate: 8,
    repeat: -1
  },
  {
    key: ANIMATION_KEYS.run,
    prefix: FRAME_PREFIXES.run,
    frameRate: 14,
    repeat: -1
  },
  {
    key: ANIMATION_KEYS.jumpStart,
    prefix: FRAME_PREFIXES.jumpStart,
    frameRate: 18,
    repeat: 0
  },
  {
    key: ANIMATION_KEYS.rise,
    prefix: FRAME_PREFIXES.rise,
    frameRate: 9,
    repeat: -1
  },
  {
    key: ANIMATION_KEYS.fall,
    prefix: FRAME_PREFIXES.fall,
    frameRate: 9,
    repeat: -1
  }
];

export class PlayerView {
  public readonly container:
    Phaser.GameObjects.Container;

  private readonly sprite:
    Phaser.GameObjects.Sprite;

  private readonly shadow:
    Phaser.GameObjects.Ellipse;

  private readonly dashEffects:
    Phaser.GameObjects.Graphics;

  private previousState = "";

  public constructor(
    scene: Phaser.Scene,
    private readonly player:
      PlayerController
  ) {
    this.createAnimations(scene);

    this.sprite = scene.add.sprite(
      0,
      15,
      TEXTURE_KEY,
      "idle_000"
    );

    // The authored sprite footpoint is X=64, Y=98
    // on a 128x128 source canvas.
    this.sprite.setOrigin(
      64 / 128,
      98 / 128
    );

    this.sprite.setDepth(20);

    this.dashEffects =
      scene.add.graphics();

    this.container =
      scene.add.container(
        player.centerX,
        player.centerY,
        [
          this.dashEffects,
          this.sprite
        ]
      );

    this.container.setDepth(20);

    this.shadow = scene.add.ellipse(
      player.centerX,
      player.y +
        player.height +
        3,
      24,
      6,
      0x000000,
      0.35
    );

    this.shadow.setDepth(5);

    this.sprite.play(
      ANIMATION_KEYS.idle
    );
  }

  public update(
    _deltaSeconds: number
  ): void {
    const state =
      this.player.state;

    this.container.setPosition(
      this.player.centerX,
      this.player.centerY
    );

    this.container.setScale(
      this.player.facing,
      1
    );

    this.shadow.setPosition(
      this.player.centerX,
      this.player.y +
        this.player.height +
        3
    );

    const airborne =
      state !== "idle" &&
      state !== "run";

    this.shadow.setScale(
      airborne ? 0.72 : 1,
      1
    );

    this.shadow.setAlpha(
      airborne ? 0.2 : 0.35
    );

    this.updateAnimation(
      state
    );

    this.redrawDashEffects(
      state
    );

    this.previousState = state;
  }

  private createAnimations(
    scene: Phaser.Scene
  ): void {
    const texture =
      scene.textures.get(
        TEXTURE_KEY
      );

    const frameNames =
      texture
        .getFrameNames()
        .filter(
          frame =>
            frame !== "__BASE"
        );

    for (
      const definition of
      ANIMATION_DEFINITIONS
    ) {
      const matchingFrames =
        frameNames
          .filter(
            frame =>
              frame.startsWith(
                definition.prefix
              )
          )
          .sort(
            (left, right) =>
              left.localeCompare(
                right,
                undefined,
                {
                  numeric: true
                }
              )
          );

      if (
        matchingFrames.length === 0
      ) {
        throw new Error(
          `Keine Atlas-Frames für ${
            definition.prefix
          } gefunden.`
        );
      }

      if (
        scene.anims.exists(
          definition.key
        )
      ) {
        continue;
      }

      scene.anims.create({
        key: definition.key,

        frames:
          matchingFrames.map(
            frame => ({
              key: TEXTURE_KEY,
              frame
            })
          ),

        frameRate:
          definition.frameRate,

        repeat:
          definition.repeat
      });
    }
  }

  private updateAnimation(
    state: string
  ): void {
    this.sprite.anims.timeScale = 1;
    this.sprite.clearTint();

    switch (state) {
      case "idle":
        this.playLoop(
          ANIMATION_KEYS.idle
        );
        return;

      case "run":
        this.playLoop(
          ANIMATION_KEYS.run
        );
        return;

      case "rise": {
        const justStartedRising =
          this.previousState !==
          "rise";

        if (justStartedRising) {
          this.sprite.play(
            ANIMATION_KEYS.jumpStart,
            true
          );

          return;
        }

        const currentKey =
          this.sprite.anims
            .currentAnim?.key;

        if (
          currentKey ===
            ANIMATION_KEYS.jumpStart &&
          this.sprite.anims.isPlaying
        ) {
          return;
        }

        this.playLoop(
          ANIMATION_KEYS.rise
        );

        return;
      }

      case "fall":
      case "wall-slide":
        this.playLoop(
          ANIMATION_KEYS.fall
        );
        return;

      case "dash":
        this.sprite.anims.timeScale =
          1.65;

        this.sprite.setTint(
          0xffe08a
        );

        this.playLoop(
          ANIMATION_KEYS.run
        );

        return;

      default:
        this.playLoop(
          ANIMATION_KEYS.idle
        );
    }
  }

  private playLoop(
    key: string
  ): void {
    if (
      this.sprite.anims
        .currentAnim?.key === key &&
      this.sprite.anims.isPlaying
    ) {
      return;
    }

    this.sprite.play(
      key,
      true
    );
  }

  private redrawDashEffects(
    state: string
  ): void {
    const g =
      this.dashEffects;

    g.clear();

    if (state !== "dash") {
      return;
    }

    g.lineStyle(
      2,
      0xf8d675,
      0.7
    );

    g.lineBetween(
      -18,
      -8,
      -42,
      -8
    );

    g.lineBetween(
      -18,
      0,
      -50,
      0
    );

    g.lineBetween(
      -18,
      8,
      -40,
      8
    );
  }
}
