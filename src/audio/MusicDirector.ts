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

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioDirector
  ) {}

  public setMusic(
    id: AudioAssetId,
    duration = 1200
  ): void {
    if (id === this.musicId) {
      return;
    }

    this.musicId = id;

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

    const next =
      this.audio.play(id, {
        gain: 0,
        maxInstances: 1
      });

    if (!next) {
      return;
    }

    if (kind === "music") {
      this.music = next;
    } else {
      this.ambience = next;
    }

    const fade = { gain: 0 };

    this.scene.tweens.add({
      targets: fade,
      gain: 1,
      duration,
      ease: "Sine.InOut",
      onUpdate: () => {
        next.setGain(fade.gain);
      }
    });

    if (previous) {
      this.fadeOut(previous, duration);
    }
  }

  private fadeOut(
    handle: ManagedAudioHandle,
    duration: number
  ): void {
    const fade = { gain: 1 };

    this.scene.tweens.add({
      targets: fade,
      gain: 0,
      duration,
      ease: "Sine.InOut",
      onUpdate: () => {
        handle.setGain(fade.gain);
      },
      onComplete: () => {
        handle.stop();
      }
    });
  }
}
