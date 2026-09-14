const STORAGE_KEY = "impressario.display-settings.v1";

/** Display preferences never rewrite or migrate the audio v2 payload. */
export class DisplayPreferences {
  private fullscreen = false;

  public constructor() {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "null"
      );
      this.fullscreen =
        typeof stored === "object" &&
        stored !== null &&
        "fullscreen" in stored &&
        stored.fullscreen === true;
    } catch {
      // Windowed mode remains usable without browser storage.
    }
  }

  public getFullscreen(): boolean {
    return this.fullscreen;
  }

  public setFullscreen(fullscreen: boolean): void {
    this.fullscreen = fullscreen;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ fullscreen })
      );
    } catch {
      // Keep the preference for this menu session if storage is unavailable.
    }
  }
}
