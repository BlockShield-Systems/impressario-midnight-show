import {
  AUDIO_ASSET_BY_ID,
  AUDIO_ASSET_IDS
} from "./AudioManifest";

import type {
  AudioAssetId
} from "./AudioManifest";

import type {
  AudioDirector
} from "./AudioDirector";

import type {
  MusicDirector
} from "./MusicDirector";

import {
  SECTION_AUDIO_ASSIGNMENTS
} from "./AudioRuntimeBridge";

const BOSS_AND_FINALE_THEMES:
readonly AudioAssetId[] = [
  "music_11_conductor_phase_2",
  "music_12_conductor_phase_3",
  "music_13_finale"
];

function audioIdFromQuery(
  name: string
): AudioAssetId | null {
  const value =
    new URLSearchParams(
      window.location.search
    ).get(name);

  return value && AUDIO_ASSET_IDS.has(value)
    ? value as AudioAssetId
    : null;
}

export function runQaAudioCatalogHarness(
  audio: AudioDirector,
  music: MusicDirector
): void {
  const audioId =
    audioIdFromQuery("qaAudio");
  const themeId =
    audioIdFromQuery("qaTheme");
  const sequenceEnabled =
    new URLSearchParams(
      window.location.search
    ).get("qaThemeSequence") === "1";

  if (!audioId && !themeId && !sequenceEnabled) {
    return;
  }

  if (audioId) {
    void audio.preload([audioId])
      .then(() => {
        audio.play(audioId, {
          gain: 1,
          maxInstances: 1
        });
      });
  }

  if (themeId) {
    const definition =
      AUDIO_ASSET_BY_ID.get(themeId);

    if (definition?.bus === "music") {
      void audio.preload([themeId])
        .then(() => {
          music.setMusic(themeId, 0);
        });
    }
  }

  if (sequenceEnabled) {
    const sequence = [
      ...SECTION_AUDIO_ASSIGNMENTS.map(
        assignment => assignment.music
      ),
      ...BOSS_AND_FINALE_THEMES
    ];
    const uniqueIds = [...new Set(sequence)];

    void audio.preload(uniqueIds)
      .then(() => {
        for (const id of sequence) {
          music.setMusic(id, 0);
        }
      });
  }
}
