import assert from "node:assert/strict";
import test from "node:test";

import {
  AudioSettings
} from "../src/audio/AudioSettings.ts";

const STORAGE_KEY =
  "impressario.audio-settings.v1";

function withStoredValue(value) {
  const values = new Map();

  if (value !== null) {
    values.set(STORAGE_KEY, value);
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
