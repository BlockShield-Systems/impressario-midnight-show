import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { AudioSettings } from "../src/audio/AudioSettings.ts";
import { DisplayPreferences } from "../src/menu/DisplayPreferences.ts";

const AUDIO_KEY = "impressario.audio-settings.v2";
const DISPLAY_KEY = "impressario.display-settings.v1";
const source = await readFile(
  new URL("../src/menu/MainMenuScene.ts", import.meta.url), "utf8"
);
const pauseSource = await readFile(
  new URL("../src/menu/PauseMenuScene.ts", import.meta.url), "utf8"
);

function storage(t, entries = []) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map(entries);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    }
  });
  t.after(() => {
    if (previous) {
      Object.defineProperty(globalThis, "localStorage", previous);
    } else {
      delete globalThis.localStorage;
    }
  });
  return values;
}

test("menu display preferences round-trip without rewriting audio v2", t => {
  const audio = JSON.stringify({ music: { volume: 0.32, muted: true } });
  const values = storage(t, [[AUDIO_KEY, audio]]);
  const display = new DisplayPreferences();
  assert.equal(display.getFullscreen(), false);
  display.setFullscreen(true);
  assert.equal(new DisplayPreferences().getFullscreen(), true);
  assert.equal(values.get(AUDIO_KEY), audio);
  display.setFullscreen(false);
  assert.equal(new DisplayPreferences().getFullscreen(), false);
  assert.equal(values.get(AUDIO_KEY), audio);
});

test("menu display preferences reject corrupt and non-boolean values", t => {
  const values = storage(t);
  for (const payload of ["{bad-json", "null", "[]", "false", '{"fullscreen":"true"}', '{"fullscreen":1}']) {
    values.set(DISPLAY_KEY, payload);
    assert.equal(new DisplayPreferences().getFullscreen(), false, payload);
  }
});

test("menu display preferences remain usable when browser storage is blocked", t => {
  storage(t);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { throw new Error("Storage denied"); }
  });
  const display = new DisplayPreferences();
  assert.equal(display.getFullscreen(), false);
  assert.doesNotThrow(() => display.setFullscreen(true));
  assert.equal(display.getFullscreen(), true);
});

test("menu exposes claim verification without changing existing button order", () => {
  assert.match(
    source,
    /main-menu-start[\s\S]*main-menu-settings[\s\S]*main-menu-verify/
  );
  assert.match(source, />Verify Claim Code<\/button>/);
  assert.match(source, /history\.replaceState\(/);
  assert.match(source, /url\.searchParams\.delete\("verify"\)/);
});

test("menu volume writes use existing audio persistence and preserve mute/other buses", t => {
  const values = storage(t);
  const settings = new AudioSettings();
  settings.setMuted("music", true);
  settings.setVolume("ambience", 0.23);
  settings.setVolume("music", 0.33);
  settings.setVolume("sfx", 0);
  const reloaded = new AudioSettings();
  assert.deepEqual(reloaded.get("music"), { volume: 0.33, muted: true });
  assert.deepEqual(reloaded.get("sfx"), { volume: 0, muted: false });
  assert.equal(reloaded.get("ambience").volume, 0.23);
  assert.equal(reloaded.get("voice").volume, 1);
  assert.deepEqual([...values.keys()], [AUDIO_KEY]);
  assert.match(source, /this\.audioSettings\.setVolume\(bus, Number\(slider\.value\) \/ 100\)/);
  assert.doesNotMatch(source, /localStorage|audio-settings\.v[12]/);
});

// Execute the real scene's transition methods with only Phaser/DOM boundaries
// replaced. Native control interactions are covered in main-menu.spec.ts.
function sceneHarness({ fullscreen = false, bootError = false } = {}) {
  const calls = [];
  let begin;
  class WebAudioSoundManager {
    context = { resume: () => { calls.push("resume"); return Promise.resolve(); } };
  }
  const Phaser = { Scene: class {}, Sound: { WebAudioSoundManager } };
  const leaderboard = {
    boot(callback) {
      calls.push("boot");
      begin = callback;
      return bootError ? Promise.reject(new Error("Unavailable")) : Promise.resolve();
    }
  };
  const Scene = runInNewContext(
    stripTypeScriptTypes(source)
      .replace(/^import .*;\n/gm, "")
      .replace("export class MainMenuScene", "class MainMenuScene") + "\nMainMenuScene;",
    { Phaser, AudioSettings, DisplayPreferences, leaderboard }
  );
  const scene = new Scene();
  Object.assign(scene, {
    displayPreferences: { getFullscreen: () => fullscreen },
    panel: { inert: false },
    status: { textContent: "" },
    scale: { isFullscreen: false },
    sound: new WebAudioSoundManager(),
    scene: { start: key => calls.push(key) },
    setFullscreen: async value => calls.push(`fullscreen:${value}`)
  });
  return { scene, calls, begin: () => begin() };
}

test("menu defers identity/Turnstile until Start Game and gameplay until confirmation", () => {
  const { scene, calls, begin } = sceneHarness();
  assert.deepEqual(calls, []);
  scene.startGame();
  scene.startGame();
  assert.equal(scene.panel.inert, true);
  assert.deepEqual(calls, ["boot"], "repeat Start must not create a second overlay/run");
  begin();
  assert.deepEqual(calls, ["boot", "resume", "game"]);
});

test("menu restores saved fullscreen only from the Start Game gesture", () => {
  const { scene, calls } = sceneHarness({ fullscreen: true });
  assert.deepEqual(calls, []);
  scene.startGame();
  assert.deepEqual(calls, ["fullscreen:true", "boot"]);
});

test("menu reports startup rejection rather than leaving an unhandled promise", async () => {
  const { scene, calls } = sceneHarness({ bootError: true });
  scene.startGame();
  await Promise.resolve();
  assert.deepEqual(calls, ["boot"]);
  assert.match(scene.status.textContent, /Unable to open the start screen/);
});

test("pause menu reuses persisted settings without duplicating storage schemas", () => {
  assert.match(
    pauseSource,
    /this\.audioDirector\.settings\.get\(bus\)/
  );
  assert.match(
    pauseSource,
    /this\.audioDirector\.adjustBusVolume\(/
  );
  assert.match(
    pauseSource,
    /new DisplayPreferences\(\)/
  );
  assert.doesNotMatch(
    pauseSource,
    /localStorage|audio-settings\.v2|display-settings\.v1/
  );
});

test("production bootstrap has one menu-first scene list and no startup bypass", async () => {
  const main = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
  assert.match(
    main,
    /scene:\s*\[\s*MainMenuScene,\s*GameScene,\s*PauseMenuScene\s*\]/
  );
  assert.equal((main.match(/new Phaser\.Game\(/g) ?? []).length, 1);
  assert.doesNotMatch(main, /leaderboard\.boot/);
  assert.doesNotMatch(source, /QA_RUNTIME|VITE_QA|qaMainMenu|URLSearchParams/);
});
