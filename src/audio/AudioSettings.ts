import type {
  AudioBus,
  AudioBusSetting,
  AudioSettingsState
} from "./audio-types";

const STORAGE_KEY =
  "impressario.audio-settings.v2";

const DEFAULT_SETTINGS: AudioSettingsState = {
  master: {
    volume: 1,
    muted: false
  },
  music: {
    volume: 0.71,
    muted: false
  },
  ambience: {
    volume: 0.4,
    muted: false
  },
  sfx: {
    volume: 0.8,
    muted: false
  },
  voice: {
    volume: 1,
    muted: false
  }
};

function clampVolume(value: unknown): number {
  return typeof value === "number" &&
    Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : 1;
}

export class AudioSettings {
  private readonly state:
    AudioSettingsState;

  public constructor() {
    this.state =
      structuredClone(DEFAULT_SETTINGS);

    try {
      const stored =
        localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return;
      }

      const parsed =
        JSON.parse(stored) as
          Partial<AudioSettingsState>;

      for (
        const bus of Object.keys(
          DEFAULT_SETTINGS
        ) as AudioBus[]
      ) {
        const candidate = parsed[bus];

        if (!candidate) {
          continue;
        }

        this.state[bus] = {
          volume:
            clampVolume(candidate.volume),
          muted:
            candidate.muted === true
        };
      }
    } catch {
      // Corrupt or unavailable storage falls back safely.
    }
  }

  public get(bus: AudioBus): AudioBusSetting {
    return {
      ...this.state[bus]
    };
  }

  public getEffectiveVolume(
    bus: AudioBus
  ): number {
    const master = this.state.master;
    const target = this.state[bus];

    if (
      master.muted ||
      target.muted
    ) {
      return 0;
    }

    if (bus === "master") {
      return master.volume;
    }

    return master.volume *
      target.volume;
  }

  public setVolume(
    bus: AudioBus,
    volume: number
  ): void {
    this.state[bus].volume =
      clampVolume(volume);

    this.persist();
  }

  public setMuted(
    bus: AudioBus,
    muted: boolean
  ): void {
    this.state[bus].muted = muted;
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.state)
      );
    } catch {
      // Audio must remain functional without storage.
    }
  }
}
