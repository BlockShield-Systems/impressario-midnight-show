import Phaser from "phaser";

const ATLAS_KEY = "mirror-conductor";
const FRAME_SIZE = 128;
const FOOTPOINT_Y = 112;
const DISPLAY_SCALE = 0.72;

type BossPhase = 1 | 2 | 3;

export interface BossViewState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly facing: -1 | 1;
  readonly phase: BossPhase;
  readonly visible: boolean;
  readonly flashing: boolean;
}

function animationKey(tag: string): string {
  return `${ATLAS_KEY}:${tag}`;
}

function isLoopingTag(tag: string): boolean {
  return (
    tag === "boss_dormant" ||
    tag.endsWith("_idle")
  );
}

export class BossView {
  private readonly sprite:
    Phaser.GameObjects.Sprite;

  private currentTag: string | null = null;
  private sequenceActive = false;

  public static preload(scene: Phaser.Scene): void {
    scene.load.atlas(
      ATLAS_KEY,
      "assets/atlases/mirror-conductor.png",
      "assets/atlases/mirror-conductor.json"
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
      "boss_dormant_0"
    );

    this.sprite
      .setOrigin(
        0.5,
        FOOTPOINT_Y / FRAME_SIZE
      )
      .setScale(DISPLAY_SCALE)
      .setDepth(depth)
      .setVisible(false);
  }

  public update(
    state: BossViewState,
    tag: string
  ): void {
    if (this.sequenceActive) {
      return;
    }

    this.sprite.setVisible(state.visible);

    if (!state.visible) {
      return;
    }

    this.updateTransform(state);

    if (state.flashing) {
      this.sprite.setTint(0xffffff);
      this.sprite.setTintFill();
    } else {
      this.sprite.clearTint();
    }

    this.play(tag);
  }

  public playDefeatSequence(
    state: BossViewState,
    onComplete: () => void
  ): void {
    if (this.sequenceActive) {
      return;
    }

    this.sequenceActive = true;
    this.currentTag = null;

    this.scene.tweens.killTweensOf(
      this.sprite
    );

    this.sprite
      .clearTint()
      .setAlpha(1)
      .setVisible(true);

    this.updateTransform(state);

    this.playSequence(
      [
        "boss_defeat",
        "boss_fireworks",
      ],
      0,
      () => {
        this.sprite.setVisible(false);
        onComplete();
      }
    );
  }

  public reset(state: BossViewState): void {
    this.sequenceActive = false;
    this.currentTag = null;

    this.scene.tweens.killTweensOf(
      this.sprite
    );

    this.sprite
      .clearTint()
      .setAlpha(1)
      .setVisible(state.visible);

    this.updateTransform(state);

    if (state.visible) {
      this.play("boss_dormant");
    } else {
      this.sprite.stop();
    }
  }

  private updateTransform(
    state: BossViewState
  ): void {
    this.sprite.setPosition(
      state.x + state.width * 0.5,
      state.y + state.height
    );

    this.sprite.setScale(
      state.facing * DISPLAY_SCALE,
      DISPLAY_SCALE
    );
  }

  private registerAnimations(): void {
    const frameNames =
      this.scene.textures
        .get(ATLAS_KEY)
        .getFrameNames();

    const tags = new Set<string>();

    for (const frame of frameNames) {
      const match = /^(.*)_\d+$/.exec(frame);

      if (match?.[1]) {
        tags.add(match[1]);
      }
    }

    if (tags.size !== 21) {
      throw new Error(
        `Expected 21 boss animations, found ${tags.size}.`
      );
    }

    for (const tag of tags) {
      const key = animationKey(tag);

      if (this.scene.anims.exists(key)) {
        continue;
      }

      const prefix = `${tag}_`;

      const frames =
        frameNames
          .filter(frame =>
            frame.startsWith(prefix)
          )
          .sort((left, right) =>
            left.localeCompare(
              right,
              "en",
              { numeric: true }
            )
          );

      if (frames.length === 0) {
        throw new Error(
          `Boss tag has no frames: ${tag}`
        );
      }

      this.scene.anims.create({
        key,
        frames: frames.map(frame => ({
          key: ATLAS_KEY,
          frame,
        })),
        frameRate: 12,
        repeat:
          isLoopingTag(tag)
            ? -1
            : 0,
        skipMissedFrames: false,
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
        `Missing boss animation: ${tag}`
      );
    }

    this.currentTag = tag;
    this.sprite.play(key);
  }

  private playSequence(
    tags: readonly string[],
    index: number,
    onComplete: () => void
  ): void {
    const tag = tags[index];

    if (!tag) {
      onComplete();
      return;
    }

    const key = animationKey(tag);

    if (!this.scene.anims.exists(key)) {
      throw new Error(
        `Missing boss sequence animation: ${tag}`
      );
    }

    this.currentTag = tag;
    this.sprite.play(key);

    this.sprite.once(
      "animationcomplete",
      () => {
        this.playSequence(
          tags,
          index + 1,
          onComplete
        );
      }
    );
  }
}
