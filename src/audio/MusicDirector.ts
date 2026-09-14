import Phaser from "phaser";

import type {
  AudioAssetId
} from "./AudioManifest";

import type {
  AudioDirector
} from "./AudioDirector";

import type {
  ManagedAudioHandle
} from "./audio-types";

export class MusicDirector {
  private music:
    ManagedAudioHandle | null = null;

  private ambience:
    ManagedAudioHandle | null = null;

  private musicId:
    AudioAssetId | null = null;

  private ambienceId:
    AudioAssetId | null = null;

  private readonly soundtrackRequests =
    new Map<AudioAssetId, number>();

  private soundtrackTransitionCount = 0;

  private readonly activeFades =
    new Map<
      ManagedAudioHandle,
      Phaser.Tweens.Tween
    >();

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioDirector
  ) {
    scene.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      this.destroy,
      this
    );
  }

  public setMusic(
    id: AudioAssetId,
    duration = 1200
  ): void {
    this.soundtrackRequests.set(
      id,
      (this.soundtrackRequests.get(id) ?? 0) + 1
    );

    if (id === this.musicId) {
      return;
    }

    this.musicId = id;
    this.soundtrackTransitionCount += 1;

    this.crossfade(
      "music",
      id,
      duration
    );
  }

  public setAmbience(
    id: AudioAssetId,
    duration = 1000
  ): void {
    if (id === this.ambienceId) {
      return;
    }

    this.ambienceId = id;

    this.crossfade(
      "ambience",
      id,
      duration
    );
  }

  public getDebugSnapshot(): {
    readonly currentSoundtrack: AudioAssetId | null;
    readonly currentAmbience: AudioAssetId | null;
    readonly currentBossThemePart: 1 | 2 | 3 | null;
    readonly soundtrackRequests: Readonly<Record<string, number>>;
    readonly soundtrackTransitionCount: number;
    readonly activeCrossfades: number;
  } {
    const phaseMatch =
      this.musicId?.match(
        /^music_1([0-2])_conductor_phase_([1-3])$/
      );

    return {
      currentSoundtrack: this.musicId,
      currentAmbience: this.ambienceId,
      currentBossThemePart:
        phaseMatch
          ? Number(
              phaseMatch[2]
            ) as 1 | 2 | 3
          : null,
      soundtrackRequests:
        Object.fromEntries(
          this.soundtrackRequests
        ),
      soundtrackTransitionCount:
        this.soundtrackTransitionCount,
      activeCrossfades:
        this.activeFades.size
    };
  }

  public stopMusic(
    duration = 300
  ): void {
    this.musicId = null;

    if (!this.music) {
      return;
    }

    const old = this.music;
    this.music = null;
    this.fadeOut(old, duration);
  }

  private crossfade(
    kind: "music" | "ambience",
    id: AudioAssetId,
    duration: number
  ): void {
    const previous =
      kind === "music"
        ? this.music
        : this.ambience;

    this.stopFadingHandles(id);

    const next =
      this.audio.play(id, {
        gain: 0,
        maxInstances: 1
      });

    if (!next) {
      return;
    }

    next.sound.once(
      Phaser.Sound.Events.DESTROY,
      () => this.cancelFade(next)
    );

    if (kind === "music") {
      this.music = next;
    } else {
      this.ambience = next;
    }

    if (duration <= 0) {
      next.setGain(1);
    } else {
      const fade = { gain: 0 };

      const tween =
        this.scene.tweens.add({
          targets: fade,
          gain: 1,
          duration,
          ease: "Sine.InOut",
          onUpdate: () => {
            next.setGain(fade.gain);
          },
          onComplete: () => {
            this.activeFades.delete(next);
            next.setGain(1);
          },
          onStop: () => {
            this.activeFades.delete(next);
          }
        });

      this.activeFades.set(next, tween);
    }

    if (previous) {
      this.fadeOut(previous, duration);
    }
  }

  private fadeOut(
    handle: ManagedAudioHandle,
    duration: number
  ): void {
    if (duration <= 0) {
      handle.stop();
      return;
    }

    this.cancelFade(handle);

    const fade = { gain: 1 };
    const tween =
      this.scene.tweens.add({
        targets: fade,
        gain: 0,
        duration,
        ease: "Sine.InOut",
        onUpdate: () => {
          handle.setGain(fade.gain);
        },
        onComplete: () => {
          this.activeFades.delete(handle);
          handle.stop();
        },
        onStop: () => {
          this.activeFades.delete(handle);
        }
      });

    this.activeFades.set(handle, tween);
  }

  private stopFadingHandles(
    id: AudioAssetId
  ): void {
    for (const handle of [
      ...this.activeFades.keys()
    ]) {
      if (handle.id !== id) {
        continue;
      }

      this.cancelFade(handle);
      handle.stop();
    }
  }

  private cancelFade(
    handle: ManagedAudioHandle
  ): void {
    const tween =
      this.activeFades.get(handle);

    if (!tween) {
      return;
    }

    this.activeFades.delete(handle);
    tween.stop();
  }

  private readonly destroy = (): void => {
    for (const handle of [
      ...this.activeFades.keys()
    ]) {
      this.cancelFade(handle);
    }
  };
}
