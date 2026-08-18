interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>():
    Promise<T | null>;
  all<T = Record<string, unknown>>():
    Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string):
    D1PreparedStatement;
  batch(
    statements: D1PreparedStatement[]
  ): Promise<D1Result[]>;
}

interface RateLimitBinding {
  limit(options: {
    key: string;
  }): Promise<{
    success: boolean;
  }>;
}

interface Fetcher {
  fetch(request: Request):
    Promise<Response>;
}

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  START_LIMITER: RateLimitBinding;

  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ALLOWED_ORIGIN: string;
  BUILD_VERSION: string;
  ENVIRONMENT: string;
}

interface RunRow {
  id: string;
  token_hash: string;
  player_name: string;
  started_at: number;
  finished_at: number | null;
  elapsed_ms: number | null;
  deaths: number;
  hits: number;
  last_sequence: number;
  checkpoint_order: number;
  checkpoint_name: string | null;
  status: string;
  ranked_ms: number | null;
}

const JSON_HEADERS = {
  "content-type":
    "application/json; charset=utf-8",
  "cache-control": "no-store"
} as const;

const CHECKPOINTS:
Readonly<Record<string, number>> = {
  "Movement Rehearsal": 0,
  "The Mirror Core": 80,
  "Mirror Relays": 90,
  "Core Chamber": 100
};

function json(
  body: unknown,
  status = 200,
  extraHeaders:
    Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...JSON_HEADERS,
        ...extraHeaders
      }
    }
  );
}

function corsHeaders(
  request: Request,
  env: Env
): Record<string, string> {
  const origin =
    request.headers.get("origin") ?? "";

  const developmentOrigin =
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(
      origin
    );

  const allowed =
    origin === env.ALLOWED_ORIGIN ||
    (
      env.ENVIRONMENT ===
        "development" &&
      developmentOrigin
    );

  return allowed
    ? {
        "access-control-allow-origin":
          origin,
        vary: "origin",
        "access-control-allow-methods":
          "GET, POST, OPTIONS",
        "access-control-allow-headers":
          "content-type, authorization",
        "access-control-max-age":
          "86400"
      }
    : {};
}

function normalizeName(
  input: unknown
): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const normalized =
    input
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");

  if (
    normalized.length < 3 ||
    normalized.length > 20 ||
    !/^[\p{L}\p{N}_ -]+$/u.test(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
}

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  const token =
    authorization.slice(7).trim();

  return token.length >= 32
    ? token
    : null;
}

function randomToken(
  bytes = 32
): string {
  const values =
    crypto.getRandomValues(
      new Uint8Array(bytes)
    );

  return Array.from(
    values,
    value =>
      value.toString(16)
        .padStart(2, "0")
  ).join("");
}

function randomClaimCode(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const bytes =
    crypto.getRandomValues(
      new Uint8Array(16)
    );

  let result = "";

  for (
    let index = 0;
    index < bytes.length;
    index += 1
  ) {
    const value =
      bytes[index] ?? 0;

    result +=
      alphabet[
        value % alphabet.length
      ];
  }

  return [
    result.slice(0, 4),
    result.slice(4, 8),
    result.slice(8, 12),
    result.slice(12, 16)
  ].join("-");
}

async function sha256(
  input: string
): Promise<string> {
  const encoded =
    new TextEncoder().encode(input);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );

  return Array.from(
    new Uint8Array(digest),
    value =>
      value.toString(16)
        .padStart(2, "0")
  ).join("");
}

async function verifyTurnstile(
  token: unknown,
  request: Request,
  env: Env
): Promise<boolean> {
  if (
    env.ENVIRONMENT ===
      "development" &&
    !env.TURNSTILE_SECRET_KEY
  ) {
    return true;
  }

  if (
    typeof token !== "string" ||
    token.length < 20 ||
    !env.TURNSTILE_SECRET_KEY
  ) {
    return false;
  }

  const form =
    new FormData();

  form.set(
    "secret",
    env.TURNSTILE_SECRET_KEY
  );

  form.set(
    "response",
    token
  );

  const remoteIp =
    request.headers.get(
      "CF-Connecting-IP"
    );

  if (remoteIp) {
    form.set(
      "remoteip",
      remoteIp
    );
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: form
    }
  );

  if (!response.ok) {
    return false;
  }

  const result =
    await response.json() as {
      success?: boolean;
    };

  return result.success === true;
}

async function readRun(
  request: Request,
  env: Env,
  runId: string
): Promise<
  | {
      run: RunRow;
      tokenHash: string;
    }
  | Response
> {
  const token =
    getBearerToken(request);

  if (!token) {
    return json(
      {
        error:
          "Missing run authorization"
      },
      401
    );
  }

  const tokenHash =
    await sha256(token);

  const run =
    await env.DB.prepare(
      `
        SELECT
          id,
          token_hash,
          player_name,
          started_at,
          finished_at,
          elapsed_ms,
          deaths,
          hits,
          last_sequence,
          checkpoint_order,
          checkpoint_name,
          status,
          ranked_ms
        FROM runs
        WHERE id = ?
        LIMIT 1
      `
    ).bind(runId).first<RunRow>();

  if (
    !run ||
    run.token_hash !== tokenHash
  ) {
    return json(
      {
        error: "Unknown run"
      },
      404
    );
  }

  return {
    run,
    tokenHash
  };
}

async function startRun(
  request: Request,
  env: Env
): Promise<Response> {
  const remoteIp =
    request.headers.get(
      "CF-Connecting-IP"
    ) ?? "unknown";

  const rateResult =
    await env.START_LIMITER.limit({
      key: remoteIp
    });

  if (!rateResult.success) {
    return json(
      {
        error:
          "Too many run attempts"
      },
      429
    );
  }

  let body: {
    playerName?: unknown;
    turnstileToken?: unknown;
  };

  try {
    body =
      await request.json() as
        typeof body;
  } catch {
    return json(
      {
        error: "Invalid JSON"
      },
      400
    );
  }

  const playerName =
    normalizeName(
      body.playerName
    );

  if (!playerName) {
    return json(
      {
        error:
          "Invalid player name"
      },
      400
    );
  }

  if (
    !await verifyTurnstile(
      body.turnstileToken,
      request,
      env
    )
  ) {
    return json(
      {
        error:
          "Verification failed"
      },
      403
    );
  }

  const runId =
    crypto.randomUUID();

  const token =
    randomToken();

  const tokenHash =
    await sha256(token);

  const now = Date.now();

  await env.DB.prepare(
    `
      INSERT INTO runs (
        id,
        token_hash,
        player_name,
        started_at,
        build_version,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `
  ).bind(
    runId,
    tokenHash,
    playerName,
    now,
    env.BUILD_VERSION,
    now
  ).run();

  return json(
    {
      runId,
      token,
      playerName,
      startedAt: now
    },
    201
  );
}

async function recordEvent(
  request: Request,
  env: Env,
  runId: string
): Promise<Response> {
  const authenticated =
    await readRun(
      request,
      env,
      runId
    );

  if (
    authenticated instanceof
      Response
  ) {
    return authenticated;
  }

  const { run } =
    authenticated;

  if (run.status !== "active") {
    return json(
      {
        error:
          "Run is no longer active"
      },
      409
    );
  }

  let body: {
    sequence?: unknown;
    type?: unknown;
    checkpoint?: unknown;
  };

  try {
    body =
      await request.json() as
        typeof body;
  } catch {
    return json(
      {
        error: "Invalid JSON"
      },
      400
    );
  }

  const sequence =
    typeof body.sequence ===
      "number" &&
    Number.isSafeInteger(
      body.sequence
    )
      ? body.sequence
      : -1;

  if (
    sequence !==
      run.last_sequence + 1
  ) {
    return json(
      {
        error:
          "Invalid event sequence",
        expected:
          run.last_sequence + 1
      },
      409
    );
  }

  const now = Date.now();

  let update:
    D1PreparedStatement;

  if (body.type === "hit") {
    update =
      env.DB.prepare(
        `
          UPDATE runs
          SET
            hits = hits + 1,
            last_sequence = ?
          WHERE
            id = ? AND
            status = 'active' AND
            last_sequence = ?
        `
      ).bind(
        sequence,
        runId,
        run.last_sequence
      );
  } else if (
    body.type === "death"
  ) {
    update =
      env.DB.prepare(
        `
          UPDATE runs
          SET
            deaths = deaths + 1,
            last_sequence = ?
          WHERE
            id = ? AND
            status = 'active' AND
            last_sequence = ?
        `
      ).bind(
        sequence,
        runId,
        run.last_sequence
      );
  } else if (
    body.type === "checkpoint"
  ) {
    if (
      typeof body.checkpoint !==
        "string"
    ) {
      return json(
        {
          error:
            "Invalid checkpoint"
        },
        400
      );
    }

    const checkpointOrder =
      CHECKPOINTS[
        body.checkpoint
      ] ?? run.checkpoint_order;

    const acceptedOrder =
      Math.max(
        run.checkpoint_order,
        checkpointOrder
      );

    update =
      env.DB.prepare(
        `
          UPDATE runs
          SET
            checkpoint_order = ?,
            checkpoint_name = ?,
            last_sequence = ?
          WHERE
            id = ? AND
            status = 'active' AND
            last_sequence = ?
        `
      ).bind(
        acceptedOrder,
        body.checkpoint.slice(
          0,
          64
        ),
        sequence,
        runId,
        run.last_sequence
      );
  } else {
    return json(
      {
        error:
          "Unknown event type"
      },
      400
    );
  }

  const eventInsert =
    env.DB.prepare(
      `
        INSERT INTO submissions (
          run_id,
          event_type,
          sequence,
          created_at
        )
        VALUES (?, ?, ?, ?)
      `
    ).bind(
      runId,
      body.type,
      sequence,
      now
    );

  await env.DB.batch([
    update,
    eventInsert
  ]);

  return json({
    accepted: true,
    sequence
  });
}

async function finishRun(
  request: Request,
  env: Env,
  runId: string
): Promise<Response> {
  const authenticated =
    await readRun(
      request,
      env,
      runId
    );

  if (
    authenticated instanceof
      Response
  ) {
    return authenticated;
  }

  const { run } =
    authenticated;

  if (run.status !== "active") {
    return json(
      {
        error:
          "Run already finished"
      },
      409
    );
  }

  const finishedAt =
    Date.now();

  const elapsedMs =
    Math.max(
      0,
      finishedAt -
        run.started_at
    );

  const rankedMs =
    elapsedMs +
    run.deaths * 45_000 +
    run.hits * 5_000;

  const flagged =
    elapsedMs < 60_000 ||
    run.checkpoint_order < 100 ||
    run.deaths > 999 ||
    run.hits > 9_999;

  const status =
    flagged
      ? "flagged"
      : "completed";

  const claimCode =
    randomClaimCode();

  const claimHash =
    await sha256(claimCode);

  await env.DB.prepare(
    `
      UPDATE runs
      SET
        finished_at = ?,
        elapsed_ms = ?,
        ranked_ms = ?,
        status = ?,
        claim_hash = ?
      WHERE
        id = ? AND
        status = 'active'
    `
  ).bind(
    finishedAt,
    elapsedMs,
    rankedMs,
    status,
    claimHash,
    runId
  ).run();

  const totalRow =
    await env.DB.prepare(
      `
        SELECT COUNT(*) AS total
        FROM runs
        WHERE status = 'completed'
      `
    ).first<{
      total: number;
    }>();

  const total =
    Number(
      totalRow?.total ?? 0
    );

  let rank:
    number | null = null;

  if (!flagged) {
    const rankRow =
      await env.DB.prepare(
        `
          SELECT
            COUNT(*) + 1 AS rank
          FROM runs
          WHERE
            status = 'completed' AND
            (
              ranked_ms < ? OR
              (
                ranked_ms = ? AND
                deaths < ?
              ) OR
              (
                ranked_ms = ? AND
                deaths = ? AND
                hits < ?
              ) OR
              (
                ranked_ms = ? AND
                deaths = ? AND
                hits = ? AND
                elapsed_ms < ?
              ) OR
              (
                ranked_ms = ? AND
                deaths = ? AND
                hits = ? AND
                elapsed_ms = ? AND
                finished_at < ?
              )
            )
        `
      ).bind(
        rankedMs,
        rankedMs,
        run.deaths,
        rankedMs,
        run.deaths,
        run.hits,
        rankedMs,
        run.deaths,
        run.hits,
        elapsedMs,
        rankedMs,
        run.deaths,
        run.hits,
        elapsedMs,
        finishedAt
      ).first<{
        rank: number;
      }>();

    rank =
      Number(
        rankRow?.rank ?? 1
      );
  }

  return json({
    runId,
    playerName:
      run.player_name,
    elapsedMs,
    deaths: run.deaths,
    hits: run.hits,
    rankedMs,
    rank,
    total,
    flagged,
    claimCode
  });
}

async function getLeaderboard(
  url: URL,
  env: Env
): Promise<Response> {
  const requestedPage =
    Number.parseInt(
      url.searchParams.get(
        "page"
      ) ?? "1",
      10
    );

  const requestedPageSize =
    Number.parseInt(
      url.searchParams.get(
        "pageSize"
      ) ?? "50",
      10
    );

  const page =
    Number.isFinite(
      requestedPage
    )
      ? Math.max(
          1,
          requestedPage
        )
      : 1;

  const pageSize =
    Number.isFinite(
      requestedPageSize
    )
      ? Math.min(
          50,
          Math.max(
            1,
            requestedPageSize
          )
        )
      : 50;

  const offset =
    (page - 1) * pageSize;

  const totalRow =
    await env.DB.prepare(
      `
        SELECT COUNT(*) AS total
        FROM runs
        WHERE status = 'completed'
      `
    ).first<{
      total: number;
    }>();

  const total =
    Number(
      totalRow?.total ?? 0
    );

  const rows =
    await env.DB.prepare(
      `
        SELECT
          rank,
          player_name,
          elapsed_ms,
          deaths,
          hits,
          ranked_ms,
          finished_at
        FROM (
          SELECT
            ROW_NUMBER() OVER (
              ORDER BY
                ranked_ms ASC,
                deaths ASC,
                hits ASC,
                elapsed_ms ASC,
                finished_at ASC
            ) AS rank,
            player_name,
            elapsed_ms,
            deaths,
            hits,
            ranked_ms,
            finished_at
          FROM runs
          WHERE status = 'completed'
        )
        LIMIT ? OFFSET ?
      `
    ).bind(
      pageSize,
      offset
    ).all<{
      rank: number;
      player_name: string;
      elapsed_ms: number;
      deaths: number;
      hits: number;
      ranked_ms: number;
      finished_at: number;
    }>();

  const entries =
    (rows.results ?? []).map(
      row => ({
        rank:
          Number(row.rank),
        playerName:
          row.player_name,
        elapsedMs:
          Number(
            row.elapsed_ms
          ),
        deaths:
          Number(row.deaths),
        hits:
          Number(row.hits),
        rankedMs:
          Number(
            row.ranked_ms
          ),
        completedAt:
          Number(
            row.finished_at
          )
      })
    );

  return json(
    {
      entries,
      page,
      pageSize,
      total,
      pages:
        Math.ceil(
          total / pageSize
        )
    },
    200,
    {
      "cache-control":
        "public, max-age=15"
    }
  );
}

async function handleApi(
  request: Request,
  env: Env
): Promise<Response> {
  const url =
    new URL(request.url);

  if (
    request.method ===
      "OPTIONS"
  ) {
    return new Response(null, {
      status: 204,
      headers:
        corsHeaders(
          request,
          env
        )
    });
  }

  if (
    request.method === "GET" &&
    url.pathname ===
      "/api/config"
  ) {
    return json({
      turnstileSiteKey:
        env.TURNSTILE_SITE_KEY ??
        "",
      buildVersion:
        env.BUILD_VERSION
    });
  }

  if (
    request.method === "GET" &&
    url.pathname ===
      "/api/leaderboard"
  ) {
    return getLeaderboard(
      url,
      env
    );
  }

  if (
    request.method === "POST" &&
    url.pathname ===
      "/api/runs"
  ) {
    return startRun(
      request,
      env
    );
  }

  const eventMatch =
    /^\/api\/runs\/([0-9a-f-]+)\/events$/.exec(
      url.pathname
    );

  if (
    request.method === "POST" &&
    eventMatch
  ) {
    return recordEvent(
      request,
      env,
      eventMatch[1] ?? ""
    );
  }

  const finishMatch =
    /^\/api\/runs\/([0-9a-f-]+)\/finish$/.exec(
      url.pathname
    );

  if (
    request.method === "POST" &&
    finishMatch
  ) {
    return finishRun(
      request,
      env,
      finishMatch[1] ?? ""
    );
  }

  return json(
    {
      error: "Not found"
    },
    404
  );
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url =
      new URL(request.url);

    try {
      if (
        url.pathname.startsWith(
          "/api/"
        )
      ) {
        const response =
          await handleApi(
            request,
            env
          );

        const headers =
          new Headers(
            response.headers
          );

        for (
          const [key, value] of
          Object.entries(
            corsHeaders(
              request,
              env
            )
          )
        ) {
          headers.set(
            key,
            value
          );
        }

        headers.set(
          "x-content-type-options",
          "nosniff"
        );

        headers.set(
          "referrer-policy",
          "strict-origin-when-cross-origin"
        );

        return new Response(
          response.body,
          {
            status:
              response.status,
            statusText:
              response.statusText,
            headers
          }
        );
      }

      return env.ASSETS.fetch(
        request
      );
    } catch (error) {
      console.error(error);

      if (
        url.pathname.startsWith(
          "/api/"
        )
      ) {
        return json(
          {
            error:
              "Internal server error"
          },
          500
        );
      }

      return env.ASSETS.fetch(
        request
      );
    }
  }
};
