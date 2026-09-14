import Phaser from "phaser";
import { AudioSettings } from "../audio/AudioSettings";
import { leaderboard } from "../leaderboard/LeaderboardClient";
import { DisplayPreferences } from "./DisplayPreferences";
import "./main-menu.css";

/** The only entry scene: no world, audio assets, or ranked run starts here. */
export class MainMenuScene extends Phaser.Scene {
  private audioSettings!: AudioSettings;
  private displayPreferences!: DisplayPreferences;
  private panel!: HTMLElement;
  private home!: HTMLElement;
  private settingsPanel!: HTMLElement;
  private displayButton!: HTMLButtonElement;
  private status!: HTMLElement;
  private listeners!: AbortController;
  private starting = false;

  public constructor() {
    super("main-menu");
  }

  public create(): void {
    this.starting = false;
    this.audioSettings = new AudioSettings();
    this.displayPreferences = new DisplayPreferences();
    this.listeners = new AbortController();
    this.cameras.main.setBackgroundColor("#0b0710");
    this.createBackdrop();
    this.createControls();

    this.scale.on(
      Phaser.Scale.Events.ENTER_FULLSCREEN,
      this.onDisplayChange,
      this
    );
    this.scale.on(
      Phaser.Scale.Events.LEAVE_FULLSCREEN,
      this.onDisplayChange,
      this
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.listeners.abort();
      this.scale.off(
        Phaser.Scale.Events.ENTER_FULLSCREEN,
        this.onDisplayChange,
        this
      );
      this.scale.off(
        Phaser.Scale.Events.LEAVE_FULLSCREEN,
        this.onDisplayChange,
        this
      );
      // Phaser destroys the scene-owned DOMElement and its controls.
    });
  }

  private createBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x250b17);
    graphics.fillRect(0, 0, 58, 360);
    graphics.fillRect(582, 0, 58, 360);
    graphics.lineStyle(1, 0xc8923d, 0.65);
    graphics.strokeRect(24, 18, 592, 324);
    graphics.lineBetween(170, 104, 470, 104);
    for (const x of [14, 34, 54, 586, 606, 626]) {
      graphics.lineBetween(x, 0, x, 360);
    }

    this.add.text(320, 48, "IMPRESSARIO", {
      fontFamily: "monospace",
      fontSize: "32px",
      color: "#ffe183"
    }).setOrigin(0.5);
    this.add.text(320, 82, "THE MIDNIGHT SHOW", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#78e7eb"
    }).setOrigin(0.5);
  }

  private createControls(): void {
    const panel = document.createElement("section");
    panel.className = "main-menu-panel";
    panel.setAttribute("aria-label", "Main menu");
    // Static markup only: all saved values are assigned via DOM properties.
    panel.innerHTML = `
      <div class="main-menu-home">
        <button type="button" class="main-menu-start">Start Game</button>
        <button type="button" class="main-menu-settings">Settings</button>
        <p class="main-menu-hint">The stage is yours.</p>
      </div>
      <div class="main-menu-options" hidden>
        <h2>Settings</h2>
        <button type="button" class="main-menu-display" aria-pressed="false">
          Display mode: Windowed
        </button>
        <label class="main-menu-volume">
          <span>Music volume</span>
          <input type="range" min="0" max="100" step="1" aria-label="Music volume">
          <output aria-label="Music volume value"></output>
        </label>
        <label class="main-menu-volume">
          <span>SFX volume</span>
          <input type="range" min="0" max="100" step="1" aria-label="SFX volume">
          <output aria-label="SFX volume value"></output>
        </label>
        <button type="button" class="main-menu-back">Back</button>
      </div>
      <p class="main-menu-status" role="status" aria-live="polite"></p>
    `;
    this.panel = panel;
    this.home = panel.querySelector<HTMLElement>(".main-menu-home")!;
    this.settingsPanel = panel.querySelector<HTMLElement>(".main-menu-options")!;
    this.displayButton = panel.querySelector<HTMLButtonElement>(".main-menu-display")!;
    this.status = panel.querySelector<HTMLElement>(".main-menu-status")!;
    const start = panel.querySelector<HTMLButtonElement>(".main-menu-start")!;
    const settings = panel.querySelector<HTMLButtonElement>(".main-menu-settings")!;
    const back = panel.querySelector<HTMLButtonElement>(".main-menu-back")!;
    const options = { signal: this.listeners.signal };

    start.addEventListener("click", () => this.startGame(), options);
    settings.addEventListener("click", () => {
      this.home.hidden = true;
      this.settingsPanel.hidden = false;
      this.refreshDisplay();
      back.focus();
    }, options);
    back.addEventListener("click", () => {
      this.settingsPanel.hidden = true;
      this.home.hidden = false;
      this.status.textContent = "";
      settings.focus();
    }, options);
    panel.addEventListener("keydown", event => {
      if (event.key === "Escape" && !this.settingsPanel.hidden) {
        back.click();
      }
    }, options);
    this.displayButton.addEventListener("click", () => {
      void this.setFullscreen(!this.scale.isFullscreen);
    }, options);

    for (const [index, bus] of (["music", "sfx"] as const).entries()) {
      const row = panel.querySelectorAll<HTMLElement>(".main-menu-volume")[index]!;
      const slider = row.querySelector<HTMLInputElement>("input")!;
      const output = row.querySelector<HTMLOutputElement>("output")!;
      const renderValue = (): void => {
        const setting = this.audioSettings.get(bus);
        slider.value = String(Math.round(setting.volume * 100));
        output.value = `${slider.value}%${setting.muted ? " (muted)" : ""}`;
      };
      renderValue();
      slider.addEventListener("input", () => {
        this.audioSettings.setVolume(bus, Number(slider.value) / 100);
        renderValue();
      }, options);
    }

    // Native controls provide keyboard, touch, focus and slider accessibility;
    // their position and lifetime are owned by this Phaser scene.
    this.add.dom(320, 222, panel);
    this.refreshDisplay();
    start.focus();
  }

  private refreshDisplay(): void {
    const fullscreen = this.scale.isFullscreen;
    this.displayButton.textContent =
      `Display mode: ${fullscreen ? "Fullscreen" : "Windowed"}`;
    this.displayButton.setAttribute("aria-pressed", String(fullscreen));
    this.displayButton.disabled = !document.fullscreenEnabled;
    this.status.textContent = !document.fullscreenEnabled
      ? "Fullscreen is unavailable in this browser."
      : !fullscreen && this.displayPreferences.getFullscreen()
        ? "Fullscreen will resume on Start Game."
        : "";
  }

  private onDisplayChange(): void {
    this.displayPreferences.setFullscreen(this.scale.isFullscreen);
    this.refreshDisplay();
  }

  private async setFullscreen(fullscreen: boolean): Promise<void> {
    if (!document.fullscreenEnabled) {
      this.refreshDisplay();
      return;
    }
    try {
      // Phaser's Scale Manager observes these changes and resizes the game.
      // Native promises let us handle denial without an unhandled rejection.
      // The document target also keeps the existing Turnstile overlay visible.
      if (fullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      this.status.textContent = "Display mode could not be changed. Try again.";
    }
  }

  private startGame(): void {
    if (this.starting) {
      return;
    }
    this.starting = true;
    this.panel.inert = true;
    if (this.displayPreferences.getFullscreen() && !this.scale.isFullscreen) {
      // Restoring fullscreen requires this explicit player gesture, not boot.
      void this.setFullscreen(true);
    }
    void leaderboard.boot(() => {
      if (this.sound instanceof Phaser.Sound.WebAudioSoundManager) {
        // Keep resume inside BEGIN THE SHOW's transient user activation.
        void this.sound.context.resume().catch(() => undefined);
      }
      this.scene.start("game");
    }).catch(() => {
      this.status.textContent = "Unable to open the start screen. Please reload.";
    });
  }
}
