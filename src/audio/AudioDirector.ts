import Phaser from "phaser";

import {
  AUDIO_ASSET_BY_ID,
  AUDIO_ASSETS
} from "./AudioManifest";

import { AudioSettings } from "./AudioSettings";

import {
  BOOTSTRAP_AUDIO_IDS
} from "./AudioLoadPlan";

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

interface WebAudioManagerSnapshotSource {
  readonly context?: AudioContext;
  readonly locked?: boolean;
  readonly masterVolumeNode?: GainNode;
}

const AUDIO_BUSES: readonly AudioBus[] = [
  "master",
  "music",
  "ambience",
  "sfx",
  "voice"
];

const KEY_PREFIX = "audio:";

const LOAD_ERROR_EVENT = "loaderror";
const LOAD_COMPLETE_EVENT = "complete";

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
  private analyser: AnalyserNode | null = null;
  private analyserSamples:
    Float32Array<ArrayBuffer> | null = null;
  private observedRms = 0;
  private observedPeak = 0;
  private readonly startedCounts =
    new Map<AudioAssetId, number>();
  private readonly completedCounts =
    new Map<AudioAssetId, number>();
  private readonly stoppedCounts =
    new Map<AudioAssetId, number>();

  public static preload(
    scene: Phaser.Scene
  ): void {
    const owners = new Set<AudioAssetId>();

    for (const id of BOOTSTRAP_AUDIO_IDS) {
      owners.add(ownerId(id));
    }

    for (const owner of owners) {
      const asset =
        AUDIO_ASSET_BY_ID.get(owner);

      if (!asset) {
        throw new Error(
          `Missing bootstrap audio asset: ${owner}`
        );
      }

      scene.load.audio(
        `${KEY_PREFIX}${owner}`,
        [
          asset.primaryUrl,
          asset.fallbackUrl
        ]
      );
    }
  }

  private loadQueue:
    Promise<void> =
      Promise.resolve();

  private loadingOwnerCount = 0;
  private lastLoadError:
    string | null = null;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly preparedContext?: AudioContext,
    qaInspectionEnabled = false
  ) {
    scene.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      () => this.destroy()
    );

    window.addEventListener(
      "pointerdown",
      this.unlockAudio,
      {
        passive: true
      }
    );

    window.addEventListener(
      "keydown",
      this.unlockAudio
    );

    if (qaInspectionEnabled) {
      this.attachAnalyser();
    }

    void this.resumeAudioContext();
  }

  public preload(
    ids: readonly AudioAssetId[]
  ): Promise<void> {
    const owners =
      [...new Set(
        ids.map(id => ownerId(id))
      )];

    const task =
      this.loadQueue
        .catch(() => undefined)
        .then(
          () => this.loadOwners(owners)
        );

    this.loadQueue = task;
    return task;
  }

  public getDebugSnapshot() {
    const owners =
      new Set(
        AUDIO_ASSETS.map(
          asset =>
            ownerId(
              asset.id as AudioAssetId
            )
        )
      );

    let cachedOwners = 0;

    for (const owner of owners) {
      if (
        this.scene.cache.audio.exists(
          `${KEY_PREFIX}${owner}`
        )
      ) {
        cachedOwners += 1;
      }
    }

    const context =
      this.getAudioContext();

    const activeHandles =
      [...this.managed].map(item => {
        const sound = item.sound as
          VolumeControllableSound & {
            readonly seek?: number;
            readonly duration?: number;
            readonly isPlaying?: boolean;
            readonly volume?: number;
          };

        return {
          logicalKey: item.id,
          bus: item.bus,
          gain: item.gain,
          effectiveGain:
            this.volumeFor(item),
          playbackPosition:
            sound.seek ?? 0,
          duration:
            sound.duration ?? 0,
          isPlaying:
            sound.isPlaying ?? false
        };
      });

    const duplicateInstanceCounts =
      Object.fromEntries(
        [...new Set(
          activeHandles.map(
            item => item.logicalKey
          )
        )].map(id => [
          id,
          activeHandles.filter(
            item =>
              item.logicalKey === id
          ).length
        ])
      );

    const busStates = Object.fromEntries(
      AUDIO_BUSES.map(bus => {
        const setting =
          this.settings.get(bus);

        return [
          bus,
          {
            muted: setting.muted,
            configuredGain:
              setting.volume,
            effectiveGain:
              this.settings
                .getEffectiveVolume(bus)
          }
        ];
      })
    );

    const analyser = {
      ...this.measureAnalyser(),
      observedRms: this.observedRms,
      observedPeak: this.observedPeak
    };

    const currentDialogue =
      activeHandles.findLast(
        item => item.bus === "voice"
      )?.logicalKey ?? null;

    const manager =
      this.scene.sound as
        Phaser.Sound.BaseSoundManager &
        WebAudioManagerSnapshotSource;

    return {
      activeSounds:
        this.managed.size,
      activeLoops:
        [...this.managed].filter(
          item =>
            AUDIO_ASSET_BY_ID
              .get(item.id)
              ?.loop === true
        ).length,
      activeHandles,
      duplicateInstanceCounts,
      playbackHistory: {
        started: Object.fromEntries(
          this.startedCounts
        ),
        completed: Object.fromEntries(
          this.completedCounts
        ),
        stopped: Object.fromEntries(
          this.stoppedCounts
        )
      },
      busStates,
      currentDialogue,
      loadingOwners:
        this.loadingOwnerCount,
      cachedOwners,
      totalOwners:
        owners.size,
      contextState:
        context?.state ?? "html5",
      preparedContextInUse:
        context !== undefined &&
        context === this.preparedContext,
      soundManagerLocked:
        manager.locked ?? false,
      analyser,
      lastLoadError:
        this.lastLoadError
    };
  }

  public toggleBusMuted(
    bus: AudioBus
  ): void {
    const current =
      this.settings.get(bus);

    this.settings.setMuted(
      bus,
      !current.muted
    );

    this.refreshVolumes();
  }

  public adjustBusVolume(
    bus: AudioBus,
    delta: number
  ): void {
    const current =
      this.settings.get(bus);

    this.settings.setVolume(
      bus,
      current.volume + delta
    );

    this.refreshVolumes();
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
    this.observeAnalyser();
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
      this.stopManaged(existing[0]!);
    }

    const owner = ownerId(id);
    const key = `${KEY_PREFIX}${owner}`;

    if (
      !this.scene.cache.audio.exists(key)
    ) {
      console.warn(
        `[audio] Asset not loaded yet: ${id}`
      );

      return null;
    }

    const sound =
      this.scene.sound.add(
        key
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
    this.incrementCount(
      this.startedCounts,
      id
    );

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

    let cleaned = false;

    const cleanup = (
      outcome: "complete" | "stop"
    ): void => {
      if (cleaned) {
        return;
      }

      cleaned = true;
      this.managed.delete(managed);
      sound.destroy();
      this.incrementCount(
        outcome === "complete"
          ? this.completedCounts
          : this.stoppedCounts,
        id
      );

      if (asset.bus === "voice") {
        this.voiceDepth = Math.max(
          0,
          this.voiceDepth - 1
        );
      }
    };

    sound.once(
      "complete",
      () => cleanup("complete")
    );
    sound.once(
      "stop",
      () => cleanup("stop")
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
        cleanup("stop");
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

      this.stopManaged(item);
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

  private async loadOwners(
    owners: readonly AudioAssetId[]
  ): Promise<void> {
    const missing =
      owners.filter(
        owner =>
          !this.scene.cache.audio.exists(
            `${KEY_PREFIX}${owner}`
          )
      );

    if (missing.length === 0) {
      return;
    }

    this.loadingOwnerCount =
      missing.length;

    this.lastLoadError = null;

    await new Promise<void>(
      (resolve, reject) => {
        const failed: string[] = [];

        const onLoadError = (
          file: {
            readonly key?: string;
          }
        ): void => {
          failed.push(
            file.key ?? "unknown"
          );
        };

        const onComplete = (): void => {
          this.scene.load.off(
            LOAD_ERROR_EVENT,
            onLoadError
          );

          this.loadingOwnerCount = 0;

          if (failed.length > 0) {
            this.lastLoadError =
              failed.join(", ");

            reject(
              new Error(
                `Audio loading failed: ${
                  failed.join(", ")
                }`
              )
            );

            return;
          }

          resolve();
        };

        this.scene.load.on(
          LOAD_ERROR_EVENT,
          onLoadError
        );

        this.scene.load.once(
          LOAD_COMPLETE_EVENT,
          onComplete
        );

        for (const owner of missing) {
          const asset =
            AUDIO_ASSET_BY_ID.get(owner);

          if (!asset) {
            failed.push(owner);
            continue;
          }

          this.scene.load.audio(
            `${KEY_PREFIX}${owner}`,
            [
              asset.primaryUrl,
              asset.fallbackUrl
            ]
          );
        }

        this.scene.load.start();
      }
    );
  }

  private incrementCount(
    counts: Map<AudioAssetId, number>,
    id: AudioAssetId
  ): void {
    counts.set(
      id,
      (counts.get(id) ?? 0) + 1
    );
  }

  private stopManaged(
    item: ManagedSound
  ): void {
    item.sound.stop();

    if (this.managed.has(item)) {
      item.sound.destroy();
      this.managed.delete(item);

      if (item.bus === "voice") {
        this.voiceDepth = Math.max(
          0,
          this.voiceDepth - 1
        );
      }
    }
  }

  private attachAnalyser(): void {
    const manager =
      this.scene.sound as
        Phaser.Sound.BaseSoundManager &
        WebAudioManagerSnapshotSource;
    const context = manager.context;
    const masterVolumeNode =
      manager.masterVolumeNode;

    if (!context || !masterVolumeNode) {
      return;
    }

    this.analyser =
      context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.analyserSamples =
      new Float32Array(
        new ArrayBuffer(
          this.analyser.fftSize *
          Float32Array.BYTES_PER_ELEMENT
        )
      );
    masterVolumeNode.connect(this.analyser);
  }

  private observeAnalyser(): void {
    const sample =
      this.measureAnalyser();

    this.observedRms = Math.max(
      this.observedRms,
      sample.rms
    );
    this.observedPeak = Math.max(
      this.observedPeak,
      sample.peak
    );
  }

  private measureAnalyser(): {
    readonly rms: number;
    readonly peak: number;
  } {
    if (!this.analyser || !this.analyserSamples) {
      return {
        rms: 0,
        peak: 0
      };
    }

    this.analyser.getFloatTimeDomainData(
      this.analyserSamples
    );

    let squares = 0;
    let peak = 0;

    for (const sample of this.analyserSamples) {
      squares += sample * sample;
      peak = Math.max(
        peak,
        Math.abs(sample)
      );
    }

    return {
      rms: Math.sqrt(
        squares /
        this.analyserSamples.length
      ),
      peak
    };
  }

  private getAudioContext():
    AudioContext | undefined {
    const manager =
      this.scene.sound as
        Phaser.Sound.BaseSoundManager & {
          context?: AudioContext;
        };

    return manager.context;
  }

  private async resumeAudioContext():
    Promise<void> {
    const context =
      this.getAudioContext();

    if (
      context &&
      context.state === "suspended"
    ) {
      try {
        await context.resume();
      } catch {
        // A later user gesture retries the unlock.
      }
    }
  }

  private readonly unlockAudio =
    (): void => {
      void this.resumeAudioContext();
    };

  private destroy(): void {
    window.removeEventListener(
      "pointerdown",
      this.unlockAudio
    );

    window.removeEventListener(
      "keydown",
      this.unlockAudio
    );

    for (const item of [...this.managed]) {
      this.stopManaged(item);
    }

    this.analyser?.disconnect();
    this.analyser = null;
    this.analyserSamples = null;
    this.observedRms = 0;
    this.observedPeak = 0;
    this.managed.clear();
    this.cooldowns.clear();
    this.startedCounts.clear();
    this.completedCounts.clear();
    this.stoppedCounts.clear();
    this.voiceDepth = 0;
  }
}
