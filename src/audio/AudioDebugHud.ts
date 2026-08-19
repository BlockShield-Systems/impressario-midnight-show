import Phaser from "phaser";

import type {
  AudioDirector
} from "./AudioDirector";

import type {
  AudioBus
} from "./audio-types";

const DISPLAY_BUSES:
readonly AudioBus[] = [
  "master",
  "music",
  "ambience",
  "sfx",
  "voice"
];

export class AudioDebugHud {
  private readonly text:
    Phaser.GameObjects.Text;

  private visible = false;
  private refreshTimer = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioDirector
  ) {
    this.text = scene.add.text(
      632,
      8,
      "",
      {
        align: "left",
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#dffaff",
        backgroundColor: "#02060ddd",
        padding: {
          x: 7,
          y: 6
        }
      }
    );

    this.text
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(5000)
      .setVisible(false);

    scene.input.keyboard?.on(
      "keydown",
      this.onKeyDown
    );

    scene.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      this.destroy,
      this
    );
  }

  public update(
    deltaSeconds: number
  ): void {
    if (!this.visible) {
      return;
    }

    this.refreshTimer -=
      deltaSeconds;

    if (this.refreshTimer > 0) {
      return;
    }

    this.refreshTimer = 0.2;
    this.redraw();
  }

  private redraw(): void {
    const runtime =
      this.audio.getDebugSnapshot();

    const lines = [
      "AUDIO — F8 HIDE",
      `CTX ${runtime.contextState.toUpperCase()}`,
      `CACHE ${runtime.cachedOwners}/${runtime.totalOwners}`,
      `LOADING ${runtime.loadingOwners}`,
      `ACTIVE ${runtime.activeSounds}`,
      `LOOPS ${runtime.activeLoops}`,
      ""
    ];

    for (const bus of DISPLAY_BUSES) {
      const setting =
        this.audio.settings.get(bus);

      lines.push(
        `${bus.toUpperCase().padEnd(8)} ` +
        `${Math.round(
          setting.volume * 100
        ).toString().padStart(3)}% ` +
        `${setting.muted ? "MUTE" : "ON"}`
      );
    }

    lines.push(
      "",
      "[ / ] MASTER VOLUME",
      "F9 MASTER MUTE",
      "SHIFT+M MUSIC",
      "SHIFT+A AMBIENCE",
      "SHIFT+S SFX",
      "SHIFT+V VOICE"
    );

    if (runtime.lastLoadError) {
      lines.push(
        "",
        `LOAD ERROR: ${
          runtime.lastLoadError
        }`
      );
    }

    this.text.setText(lines);
  }

  private readonly onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.code === "F8") {
      event.preventDefault();

      this.visible =
        !this.visible;

      this.text.setVisible(
        this.visible
      );

      if (this.visible) {
        this.refreshTimer = 0;
        this.redraw();
      }

      return;
    }

    if (event.code === "F9") {
      event.preventDefault();

      this.audio.toggleBusMuted(
        "master"
      );

      this.redraw();
      return;
    }

    if (
      event.code === "BracketLeft"
    ) {
      this.audio.adjustBusVolume(
        "master",
        -0.05
      );

      this.redraw();
      return;
    }

    if (
      event.code === "BracketRight"
    ) {
      this.audio.adjustBusVolume(
        "master",
        0.05
      );

      this.redraw();
      return;
    }

    if (!event.shiftKey) {
      return;
    }

    const bus =
      event.code === "KeyM"
        ? "music"
        : event.code === "KeyA"
          ? "ambience"
          : event.code === "KeyS"
            ? "sfx"
            : event.code === "KeyV"
              ? "voice"
              : null;

    if (!bus) {
      return;
    }

    event.preventDefault();
    this.audio.toggleBusMuted(bus);
    this.redraw();
  };

  private destroy(): void {
    this.scene.input.keyboard?.off(
      "keydown",
      this.onKeyDown
    );

    this.text.destroy();
  }
}
