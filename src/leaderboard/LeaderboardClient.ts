import {
  isLocalDevelopmentHostname
} from "./LocalEnvironment";

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

export interface ClaimVerificationResult {
  readonly rank: number | null;
  readonly playerName: string;
  readonly elapsedMs: number;
  readonly rankedMs: number;
  readonly deaths: number;
  readonly hits: number;
  readonly buildVersion: string;
  readonly completedAt: number;
}

export type ClaimVerificationErrorKind =
  | "invalid-format"
  | "not-found"
  | "rate-limited"
  | "server";

export class ClaimVerificationError extends Error {
  public readonly kind:
    ClaimVerificationErrorKind;

  public constructor(
    kind: ClaimVerificationErrorKind,
    message: string
  ) {
    super(message);
    this.name = "ClaimVerificationError";
    this.kind = kind;
  }
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

export const LOCAL_LEADERBOARD_MESSAGE =
  "Leaderboard is not available in local development.";

const CLAIM_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeClaimCodeInput(
  input: string
): string | null {
  const compact = input
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[-\s]/g, "");

  if (
    compact.length !== 16 ||
    !new RegExp(
      `^[${CLAIM_CODE_ALPHABET}]{16}$`
    ).test(compact)
  ) {
    return null;
  }

  return [
    compact.slice(0, 4),
    compact.slice(4, 8),
    compact.slice(8, 12),
    compact.slice(12, 16)
  ].join("-");
}

function normalizePlayerName(
  input: string
): string | null {
  const normalized = input
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

  return normalized.length >= 3 &&
    normalized.length <= 20 &&
    /^[\p{L}\p{N}_ -]+$/u.test(normalized)
    ? normalized
    : null;
}

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

  private sessionInitialization:
    Promise<void> = Promise.resolve();

  private readonly pendingEvents:
    RunEvent[] = [];

  private localHits = 0;
  private localDeaths = 0;
  private localStartedAt = 0;

  private onlineRun = false;
  private rankedRunPending = false;
  private finishing = false;
  private gameStarted = false;

  private startGame:
    (() => void) | undefined;

  public async boot(
    startGame: () => void
  ): Promise<void> {
    this.startGame = startGame;
    await this.showStartScreen();
  }

  public async verifyClaimCode(
    input: string
  ): Promise<ClaimVerificationResult> {
    const code = normalizeClaimCodeInput(input);

    if (!code) {
      throw new ClaimVerificationError(
        "invalid-format",
        "Enter a 16-character claim code."
      );
    }

    let response: Response;

    try {
      response = await fetch(
        `${API_BASE}/claims/verify`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ code })
        }
      );
    } catch {
      throw new ClaimVerificationError(
        "server",
        "Claim verification is unavailable. Try again."
      );
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      throw new ClaimVerificationError(
        "server",
        "Claim verification returned an invalid response."
      );
    }

    if (response.status === 404) {
      throw new ClaimVerificationError(
        "not-found",
        "Code not found."
      );
    }

    if (response.status === 429) {
      throw new ClaimVerificationError(
        "rate-limited",
        "Too many attempts. Wait one minute and try again."
      );
    }

    if (!response.ok) {
      const message =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : "Claim verification is unavailable. Try again.";

      throw new ClaimVerificationError(
        "server",
        message
      );
    }

    return body as ClaimVerificationResult;
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

    await this.sessionInitialization;

    if (
      this.onlineRun &&
      this.session
    ) {
      try {
        this.flushPendingEvents();
        await this.eventQueue;

        if (!this.onlineRun) {
          throw new Error(
            "Run event delivery failed before completion"
          );
        }

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
    if (this.finishing) {
      return;
    }

    if (
      this.onlineRun &&
      this.session
    ) {
      this.enqueueOnlineEvent(event);
      return;
    }

    if (this.rankedRunPending) {
      this.pendingEvents.push(event);
    }
  }

  private enqueueOnlineEvent(
    event: RunEvent
  ): void {
    const session = this.session;

    if (!session) {
      return;
    }

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

  private flushPendingEvents(): void {
    if (
      !this.onlineRun ||
      !this.session
    ) {
      this.pendingEvents.length = 0;
      return;
    }

    const events =
      this.pendingEvents.splice(0);

    for (const event of events) {
      this.enqueueOnlineEvent(event);
    }
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
        "Enter your player name and begin the show."
      );

    const label =
      createElement(
        "label",
        "leaderboard-label",
        "PLAYER NAME"
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
    input.placeholder = "Your player name";
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

    const localDevelopment =
      isLocalDevelopmentHostname(
        window.location.hostname
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
    let configurationPending =
      !localDevelopment;
    let verificationUnavailable = false;

    const updateBeginState = (): void => {
      const validName =
        normalizePlayerName(input.value) !== null;

      const verificationPending =
        turnstileRequired &&
        !turnstileToken &&
        !verificationUnavailable;

      beginButton.disabled =
        !validName ||
        configurationPending ||
        verificationPending;
    };

    input.addEventListener(
      "input",
      updateBeginState
    );

    if (localDevelopment) {
      status.textContent =
        "Local development — this run will be unranked.";
      updateBeginState();
    } else try {
      const response = await fetch(
        `${API_BASE}/config`
      );

      config =
        await readJson<PublicConfig>(
          response
        );

      turnstileRequired =
        config.turnstileSiteKey.length > 0;

      configurationPending = false;

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
                verificationUnavailable = false;
                updateBeginState();
                status.textContent =
                  "Online ranking ready.";
              },
              "expired-callback": () => {
                turnstileToken = "";
                verificationUnavailable = false;
                updateBeginState();
                status.textContent =
                  "Verification expired.";
              },
              "error-callback": () => {
                turnstileToken = "";
                verificationUnavailable = true;
                updateBeginState();
                status.textContent =
                  "Verification unavailable. The run may start unranked.";
              }
            }
          );
      } else {
        status.textContent =
          "Online ranking ready.";
      }

      updateBeginState();
    } catch {
      configurationPending = false;
      verificationUnavailable = true;
      updateBeginState();
      status.textContent =
        "Leaderboard unavailable — the game will start unranked.";
    }

    const startRankedRun = async (
      playerName: string
    ): Promise<void> => {
      const shouldStart =
        !localDevelopment &&
        config !== undefined &&
        (
          !turnstileRequired ||
          turnstileToken.length > 0
        );

      if (!shouldStart) {
        return;
      }

      this.rankedRunPending = true;

      try {
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
        this.flushPendingEvents();
      } catch (error) {
        this.onlineRun = false;
        this.session = undefined;
        this.pendingEvents.length = 0;

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
      } finally {
        this.rankedRunPending = false;
      }
    };

    const begin = (): void => {
      const playerName =
        normalizePlayerName(input.value);

      if (!playerName) {
        status.textContent =
          "Use 3–20 letters, numbers, spaces, _ or -.";
        input.focus();
        return;
      }

      if (this.gameStarted) {
        return;
      }

      this.gameStarted = true;
      beginButton.disabled = true;
      leaderboardButton.disabled = true;

      localStorage.setItem(
        PLAYER_STORAGE_KEY,
        playerName
      );

      this.localStartedAt =
        Date.now();

      overlay.remove();

      // Construct and unlock Phaser's actual AudioContext while
      // this click still owns transient user activation. Ranked-run
      // network work starts only after the game is already booting.
      this.startGame?.();
      this.sessionInitialization =
        startRankedRun(playerName);
      void this.sessionInitialization;
    };

    beginButton.addEventListener(
      "click",
      () => {
        begin();
      }
    );

    input.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" &&
          !beginButton.disabled
        ) {
          begin();
        }
      }
    );

    leaderboardButton.addEventListener(
      "click",
      () => {
        if (localDevelopment) {
          this.showLocalLeaderboardMessage(
            overlay
          );
          return;
        }

        void this.showLeaderboard(
          overlay
        );
      }
    );

    input.focus();
  }

  private showLocalLeaderboardMessage(
    overlay: HTMLElement
  ): void {
    const panel =
      overlay.querySelector<HTMLElement>(
        ".leaderboard-panel"
      );

    if (!panel) {
      return;
    }

    let status =
      panel.querySelector<HTMLElement>(
        ".leaderboard-status"
      );

    if (!status) {
      status = createElement(
        "div",
        "leaderboard-status"
      );

      const actions =
        panel.querySelector(
          ".leaderboard-actions"
        );

      panel.insertBefore(
        status,
        actions
      );
    }

    status.textContent =
      LOCAL_LEADERBOARD_MESSAGE;
  }

  private async showLeaderboard(
    returnOverlay?: HTMLElement,
    initialPage = 1
  ): Promise<void> {
    if (
      returnOverlay &&
      isLocalDevelopmentHostname(
        window.location.hostname
      )
    ) {
      this.showLocalLeaderboardMessage(
        returnOverlay
      );
      return;
    }

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
