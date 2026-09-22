import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GAMEPAD_BUTTONS,
  GAMEPAD_DEADZONE,
  ROYAL_BOX_LOOK_DOWN_THRESHOLD,
  GamepadInputController,
  combinePressedIntent
} from "../src/runtime/GamepadInputController.ts";

function createHarness() {
  const state = {
    connected: true,
    axes: [0, 0],
    pressed: new Set()
  };

  const readGamepads = () => {
    if (!state.connected) {
      return [];
    }

    return [{
      axes: [...state.axes],
      buttons: Array.from(
        { length: 14 },
        (_, index) => ({
          pressed: state.pressed.has(index),
          touched: state.pressed.has(index),
          value: state.pressed.has(index) ? 1 : 0
        })
      )
    }];
  };

  return {
    state,
    controller: new GamepadInputController(readGamepads)
  };
}

function setPressed(state, ...indices) {
  state.pressed = new Set(indices);
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, {
    withFileTypes: true
  });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await sourceFiles(path));
    } else if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
}

test("the Standard Gamepad action map preserves existing controls and adds four actions", () => {
  assert.deepEqual(GAMEPAD_BUTTONS, {
    jump: 0,
    dash: 1,
    melee: 2,
    grandCard: 3,
    spotlight: 5,
    dashTrigger: 7,
    pause: 9,
    down: 13
  });
});

test("each new gamepad action produces one edge per press instead of repeating while held", () => {
  for (const [action, button] of [
    ["melee", GAMEPAD_BUTTONS.melee],
    ["grandCard", GAMEPAD_BUTTONS.grandCard],
    ["spotlight", GAMEPAD_BUTTONS.spotlight],
    ["pause", GAMEPAD_BUTTONS.pause]
  ]) {
    const { state, controller } = createHarness();

    setPressed(state, button);
    controller.update("gameplay");
    assert.equal(controller.consume(action), true, action);

    controller.update("gameplay");
    assert.equal(controller.consume(action), false, action);

    controller.update("gameplay");
    assert.equal(controller.consume(action), false, action);

    setPressed(state);
    controller.update("gameplay");
    setPressed(state, button);
    controller.update("gameplay");
    assert.equal(controller.consume(action), true, action);
  }
});

test("centralized melee preserves its former button-2 rising-edge behavior", () => {
  const { state, controller } = createHarness();

  setPressed(state, GAMEPAD_BUTTONS.melee);
  controller.update("gameplay");
  assert.equal(controller.consumeGamepadAction("melee"), true);

  for (let frame = 0; frame < 8; frame += 1) {
    controller.update("gameplay");
    assert.equal(
      controller.consumeGamepadAction("melee"),
      false
    );
  }
});

test("suppress-until-neutral blocks all four new action edges", () => {
  const { state, controller } = createHarness();
  const buttons = [
    GAMEPAD_BUTTONS.melee,
    GAMEPAD_BUTTONS.grandCard,
    GAMEPAD_BUTTONS.spotlight,
    GAMEPAD_BUTTONS.pause
  ];

  setPressed(state, ...buttons);
  controller.suppressUntilNeutral();
  controller.update("gameplay");

  for (const action of [
    "melee",
    "grandCard",
    "spotlight",
    "pause"
  ]) {
    assert.equal(controller.consume(action), false, action);
  }

  setPressed(state);
  controller.update("gameplay");
  assert.equal(controller.isSuppressedUntilNeutral, false);

  setPressed(state, ...buttons);
  controller.update("gameplay");

  for (const action of [
    "melee",
    "grandCard",
    "spotlight",
    "pause"
  ]) {
    assert.equal(controller.consume(action), true, action);
  }
});

test("movement and down axes keep the existing deadzones", () => {
  const { state, controller } = createHarness();

  state.axes = [GAMEPAD_DEADZONE - 0.001, GAMEPAD_DEADZONE];
  controller.update("gameplay");
  assert.equal(controller.moveX, 0);
  assert.equal(controller.downHeld, false);

  state.axes = [GAMEPAD_DEADZONE, GAMEPAD_DEADZONE + 0.001];
  controller.update("gameplay");
  assert.equal(controller.moveX, GAMEPAD_DEADZONE);
  assert.equal(controller.downHeld, true);

  state.axes = [0, ROYAL_BOX_LOOK_DOWN_THRESHOLD];
  controller.update("gameplay");
  assert.equal(controller.gamepadLookDownHeld, false);

  state.axes = [0, ROYAL_BOX_LOOK_DOWN_THRESHOLD + 0.001];
  controller.update("gameplay");
  assert.equal(controller.gamepadLookDownHeld, true);
});

test("keyboard presses remain independent of neutral or active gamepad state", () => {
  const { state, controller } = createHarness();

  controller.update("gameplay");
  assert.equal(combinePressedIntent(true, false), true);
  assert.equal(controller.consume("melee"), false);

  setPressed(state, GAMEPAD_BUTTONS.grandCard);
  controller.update("gameplay");
  assert.equal(
    combinePressedIntent(
      true,
      controller.consume("grandCard")
    ),
    true
  );
  assert.equal(controller.consume("grandCard"), false);
});

test("an absent gamepad changes no continuous or keyboard intent", () => {
  const { state, controller } = createHarness();
  state.connected = false;

  controller.suppressUntilNeutral();
  controller.update("gameplay");

  assert.equal(controller.isSuppressedUntilNeutral, false);
  assert.equal(controller.moveX, 0);
  assert.equal(controller.downHeld, false);
  assert.equal(controller.jumpHeld, false);
  assert.equal(controller.consume("pause"), false);
  assert.equal(combinePressedIntent(true, false), true);
});

test("button 9 opens pause from one gameplay edge", () => {
  const { state, controller } = createHarness();

  setPressed(state, GAMEPAD_BUTTONS.pause);
  controller.update("gameplay");
  assert.equal(controller.consume("pause"), true);
  assert.equal(controller.consume("pause"), false);
});

test("button 9 closes pause only after release and a fresh press", () => {
  const { state, controller } = createHarness();

  setPressed(state, GAMEPAD_BUTTONS.pause);
  controller.update("gameplay");
  assert.equal(controller.consume("pause"), true);
  controller.suppressUntilNeutral();

  controller.update("pause-menu");
  assert.equal(controller.consume("pause"), false);

  setPressed(state);
  controller.update("pause-menu");
  assert.equal(controller.consume("pause"), false);

  setPressed(state, GAMEPAD_BUTTONS.pause);
  controller.update("pause-menu");
  assert.equal(controller.consume("pause"), true);
});

test("a held pause button cannot open and immediately close the menu", () => {
  const { state, controller } = createHarness();
  let toggles = 0;

  setPressed(state, GAMEPAD_BUTTONS.pause);
  controller.update("gameplay");
  if (controller.consume("pause")) {
    toggles += 1;
    controller.suppressUntilNeutral();
  }

  for (let frame = 0; frame < 12; frame += 1) {
    controller.update("pause-menu");
    if (controller.consume("pause")) {
      toggles += 1;
    }
  }

  assert.equal(toggles, 1);
});

test("resume suppression prevents held new buttons from leaking into gameplay", () => {
  const { state, controller } = createHarness();
  const buttons = [
    GAMEPAD_BUTTONS.melee,
    GAMEPAD_BUTTONS.grandCard,
    GAMEPAD_BUTTONS.spotlight,
    GAMEPAD_BUTTONS.pause
  ];

  setPressed(state, ...buttons);
  controller.suppressUntilNeutral();

  for (let frame = 0; frame < 5; frame += 1) {
    controller.update("gameplay");

    for (const action of [
      "melee",
      "grandCard",
      "spotlight",
      "pause"
    ]) {
      assert.equal(controller.consume(action), false, action);
    }
  }
});

test("production source has one navigator gamepad poll site", async () => {
  const files = await sourceFiles(
    fileURLToPath(new URL("../src", import.meta.url))
  );
  const matches = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");

    if (source.includes("navigator.getGamepads")) {
      matches.push(file);
    }
  }

  assert.equal(matches.length, 1);
  assert.match(matches[0], /GamepadInputController\.ts$/);
});
