import type Phaser from "phaser";

export type AudioBus =
  | "master"
  | "music"
  | "ambience"
  | "sfx"
  | "voice";

export interface AudioAssetDefinition {
  readonly id: string;
  readonly category: string;
  readonly bus: Exclude<AudioBus, "master">;
  readonly loop: boolean;
  readonly aliasOf: string | null;
  readonly primaryUrl: string;
  readonly fallbackUrl: string;
}

export interface AudioBusSetting {
  volume: number;
  muted: boolean;
}

export type AudioSettingsState =
  Record<AudioBus, AudioBusSetting>;

export interface PlayAudioOptions {
  readonly gain?: number;
  readonly pan?: number;
  readonly detune?: number;
  readonly cooldownMs?: number;
  readonly maxInstances?: number;
  readonly positionX?: number;
}

export interface ManagedAudioHandle {
  readonly id: string;
  readonly sound: Phaser.Sound.BaseSound;
  setGain(gain: number): void;
  stop(): void;
}
