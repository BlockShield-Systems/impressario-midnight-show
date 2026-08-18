import Phaser from "phaser";

const ATLAS_KEY = "enemies";
const SOURCE_SIZE = 64;
const FOOTPOINT_Y = 57;
const DISPLAY_SCALE = 0.82;

export interface EnemyViewState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly facing: -1 | 1;
  readonly visible: boolean;
  readonly tag: string;
  readonly flashing: boolean;
}

function animationKey(tag: string): string {
  return `${ATLAS_KEY}:${tag}`;
}

function isDefeatTag(tag: string): boolean {
  return (
    tag.endsWith("_defeat") ||
    tag.endsWith("_defeated")
  );
}

function shouldLoop(tag: string): boolean {
  return (
    tag.endsWith("_idle") ||
    tag.endsWith("_walk") ||
    tag.endsWith("_move") ||
    tag.endsWith("_stalk") ||
    tag.endsWith("_hover") ||
    tag.endsWith("_patrol")
  );
}

export class EnemyView {
  private readonly sprite:
    Phaser.GameObjects.Sprite;

  private currentTag: string | null = null;
  private defeatFinished = false;

  public static preload(scene: Phaser.Scene): void {
    scene.load.atlas(
      ATLAS_KEY,
      "assets/atlases/enemies.png",
      "assets/atlases/enemies.json"
    );
  }

  public constructor(
    private readonly scene: Phaser.Scene,
    depth: number
  ) {
    this.registerAnimations();

    this.sprite = scene.add.sprite(
      0,
      0,
      ATLAS_KEY,
      "stagehand_idle_0"
    );

    this.sprite
      .setOrigin(
        0.5,
        FOOTPOINT_Y / SOURCE_SIZE
      )
      .setScale(DISPLAY_SCALE)
      .setDepth(depth)
      .setVisible(false);
  }

  public update(state: EnemyViewState): void {
    const defeated =
      isDefeatTag(state.tag);

    if (!defeated && this.defeatFinished) {
      this.scene.tweens.killTweensOf(
        this.sprite
      );

      this.defeatFinished = false;

      this.sprite
        .setAlpha(1)
        .setVisible(true);
    }

    if (defeated && this.defeatFinished) {
      this.sprite.setVisible(false);
      return;
    }

    this.sprite.setVisible(state.visible);

    if (!state.visible) {
      return;
    }

    this.sprite.setPosition(
      state.x + state.width * 0.5,
      state.y + state.height
    );

    this.sprite.setScale(
      state.facing * DISPLAY_SCALE,
      DISPLAY_SCALE
    );

    if (state.flashing) {
      this.sprite.setTint(0xffffff);
      this.sprite.setTintFill();
    } else {
      this.sprite.clearTint();
    }

    this.play(state.tag);
  }

  private registerAnimations(): void {
    const texture =
      this.scene.textures.get(ATLAS_KEY);

    const availableFrames =
      texture.getFrameNames();

    const tags = new Set<string>();

    for (const frame of availableFrames) {
      const match = /^(.*)_\d+$/.exec(frame);

      if (match?.[1]) {
        tags.add(match[1]);
      }
    }

    if (tags.size !== 58) {
      throw new Error(
        `Expected 58 enemy animations, found ${tags.size}.`
      );
    }

    for (const tag of tags) {
      const key = animationKey(tag);

      if (this.scene.anims.exists(key)) {
        continue;
      }

      const prefix = `${tag}_`;

      const frames =
        availableFrames
          .filter(name =>
            name.startsWith(prefix)
          )
          .sort((left, right) =>
            left.localeCompare(
              right,
              "en",
              { numeric: true }
            )
          );

      this.scene.anims.create({
        key,
        frames: frames.map(frame => ({
          key: ATLAS_KEY,
          frame
        })),
        frameRate: 12,
        repeat: shouldLoop(tag) ? -1 : 0,
        skipMissedFrames: false
      });
    }
  }

  private play(tag: string): void {
    if (this.currentTag === tag) {
      return;
    }

    const key = animationKey(tag);

    if (!this.scene.anims.exists(key)) {
      throw new Error(
        `Missing enemy animation: ${tag}`
      );
    }

    this.scene.tweens.killTweensOf(
      this.sprite
    );

    this.sprite.setAlpha(1);
    this.defeatFinished = false;
    this.currentTag = tag;
    this.sprite.play(key);

    if (!isDefeatTag(tag)) {
      return;
    }

    this.sprite.once(
      "animationcomplete",
      () => {
        if (
          this.currentTag !== tag ||
          !isDefeatTag(tag)
        ) {
          return;
        }

        this.scene.tweens.add({
          targets: this.sprite,
          alpha: 0,
          duration: 280,
          ease: "Sine.easeIn",
          onComplete: () => {
            if (this.currentTag !== tag) {
              return;
            }

            this.defeatFinished = true;
            this.sprite.setVisible(false);
          }
        });
      }
    );
  }
}
