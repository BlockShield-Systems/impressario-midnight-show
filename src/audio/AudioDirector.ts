import Phaser from "phaser";

import {
  AUDIO_ASSET_BY_ID,
  AUDIO_ASSETS
} from "./AudioManifest";

import { AudioSettings } from "./AudioSettings";

import type {
  AudioAssetId
} from "./AudioManifest";

import type {
  AudioBus,
  ManagedAudioHandle,
  PlayAudioOptions
} from "./audio-types";

interface VolumeControllableSound
extends Phaser.Sound.BaseSound {
  setVolume(volume: number): this;
}

interface ManagedSound {
  readonly id: AudioAssetId;
  readonly bus: Exclude<AudioBus, "master">;
  readonly sound: VolumeControllableSound;
  gain: number;
}

const KEY_PREFIX = "audio:";

function ownerId(
  id: AudioAssetId
): AudioAssetId {
  const asset = AUDIO_ASSET_BY_ID.get(id);

  if (!asset) {
    throw new Error(
      `Unknown audio asset: ${id}`
    );
  }

  return (
    asset.aliasOf ??
    asset.id
  ) as AudioAssetId;
}

export class AudioDirector {
  public readonly settings =
    new AudioSettings();

  private readonly managed =
    new Set<ManagedSound>();

  private readonly cooldowns =
    new Map<AudioAssetId, number>();

  private voiceDepth = 0;
  private combatDuck = 0;

  public static preload(
    scene: Phaser.Scene
  ): void {
    const loadedOwners = new Set<string>();

    for (const asset of AUDIO_ASSETS) {
      const owner =
        asset.aliasOf ?? asset.id;

      if (loadedOwners.has(owner)) {
        continue;
      }

      loadedOwners.add(owner);

      scene.load.audio(
        `${KEY_PREFIX}${owner}`,
        [
          asset.primaryUrl,
          asset.fallbackUrl
        ]
      );
    }
  }

  public constructor(
    private readonly scene: Phaser.Scene
  ) {
    scene.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      () => this.destroy()
    );
  }

  public update(
    deltaSeconds: number
  ): void {
    for (
      const [id, remaining] of
      this.cooldowns
    ) {
      const next =
        remaining -
        deltaSeconds * 1000;

      if (next <= 0) {
        this.cooldowns.delete(id);
      } else {
        this.cooldowns.set(id, next);
      }
    }

    this.combatDuck = Math.max(
      0,
      this.combatDuck -
        deltaSeconds * 1.8
    );

    this.refreshVolumes();
  }

  public play(
    id: AudioAssetId,
    options: PlayAudioOptions = {}
  ): ManagedAudioHandle | null {
    const asset =
      AUDIO_ASSET_BY_ID.get(id);

    if (!asset) {
      throw new Error(
        `Unknown audio asset: ${id}`
      );
    }

    if (this.cooldowns.has(id)) {
      return null;
    }

    const maxInstances =
      options.maxInstances ?? 4;

    const existing =
      [...this.managed].filter(
        item => item.id === id
      );

    if (
      existing.length >= maxInstances
    ) {
      existing[0]?.sound.stop();
    }

    const owner = ownerId(id);
    const sound =
      this.scene.sound.add(
        `${KEY_PREFIX}${owner}`
      ) as VolumeControllableSound;

    const managed: ManagedSound = {
      id,
      bus: asset.bus,
      sound,
      gain:
        Phaser.Math.Clamp(
          options.gain ?? 1,
          0,
          2
        )
    };

    this.managed.add(managed);

    const pan =
      options.positionX === undefined
        ? Phaser.Math.Clamp(
            options.pan ?? 0,
            -1,
            1
          )
        : this.spatialPan(
            options.positionX
          );

    sound.once(
      "complete",
      () => {
        this.managed.delete(managed);
        sound.destroy();

        if (asset.bus === "voice") {
          this.voiceDepth = Math.max(
            0,
            this.voiceDepth - 1
          );
        }
      }
    );

    if (asset.bus === "voice") {
      this.voiceDepth += 1;
    }

    if (
      options.cooldownMs !== undefined
    ) {
      this.cooldowns.set(
        id,
        options.cooldownMs
      );
    }

    sound.play({
      loop: asset.loop,
      volume:
        this.volumeFor(managed),
      pan,
      detune:
        options.detune ?? 0
    });

    return {
      id,
      sound,
      setGain: gain => {
        managed.gain =
          Phaser.Math.Clamp(
            gain,
            0,
            2
          );

        sound.setVolume(
          this.volumeFor(managed)
        );
      },
      stop: () => {
        sound.stop();
        this.managed.delete(managed);
        sound.destroy();

        if (asset.bus === "voice") {
          this.voiceDepth = Math.max(
            0,
            this.voiceDepth - 1
          );
        }
      }
    };
  }

  public stopBus(
    bus: Exclude<AudioBus, "master">
  ): void {
    for (const item of [...this.managed]) {
      if (item.bus !== bus) {
        continue;
      }

      item.sound.stop();
      item.sound.destroy();
      this.managed.delete(item);
    }

    if (bus === "voice") {
      this.voiceDepth = 0;
    }
  }

  public triggerCombatDuck(
    amount = 0.18
  ): void {
    this.combatDuck = Math.max(
      this.combatDuck,
      Phaser.Math.Clamp(
        amount,
        0,
        0.45
      )
    );
  }

  private volumeFor(
    item: ManagedSound
  ): number {
    let volume =
      this.settings.getEffectiveVolume(
        item.bus
      ) *
      item.gain;

    if (this.voiceDepth > 0) {
      if (item.bus === "music") {
        volume *= 0.4;
      } else if (
        item.bus === "ambience"
      ) {
        volume *= 0.5;
      } else if (item.bus === "sfx") {
        volume *= 0.8;
      }
    }

    if (
      this.combatDuck > 0 &&
      (
        item.bus === "music" ||
        item.bus === "ambience"
      )
    ) {
      volume *=
        1 - this.combatDuck;
    }

    return Phaser.Math.Clamp(
      volume,
      0,
      1
    );
  }

  private refreshVolumes(): void {
    for (const item of this.managed) {
      item.sound.setVolume(
        this.volumeFor(item)
      );
    }
  }

  private spatialPan(
    worldX: number
  ): number {
    const camera =
      this.scene.cameras.main;

    const center =
      camera.worldView.centerX;

    return Phaser.Math.Clamp(
      (worldX - center) /
        Math.max(320, camera.width),
      -0.85,
      0.85
    );
  }

  private destroy(): void {
    for (const item of this.managed) {
      item.sound.stop();
      item.sound.destroy();
    }

    this.managed.clear();
    this.cooldowns.clear();
    this.voiceDepth = 0;
  }
}
