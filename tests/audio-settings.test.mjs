import assert from "node:assert/strict";
import test from "node:test";

import {
  AudioSettings
} from "../src/audio/AudioSettings.ts";

const STORAGE_KEY =
  "impressario.audio-settings.v2";
const LEGACY_STORAGE_KEY =
  "impressario.audio-settings.v1";

function withStoredValue(
  value,
  legacyValue = null
) {
  const values = new Map();

  if (value !== null) {
    values.set(STORAGE_KEY, value);
  }

  if (legacyValue !== null) {
    values.set(
      LEGACY_STORAGE_KEY,
      legacyValue
    );
  }

  globalThis.localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, next) {
      values.set(key, next);
    }
  };

  return new AudioSettings();
}

test("clean audio settings use audible authored defaults", () => {
  const settings = withStoredValue(null);

  assert.equal(settings.getEffectiveVolume("master"), 1);
  assert.equal(settings.getEffectiveVolume("music"), 0.71);
  assert.equal(settings.getEffectiveVolume("ambience"), 0.4);
  assert.equal(settings.getEffectiveVolume("sfx"), 0.8);
  assert.equal(settings.getEffectiveVolume("voice"), 1);
});

test("corrupt persisted settings fall back to audible defaults", () => {
  const settings = withStoredValue("{not-json");

  assert.equal(settings.getEffectiveVolume("music"), 0.71);
  assert.equal(settings.getEffectiveVolume("voice"), 1);
});

test("legacy all-zero settings cannot silently mute the repaired runtime", () => {
  const settings = withStoredValue(
    null,
    JSON.stringify({
      master: {
        volume: 0,
        muted: true
      },
      music: {
        volume: 0,
        muted: true
      },
      ambience: {
        volume: 0,
        muted: true
      },
      sfx: {
        volume: 0,
        muted: true
      },
      voice: {
        volume: 0,
        muted: true
      }
    })
  );

  assert.equal(settings.getEffectiveVolume("master"), 1);
  assert.equal(settings.getEffectiveVolume("music"), 0.71);
  assert.equal(settings.getEffectiveVolume("sfx"), 0.8);
  assert.equal(settings.getEffectiveVolume("voice"), 1);
});

test("partial and obsolete settings cannot silently mute absent buses", () => {
  const settings = withStoredValue(JSON.stringify({
    music: {
      volume: 0.5,
      muted: false
    },
    obsolete: {
      volume: 0,
      muted: true
    }
  }));

  assert.equal(settings.getEffectiveVolume("music"), 0.5);
  assert.equal(settings.getEffectiveVolume("ambience"), 0.4);
  assert.equal(settings.getEffectiveVolume("sfx"), 0.8);
  assert.equal(settings.getEffectiveVolume("voice"), 1);
});

test("invalid and out-of-range gains are always finite and clamped", () => {
  const settings = withStoredValue(JSON.stringify({
    master: {
      volume: Number.NaN,
      muted: false
    },
    music: {
      volume: -4,
      muted: false
    },
    ambience: {
      volume: 9,
      muted: false
    },
    sfx: {
      volume: Number.POSITIVE_INFINITY,
      muted: false
    },
    voice: {
      volume: 0.5,
      muted: false
    }
  }).replace("null", "\"invalid\""));

  assert.equal(settings.get("master").volume, 1);
  assert.equal(settings.get("music").volume, 0);
  assert.equal(settings.get("ambience").volume, 1);
  assert.equal(settings.get("sfx").volume, 1);
  assert.equal(settings.get("voice").volume, 0.5);

  for (const bus of [
    "master",
    "music",
    "ambience",
    "sfx",
    "voice"
  ]) {
    const gain = settings.getEffectiveVolume(bus);
    assert.equal(Number.isFinite(gain), true);
    assert.ok(gain >= 0 && gain <= 1);
  }

  settings.setVolume("music", Number.NaN);
  settings.setVolume("ambience", -100);
  settings.setVolume("sfx", 100);

  assert.equal(settings.get("music").volume, 1);
  assert.equal(settings.get("ambience").volume, 0);
  assert.equal(settings.get("sfx").volume, 1);
});

test("explicit user mute and zero volume remain authoritative", () => {
  const settings = withStoredValue(JSON.stringify({
    master: {
      volume: 1,
      muted: false
    },
    music: {
      volume: 0,
      muted: false
    },
    voice: {
      volume: 1,
      muted: true
    }
  }));

  assert.equal(settings.getEffectiveVolume("music"), 0);
  assert.equal(settings.getEffectiveVolume("voice"), 0);
  assert.equal(settings.getEffectiveVolume("sfx"), 0.8);
});
