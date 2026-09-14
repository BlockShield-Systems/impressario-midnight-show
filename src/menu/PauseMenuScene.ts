import Phaser from "phaser";
import type { AudioBus } from "../audio/audio-types";
import type { AudioDirector } from "../audio/AudioDirector";
import { DisplayPreferences } from "./DisplayPreferences";
import "./pause-menu.css";

interface PauseMenuData {
  readonly audioDirector: AudioDirector;
  readonly resumeGameplay: () => void;
}

export class PauseMenuScene extends Phaser.Scene {
  private audioDirector!: AudioDirector;
  private resumeGameplay!: () => void;
  private displayPreferences!: DisplayPreferences;
  private panel!: HTMLElement;
  private displayButton!: HTMLButtonElement;
  private status!: HTMLElement;
  private listeners!: AbortController;
  private closing = false;
  private keyboardCloseEnabled = false;

  public constructor() {
    super("pause-menu");
  }

  public init(data: PauseMenuData): void {
    this.audioDirector = data.audioDirector;
    this.resumeGameplay = data.resumeGameplay;
  }

  public create(): void {
    this.closing = false;
    this.keyboardCloseEnabled = false;
    this.displayPreferences = new DisplayPreferences();
    this.displayPreferences.setFullscreen(this.scale.isFullscreen);
    this.listeners = new AbortController();

    this.add.graphics()
      .fillStyle(0x03040a, 0.78)
      .fillRect(0, 0, 640, 360)
      .setDepth(2000);

    this.createControls();

    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, this.onDisplayChange, this);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.onDisplayChange, this);
    this.input.keyboard?.on("keydown-P", this.handlePauseKey, this);
    this.input.keyboard?.on("keydown-ESC", this.handleEscape, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

    queueMicrotask(() => {
      this.keyboardCloseEnabled = true;
    });
  }

  private createControls(): void {
    const panel = document.createElement("section");
    panel.className = "pause-menu-panel";
    panel.setAttribute("aria-label", "Pause menu");
    panel.innerHTML = `
      <p class="pause-menu-eyebrow">THE PERFORMANCE WAITS</p>
      <h2>Paused</h2>
      <button type="button" class="pause-menu-resume">Resume</button>
      <button type="button" class="pause-menu-display" aria-pressed="false">Display mode: Windowed</button>
      <label class="pause-menu-volume">
        <span>Music volume</span>
        <input type="range" min="0" max="100" step="1" aria-label="Music volume">
        <output aria-label="Music volume value"></output>
      </label>
      <label class="pause-menu-volume">
        <span>SFX volume</span>
        <input type="range" min="0" max="100" step="1" aria-label="SFX volume">
        <output aria-label="SFX volume value"></output>
      </label>
      <p class="pause-menu-status" role="status" aria-live="polite"></p>
      <p class="pause-menu-hint">[P] Resume · [Esc] Close menu</p>
    `;

    this.panel = panel;
    this.displayButton = panel.querySelector<HTMLButtonElement>(".pause-menu-display")!;
    this.status = panel.querySelector<HTMLElement>(".pause-menu-status")!;
    const resume = panel.querySelector<HTMLButtonElement>(".pause-menu-resume")!;
    const options = { signal: this.listeners.signal };

    resume.addEventListener("click", this.close, options);
    this.displayButton.addEventListener("click", () => {
      void this.setFullscreen(!this.scale.isFullscreen);
    }, options);

    for (const [index, bus] of (["music", "sfx"] as const).entries()) {
      this.bindVolumeControl(panel, index, bus, options);
    }

    this.add.dom(320, 180, panel).setDepth(2100);
    this.refreshDisplay();
    resume.focus();
  }

  private bindVolumeControl(
    panel: HTMLElement,
    index: number,
    bus: Extract<AudioBus, "music" | "sfx">,
    options: AddEventListenerOptions
  ): void {
    const row = panel.querySelectorAll<HTMLElement>(".pause-menu-volume")[index]!;
    const slider = row.querySelector<HTMLInputElement>("input")!;
    const output = row.querySelector<HTMLOutputElement>("output")!;

    const renderValue = (): void => {
      const setting = this.audioDirector.settings.get(bus);
      slider.value = String(Math.round(setting.volume * 100));
      output.value = `${slider.value}%${setting.muted ? " (muted)" : ""}`;
    };

    renderValue();
    slider.addEventListener("input", () => {
      const requested = Number(slider.value) / 100;
      const current = this.audioDirector.settings.get(bus).volume;
      this.audioDirector.adjustBusVolume(bus, requested - current);
      renderValue();
    }, options);
  }

  private refreshDisplay(): void {
    const fullscreen = this.scale.isFullscreen;
    this.displayButton.textContent =
      `Display mode: ${fullscreen ? "Fullscreen" : "Windowed"}`;
    this.displayButton.setAttribute("aria-pressed", String(fullscreen));
    this.displayButton.disabled = !document.fullscreenEnabled;
    this.status.textContent = document.fullscreenEnabled
      ? ""
      : "Fullscreen is unavailable in this browser.";
  }

  private readonly onDisplayChange = (): void => {
    this.displayPreferences.setFullscreen(this.scale.isFullscreen);
    this.refreshDisplay();
  };

  private async setFullscreen(fullscreen: boolean): Promise<void> {
    if (!document.fullscreenEnabled) {
      this.refreshDisplay();
      return;
    }

    try {
      if (fullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      this.status.textContent =
        "Display mode could not be changed. Try again.";
    }
  }

  private readonly handlePauseKey = (): void => {
    if (this.keyboardCloseEnabled) {
      this.close();
    }
  };

  private readonly handleEscape = (): void => {
    if (!this.keyboardCloseEnabled || this.scale.isFullscreen) {
      return;
    }
    this.close();
  };

  private readonly close = (): void => {
    if (this.closing) {
      return;
    }

    this.closing = true;
    this.panel.inert = true;
    this.scene.stop();
    queueMicrotask(this.resumeGameplay);
  };

  private destroy(): void {
    this.listeners.abort();
    this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, this.onDisplayChange, this);
    this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.onDisplayChange, this);
    this.input.keyboard?.off("keydown-P", this.handlePauseKey, this);
    this.input.keyboard?.off("keydown-ESC", this.handleEscape, this);
  }
}
