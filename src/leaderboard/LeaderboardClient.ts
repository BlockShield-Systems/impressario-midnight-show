export interface LeaderboardEntry {
  readonly rank: number;
  readonly playerName: string;
  readonly elapsedMs: number;
  readonly deaths: number;
  readonly hits: number;
  readonly rankedMs: number;
  readonly completedAt: number;
}

interface LeaderboardResponse {
  readonly entries: LeaderboardEntry[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly pages: number;
}

interface StartResponse {
  readonly runId: string;
  readonly token: string;
  readonly playerName: string;
  readonly startedAt: number;
}

interface FinishResponse {
  readonly runId: string;
  readonly playerName: string;
  readonly elapsedMs: number;
  readonly deaths: number;
  readonly hits: number;
  readonly rankedMs: number;
  readonly rank: number | null;
  readonly total: number;
  readonly flagged: boolean;
  readonly claimCode: string;
}

interface PublicConfig {
  readonly turnstileSiteKey: string;
  readonly buildVersion: string;
}

interface RunSession {
  readonly runId: string;
  readonly token: string;
  sequence: number;
}

type RunEvent =
  | {
      readonly type: "hit";
    }
  | {
      readonly type: "death";
    }
  | {
      readonly type: "checkpoint";
      readonly checkpoint: string;
    };

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ): string;
  reset(widgetId?: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const API_BASE = "/api";
const PLAYER_STORAGE_KEY =
  "impressario.player-name";

function formatTime(milliseconds: number): string {
  const totalSeconds =
    Math.max(0, Math.floor(milliseconds / 1000));

  const minutes =
    Math.floor(totalSeconds / 60);

  const seconds =
    totalSeconds % 60;

  const centiseconds =
    Math.floor(
      (milliseconds % 1000) / 10
    );

  return [
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
    String(centiseconds).padStart(2, "0")
  ].join(":");
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element =
    document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

async function readJson<T>(
  response: Response
): Promise<T> {
  const contentType =
    response.headers.get(
      "content-type"
    ) ?? "";

  if (
    !contentType.includes(
      "application/json"
    )
  ) {
    throw new Error(
      "Leaderboard unavailable in offline mode. Start the game through the Cloudflare Worker."
    );
  }

  const body =
    await response.json() as
      | T
      | {
          error?: string;
        };

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `HTTP ${response.status}`;

    throw new Error(message);
  }

  return body as T;
}

class LeaderboardClient {
  private session:
    RunSession | undefined;

  private eventQueue:
    Promise<void> = Promise.resolve();

  private localHits = 0;
  private localDeaths = 0;
  private localStartedAt = 0;

  private onlineRun = false;
  private finishing = false;

  private startGame:
    (() => void) | undefined;

  public async boot(
    startGame: () => void
  ): Promise<void> {
    this.startGame = startGame;
    await this.showStartScreen();
  }

  public recordHit(): void {
    this.localHits += 1;

    this.queueEvent({
      type: "hit"
    });
  }

  public recordDeath(): void {
    this.localDeaths += 1;

    this.queueEvent({
      type: "death"
    });
  }

  public recordCheckpoint(
    checkpoint: string
  ): void {
    this.queueEvent({
      type: "checkpoint",
      checkpoint
    });
  }

  public async finishRun(): Promise<void> {
    if (this.finishing) {
      return;
    }

    this.finishing = true;

    let result:
      FinishResponse | undefined;

    if (
      this.onlineRun &&
      this.session
    ) {
      try {
        await this.eventQueue;

        const response = await fetch(
          `${API_BASE}/runs/${encodeURIComponent(
            this.session.runId
          )}/finish`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              authorization:
                `Bearer ${this.session.token}`
            }
          }
        );

        result =
          await readJson<FinishResponse>(
            response
          );
      } catch (error) {
        console.error(
          "Leaderboard finish failed:",
          error
        );
      }
    }

    window.setTimeout(
      () => {
        this.showFinalResult(result);
      },
      14_000
    );
  }

  private queueEvent(
    event: RunEvent
  ): void {
    if (
      !this.onlineRun ||
      !this.session ||
      this.finishing
    ) {
      return;
    }

    const session = this.session;

    this.eventQueue =
      this.eventQueue.then(
        async () => {
          session.sequence += 1;

          const response = await fetch(
            `${API_BASE}/runs/${encodeURIComponent(
              session.runId
            )}/events`,
            {
              method: "POST",
              headers: {
                "content-type":
                  "application/json",
                authorization:
                  `Bearer ${session.token}`
              },
              body: JSON.stringify({
                sequence:
                  session.sequence,
                ...event
              })
            }
          );

          if (!response.ok) {
            const message =
              await response.text();

            throw new Error(
              `Run event rejected: ${
                response.status
              } ${message}`
            );
          }
        }
      ).catch(error => {
        this.onlineRun = false;

        console.error(
          "Leaderboard event failed; run is now unranked:",
          error
        );
      });
  }

  private async showStartScreen():
    Promise<void> {
    const overlay =
      createElement(
        "div",
        "leaderboard-overlay"
      );

    const panel =
      createElement(
        "section",
        "leaderboard-panel leaderboard-start"
      );

    const eyebrow =
      createElement(
        "div",
        "leaderboard-eyebrow",
        "THE MIDNIGHT SHOW"
      );

    const title =
      createElement(
        "h1",
        undefined,
        "IMPRESSARIO"
      );

    const intro =
      createElement(
        "p",
        "leaderboard-intro",
        "Enter your stage name and begin a ranked performance."
      );

    const label =
      createElement(
        "label",
        "leaderboard-label",
        "STAGE NAME"
      );

    const input =
      createElement(
        "input",
        "leaderboard-name"
      );

    input.type = "text";
    input.minLength = 3;
    input.maxLength = 20;
    input.autocomplete = "username";
    input.spellcheck = false;
    input.placeholder = "Your stage name";
    input.value =
      localStorage.getItem(
        PLAYER_STORAGE_KEY
      ) ?? "";

    label.append(input);

    const status =
      createElement(
        "div",
        "leaderboard-status",
        "Connecting to the ranking service..."
      );

    const turnstileHost =
      createElement(
        "div",
        "leaderboard-turnstile"
      );

    const beginButton =
      createElement(
        "button",
        "leaderboard-primary",
        "BEGIN THE SHOW"
      );

    beginButton.type = "button";
    beginButton.disabled = true;

    const leaderboardButton =
      createElement(
        "button",
        "leaderboard-secondary",
        "VIEW LEADERBOARD"
      );

    leaderboardButton.type = "button";

    const actions =
      createElement(
        "div",
        "leaderboard-actions"
      );

    actions.append(
      beginButton,
      leaderboardButton
    );

    panel.append(
      eyebrow,
      title,
      intro,
      label,
      status,
      turnstileHost,
      actions
    );

    overlay.append(panel);
    document.body.append(overlay);

    let config:
      PublicConfig | undefined;

    let turnstileToken = "";
    let turnstileRequired = false;
    let widgetId:
      string | undefined;

    try {
      const response = await fetch(
        `${API_BASE}/config`
      );

      config =
        await readJson<PublicConfig>(
          response
        );

      turnstileRequired =
        config.turnstileSiteKey.length > 0;

      if (turnstileRequired) {
        status.textContent =
          "Complete the verification to start a ranked run.";

        await this.loadTurnstile();

        if (!window.turnstile) {
          throw new Error(
            "Turnstile did not initialize"
          );
        }

        widgetId =
          window.turnstile.render(
            turnstileHost,
            {
              sitekey:
                config.turnstileSiteKey,
              theme: "dark",
              callback: token => {
                turnstileToken = token;
                beginButton.disabled = false;
                status.textContent =
                  "Online ranking ready.";
              },
              "expired-callback": () => {
                turnstileToken = "";
                beginButton.disabled = true;
                status.textContent =
                  "Verification expired.";
              },
              "error-callback": () => {
                turnstileToken = "";
                beginButton.disabled = false;
                status.textContent =
                  "Verification unavailable. The run may start unranked.";
              }
            }
          );
      } else {
        beginButton.disabled = false;
        status.textContent =
          "Leaderboard development mode ready.";
      }
    } catch {
      beginButton.disabled = false;
      status.textContent =
        "Leaderboard unavailable — the game will start unranked.";
    }

    const begin = async (): Promise<void> => {
      const playerName =
        input.value
          .normalize("NFKC")
          .trim()
          .replace(/\s+/g, " ");

      if (
        playerName.length < 3 ||
        playerName.length > 20 ||
        !/^[\p{L}\p{N}_ -]+$/u.test(
          playerName
        )
      ) {
        status.textContent =
          "Use 3–20 letters, numbers, spaces, _ or -.";
        input.focus();
        return;
      }

      beginButton.disabled = true;
      leaderboardButton.disabled = true;

      localStorage.setItem(
        PLAYER_STORAGE_KEY,
        playerName
      );

      this.localStartedAt =
        Date.now();

      try {
        if (
          config &&
          (
            !turnstileRequired ||
            turnstileToken
          )
        ) {
          const response = await fetch(
            `${API_BASE}/runs`,
            {
              method: "POST",
              headers: {
                "content-type":
                  "application/json"
              },
              body: JSON.stringify({
                playerName,
                turnstileToken
              })
            }
          );

          const started =
            await readJson<StartResponse>(
              response
            );

          this.session = {
            runId: started.runId,
            token: started.token,
            sequence: 0
          };

          this.onlineRun = true;
        }
      } catch (error) {
        this.onlineRun = false;

        console.error(
          "Ranked run unavailable:",
          error
        );

        if (
          widgetId &&
          window.turnstile
        ) {
          window.turnstile.reset(
            widgetId
          );
        }
      }

      overlay.remove();
      this.startGame?.();
    };

    beginButton.addEventListener(
      "click",
      () => {
        void begin();
      }
    );

    input.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" &&
          !beginButton.disabled
        ) {
          void begin();
        }
      }
    );

    leaderboardButton.addEventListener(
      "click",
      () => {
        void this.showLeaderboard(
          overlay
        );
      }
    );

    input.focus();
  }

  private async showLeaderboard(
    returnOverlay?: HTMLElement,
    initialPage = 1
  ): Promise<void> {
    returnOverlay?.remove();

    const overlay =
      createElement(
        "div",
        "leaderboard-overlay"
      );

    const panel =
      createElement(
        "section",
        "leaderboard-panel leaderboard-board"
      );

    const title =
      createElement(
        "h2",
        undefined,
        "GLOBAL LEADERBOARD"
      );

    const status =
      createElement(
        "div",
        "leaderboard-status",
        "Loading rankings..."
      );

    const tableWrap =
      createElement(
        "div",
        "leaderboard-table-wrap"
      );

    const navigation =
      createElement(
        "div",
        "leaderboard-pagination"
      );

    const close =
      createElement(
        "button",
        "leaderboard-secondary",
        returnOverlay
          ? "BACK"
          : "CLOSE"
      );

    close.type = "button";

    panel.append(
      title,
      status,
      tableWrap,
      navigation,
      close
    );

    overlay.append(panel);
    document.body.append(overlay);

    close.addEventListener(
      "click",
      () => {
        overlay.remove();

        if (returnOverlay) {
          document.body.append(
            returnOverlay
          );
        }
      }
    );

    const loadPage =
      async (page: number) => {
        status.textContent =
          "Loading rankings...";
        tableWrap.replaceChildren();
        navigation.replaceChildren();

        try {
          const response = await fetch(
            `${API_BASE}/leaderboard?page=${
              page
            }&pageSize=50`
          );

          const data =
            await readJson<LeaderboardResponse>(
              response
            );

          status.textContent =
            `${data.total} completed ranked runs`;

          const table =
            createElement(
              "table",
              "leaderboard-table"
            );

          const head =
            createElement("thead");

          const headRow =
            createElement("tr");

          for (
            const heading of [
              "RANK",
              "PLAYER",
              "TIME",
              "DEATHS",
              "HITS",
              "RANKED"
            ]
          ) {
            headRow.append(
              createElement(
                "th",
                undefined,
                heading
              )
            );
          }

          head.append(headRow);

          const body =
            createElement("tbody");

          for (
            const entry of
            data.entries
          ) {
            const row =
              createElement("tr");

            const values = [
              `#${entry.rank}`,
              entry.playerName,
              formatTime(
                entry.elapsedMs
              ),
              String(entry.deaths),
              String(entry.hits),
              formatTime(
                entry.rankedMs
              )
            ];

            for (
              const value of values
            ) {
              row.append(
                createElement(
                  "td",
                  undefined,
                  value
                )
              );
            }

            body.append(row);
          }

          table.append(head, body);
          tableWrap.append(table);

          const previous =
            createElement(
              "button",
              "leaderboard-secondary",
              "← PREVIOUS"
            );

          const pageText =
            createElement(
              "span",
              undefined,
              `PAGE ${data.page} / ${
                Math.max(1, data.pages)
              }`
            );

          const next =
            createElement(
              "button",
              "leaderboard-secondary",
              "NEXT →"
            );

          previous.disabled =
            data.page <= 1;

          next.disabled =
            data.page >= data.pages;

          previous.addEventListener(
            "click",
            () => {
              void loadPage(
                data.page - 1
              );
            }
          );

          next.addEventListener(
            "click",
            () => {
              void loadPage(
                data.page + 1
              );
            }
          );

          navigation.append(
            previous,
            pageText,
            next
          );
        } catch (error) {
          status.textContent =
            error instanceof Error
              ? error.message
              : "Leaderboard unavailable";
        }
      };

    await loadPage(initialPage);
  }

  private showFinalResult(
    result?: FinishResponse
  ): void {
    const overlay =
      createElement(
        "div",
        "leaderboard-overlay leaderboard-result-overlay"
      );

    const panel =
      createElement(
        "section",
        "leaderboard-panel leaderboard-result"
      );

    const title =
      createElement(
        "h2",
        undefined,
        result?.flagged
          ? "RUN UNDER REVIEW"
          : result
            ? "YOUR FINAL RANK"
            : "UNRANKED PERFORMANCE"
      );

    panel.append(title);

    if (result) {
      const rank =
        createElement(
          "div",
          "leaderboard-rank",
          result.rank === null
            ? "NOT PUBLICLY RANKED"
            : `#${result.rank} OF ${result.total}`
        );

      const stats =
        createElement(
          "dl",
          "leaderboard-stats"
        );

      const values: readonly [
        string,
        string
      ][] = [
        [
          "TIME",
          formatTime(
            result.elapsedMs
          )
        ],
        [
          "DEATHS",
          String(result.deaths)
        ],
        [
          "HITS",
          String(result.hits)
        ],
        [
          "RANKED TIME",
          formatTime(
            result.rankedMs
          )
        ]
      ];

      for (
        const [name, value] of values
      ) {
        stats.append(
          createElement(
            "dt",
            undefined,
            name
          ),
          createElement(
            "dd",
            undefined,
            value
          )
        );
      }

      const claim =
        createElement(
          "div",
          "leaderboard-claim",
          `CLAIM CODE: ${result.claimCode}`
        );

      const claimHint =
        createElement(
          "p",
          "leaderboard-small",
          "Keep this private. It is shown only once and can verify ownership of this run."
        );

      panel.append(
        rank,
        stats,
        claim,
        claimHint
      );
    } else {
      panel.append(
        createElement(
          "p",
          "leaderboard-intro",
          [
            "The performance was completed, ",
            "but no online ranking could be submitted.",
            "",
            `Local time: ${formatTime(
              Date.now() -
                this.localStartedAt
            )}`,
            `Deaths: ${this.localDeaths}`,
            `Hits: ${this.localHits}`
          ].join("\n")
        )
      );
    }

    const leaderboardButton =
      createElement(
        "button",
        "leaderboard-primary",
        "VIEW FULL LEADERBOARD"
      );

    const replayButton =
      createElement(
        "button",
        "leaderboard-secondary",
        "PLAY AGAIN"
      );

    leaderboardButton.type = "button";
    replayButton.type = "button";

    const actions =
      createElement(
        "div",
        "leaderboard-actions"
      );

    actions.append(
      leaderboardButton,
      replayButton
    );

    panel.append(actions);
    overlay.append(panel);
    document.body.append(overlay);

    leaderboardButton.addEventListener(
      "click",
      () => {
        void this.showLeaderboard(
          overlay,
          result?.rank
            ? Math.ceil(
                result.rank / 50
              )
            : 1
        );
      }
    );

    replayButton.addEventListener(
      "click",
      () => {
        window.location.reload();
      }
    );
  }

  private async loadTurnstile():
    Promise<void> {
    if (window.turnstile) {
      return;
    }

    const existing =
      document.querySelector<HTMLScriptElement>(
        'script[data-impressario-turnstile="true"]'
      );

    if (existing) {
      await new Promise<void>(
        (resolve, reject) => {
          existing.addEventListener(
            "load",
            () => resolve(),
            {
              once: true
            }
          );

          existing.addEventListener(
            "error",
            () => reject(
              new Error(
                "Turnstile script failed"
              )
            ),
            {
              once: true
            }
          );
        }
      );

      return;
    }

    await new Promise<void>(
      (resolve, reject) => {
        const script =
          document.createElement(
            "script"
          );

        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

        script.async = true;
        script.defer = true;
        script.dataset
          .impressarioTurnstile =
            "true";

        script.addEventListener(
          "load",
          () => resolve(),
          {
            once: true
          }
        );

        script.addEventListener(
          "error",
          () => reject(
            new Error(
              "Turnstile script failed"
            )
          ),
          {
            once: true
          }
        );

        document.head.append(script);
      }
    );
  }
}

export const leaderboard =
  new LeaderboardClient();
