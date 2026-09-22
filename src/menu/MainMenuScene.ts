import Phaser from "phaser";
import { AudioSettings } from "../audio/AudioSettings";
import { ClaimVerificationError, leaderboard, normalizeClaimCodeInput, type ClaimVerificationResult } from "../leaderboard/LeaderboardClient";
import { DisplayPreferences } from "./DisplayPreferences";
import "./main-menu.css";

/** The only entry scene: no world, audio assets, or ranked run starts here. */
export class MainMenuScene extends Phaser.Scene {
  private audioSettings!: AudioSettings;
  private displayPreferences!: DisplayPreferences;
  private panel!: HTMLElement;
  private home!: HTMLElement;
  private settingsPanel!: HTMLElement;
  private verificationPanel!: HTMLElement;
  private verificationButton!: HTMLButtonElement;
  private verificationInput!: HTMLInputElement;
  private verificationSubmit!: HTMLButtonElement;
  private verificationSummary!: HTMLElement;
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
        <button type="button" class="main-menu-verify">Verify Claim Code</button>
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
      <div class="main-menu-verification" hidden>
        <h2>Verify Claim Code</h2>
        <form class="main-menu-verification-form">
          <label for="main-menu-claim-code">Claim code</label>
          <input
            id="main-menu-claim-code"
            name="claim-code"
            type="text"
            inputmode="text"
            autocomplete="off"
            spellcheck="false"
            maxlength="19"
          >
          <button type="submit" class="main-menu-verify-submit">Verify</button>
        </form>
        <dl class="main-menu-verification-summary" hidden></dl>
        <button type="button" class="main-menu-verify-back">Back</button>
      </div>
      <p class="main-menu-status" role="status" aria-live="polite"></p>
    `;
    this.panel = panel;
    this.home = panel.querySelector<HTMLElement>(".main-menu-home")!;
    this.settingsPanel = panel.querySelector<HTMLElement>(".main-menu-options")!;
    this.verificationPanel = panel.querySelector<HTMLElement>(".main-menu-verification")!;
    this.verificationButton = panel.querySelector<HTMLButtonElement>(".main-menu-verify")!;
    this.verificationInput = panel.querySelector<HTMLInputElement>("#main-menu-claim-code")!;
    this.verificationSubmit = panel.querySelector<HTMLButtonElement>(".main-menu-verify-submit")!;
    this.verificationSummary = panel.querySelector<HTMLElement>(".main-menu-verification-summary")!;
    this.displayButton = panel.querySelector<HTMLButtonElement>(".main-menu-display")!;
    this.status = panel.querySelector<HTMLElement>(".main-menu-status")!;
    const start = panel.querySelector<HTMLButtonElement>(".main-menu-start")!;
    const settings = panel.querySelector<HTMLButtonElement>(".main-menu-settings")!;
    const back = panel.querySelector<HTMLButtonElement>(".main-menu-back")!;
    const verificationBack = panel.querySelector<HTMLButtonElement>(".main-menu-verify-back")!;
    const verificationForm = panel.querySelector<HTMLFormElement>(".main-menu-verification-form")!;
    const options = { signal: this.listeners.signal };

    start.addEventListener("click", () => this.startGame(), options);
    settings.addEventListener("click", () => {
      this.home.hidden = true;
      this.settingsPanel.hidden = false;
      this.refreshDisplay();
      back.focus();
    }, options);
    this.verificationButton.addEventListener("click", () => {
      this.openVerificationPanel();
    }, options);
    verificationForm.addEventListener("submit", event => {
      event.preventDefault();
      void this.submitVerification(false);
    }, options);
    back.addEventListener("click", () => {
      this.settingsPanel.hidden = true;
      this.home.hidden = false;
      this.status.textContent = "";
      settings.focus();
    }, options);
    verificationBack.addEventListener("click", () => {
      this.verificationPanel.hidden = true;
      this.home.hidden = false;
      this.status.textContent = "";
      this.status.removeAttribute("data-state");
      this.verificationButton.focus();
    }, options);
    panel.addEventListener("keydown", event => {
      if (event.key !== "Escape") {
        return;
      }

      if (!this.settingsPanel.hidden) {
        back.click();
      } else if (!this.verificationPanel.hidden) {
        verificationBack.click();
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
    this.openVerificationDeepLink();
  }

  private openVerificationPanel(): void {
    this.home.hidden = true;
    this.settingsPanel.hidden = true;
    this.verificationPanel.hidden = false;
    this.verificationSummary.hidden = true;
    this.verificationSummary.replaceChildren();
    this.status.textContent = "";
    this.status.removeAttribute("data-state");
    this.verificationInput.focus();
  }

  private openVerificationDeepLink(): void {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("verify");

    if (!code) {
      return;
    }

    const normalized =
      normalizeClaimCodeInput(code);

    if (!normalized) {
      return;
    }

    this.openVerificationPanel();
    this.verificationInput.value = normalized;
    void this.submitVerification(true);
  }

  private async submitVerification(
    fromDeepLink: boolean
  ): Promise<void> {
    const normalized =
      normalizeClaimCodeInput(
        this.verificationInput.value
      );

    if (!normalized) {
      this.showVerificationMessage(
        "invalid-format",
        "Enter a 16-character claim code."
      );
      return;
    }

    this.verificationInput.value = normalized;
    this.verificationSubmit.disabled = true;
    this.verificationSummary.hidden = true;
    this.verificationSummary.replaceChildren();
    this.showVerificationMessage(
      "loading",
      "Checking claim code..."
    );

    try {
      const result =
        await leaderboard.verifyClaimCode(
          normalized
        );
      this.renderVerificationSummary(result);
      this.showVerificationMessage(
        "success",
        "Run summary loaded."
      );
    } catch (error) {
      if (error instanceof ClaimVerificationError) {
        this.showVerificationMessage(
          error.kind,
          error.message
        );
      } else {
        this.showVerificationMessage(
          "server",
          "Claim verification is unavailable. Try again."
        );
      }
    } finally {
      this.verificationSubmit.disabled = false;

      if (fromDeepLink) {
        const url = new URL(window.location.href);
        url.searchParams.delete("verify");
        history.replaceState(
          history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`
        );
      }
    }
  }

  private showVerificationMessage(
    state: string,
    message: string
  ): void {
    this.status.dataset.state = state;
    this.status.textContent = message;
  }

  private renderVerificationSummary(
    result: ClaimVerificationResult
  ): void {
    const values: readonly [string, string][] = [
      ["Rank", result.rank === null ? "Not ranked" : `#${result.rank}`],
      ["Player", result.playerName],
      ["Gameplay time", this.formatVerificationTime(result.elapsedMs)],
      ["Ranked time", this.formatVerificationTime(result.rankedMs)],
      ["Deaths", String(result.deaths)],
      ["Hits", String(result.hits)],
      ["Build", result.buildVersion],
      ["Submitted", new Date(result.completedAt).toLocaleString()]
    ];

    for (const [label, value] of values) {
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      this.verificationSummary.append(
        term,
        description
      );
    }

    this.verificationSummary.hidden = false;
  }

  private formatVerificationTime(
    milliseconds: number
  ): string {
    const totalSeconds = Math.max(
      0,
      Math.floor(milliseconds / 1000)
    );
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
