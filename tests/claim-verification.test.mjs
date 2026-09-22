import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import worker, {
  normalizeClaimCode
} from "../worker/src/index.ts";

const FORMATTED_CODE = "ABCD-EFGH-JKLM-NPQR";
const COMPACT_CODE = "abcdefghjklmnpqr";

function createDatabase(row = null) {
  const calls = [];

  return {
    calls,
    prepare(query) {
      const call = {
        query,
        values: []
      };
      calls.push(call);

      return {
        bind(...values) {
          call.values = values;
          return this;
        },
        async first() {
          return row;
        },
        async all() {
          return {
            success: true,
            results: []
          };
        },
        async run() {
          return {
            success: true
          };
        }
      };
    }
  };
}

function createLimiter(success = true) {
  const keys = [];

  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      return { success };
    }
  };
}

function createEnvironment({
  row = null,
  limiter = createLimiter()
} = {}) {
  const DB = createDatabase(row);

  return {
    DB,
    limiter,
    env: {
      DB,
      ASSETS: {
        fetch: () =>
          Promise.resolve(
            new Response("not used")
          )
      },
      START_LIMITER: createLimiter(),
      CLAIM_VERIFY_LIMITER: limiter,
      TURNSTILE_SITE_KEY: "test",
      TURNSTILE_SECRET_KEY: "",
      ALLOWED_ORIGIN: "https://example.test",
      BUILD_VERSION: "test-build",
      ENVIRONMENT: "development"
    }
  };
}

async function requestClaim(env, code) {
  const response = await worker.fetch(
    new Request(
      "https://example.test/api/claims/verify",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "CF-Connecting-IP": "203.0.113.7"
        },
        body: JSON.stringify({ code })
      }
    ),
    env
  );

  return {
    response,
    body: await response.json()
  };
}

test("claim verification uses a dedicated non-colliding limiter namespace", async () => {
  const config = JSON.parse(
    await readFile(
      new URL("../wrangler.jsonc", import.meta.url),
      "utf8"
    )
  );
  const namespaces = Object.fromEntries(
    config.ratelimits.map(binding => [
      binding.name,
      binding.namespace_id
    ])
  );

  assert.equal(namespaces.START_LIMITER, "1001");
  assert.equal(namespaces.CLAIM_VERIFY_LIMITER, "1002");
  assert.notEqual(
    namespaces.START_LIMITER,
    namespaces.CLAIM_VERIFY_LIMITER
  );
});

test("claim normalization accepts mixed case and optional separators", () => {
  assert.equal(
    normalizeClaimCode(COMPACT_CODE),
    FORMATTED_CODE
  );
  assert.equal(
    normalizeClaimCode("abcd efgh-jklm npqr"),
    FORMATTED_CODE
  );
  assert.equal(
    normalizeClaimCode(FORMATTED_CODE),
    FORMATTED_CODE
  );

  for (const malformed of [
    "",
    "   ",
    "ABCD-EFGH-JKLM-NPQ",
    "ABCD-EFGH-IJKL-MNPQ",
    "ABCD-EFGH-JKLM-NP0R",
    null
  ]) {
    assert.equal(
      normalizeClaimCode(malformed),
      null,
      String(malformed)
    );
  }
});

test("known claim returns only the documented run summary", async () => {
  const row = {
    rank: 3,
    player_name: "Midnight Player",
    elapsed_ms: 123_456,
    ranked_ms: 173_456,
    deaths: 1,
    hits: 1,
    build_version: "0.7.0",
    finished_at: 1_795_000_000_000
  };
  const { env, DB, limiter } =
    createEnvironment({ row });
  const { response, body } =
    await requestClaim(env, COMPACT_CODE);

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    rank: 3,
    playerName: "Midnight Player",
    elapsedMs: 123_456,
    rankedMs: 173_456,
    deaths: 1,
    hits: 1,
    buildVersion: "0.7.0",
    completedAt: 1_795_000_000_000
  });
  assert.deepEqual(
    Object.keys(body).sort(),
    [
      "buildVersion",
      "completedAt",
      "deaths",
      "elapsedMs",
      "hits",
      "playerName",
      "rank",
      "rankedMs"
    ]
  );
  assert.equal(limiter.keys[0], "203.0.113.7");
  assert.equal(DB.calls.length, 1);
  assert.match(DB.calls[0].query, /runs\.claim_hash = \?/);
  assert.doesNotMatch(
    JSON.stringify(body),
    new RegExp(FORMATTED_CODE, "i")
  );

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(FORMATTED_CODE)
  );
  const expectedHash = Array.from(
    new Uint8Array(digest),
    value => value.toString(16).padStart(2, "0")
  ).join("");
  assert.equal(DB.calls[0].values[0], expectedHash);
});

test("unknown claims share one generic 404 without echoing input", async () => {
  const first = createEnvironment();
  const second = createEnvironment();
  const firstResult = await requestClaim(
    first.env,
    "ABCD-EFGH-JKLM-NPQR"
  );
  const secondResult = await requestClaim(
    second.env,
    "2345-6789-ABCD-EFGH"
  );

  assert.equal(firstResult.response.status, 404);
  assert.equal(secondResult.response.status, 404);
  assert.deepEqual(
    firstResult.body,
    { error: "Code not found" }
  );
  assert.deepEqual(
    secondResult.body,
    firstResult.body
  );
  assert.doesNotMatch(
    JSON.stringify(firstResult.body),
    /ABCD-EFGH-JKLM-NPQR/
  );
});

test("limiter runs before hashing and database access", async () => {
  const limiter = createLimiter(false);
  const { env, DB } =
    createEnvironment({ limiter });
  const { response, body } =
    await requestClaim(env, FORMATTED_CODE);

  assert.equal(response.status, 429);
  assert.deepEqual(body, {
    error:
      "Too many verification attempts. Please wait one minute and try again."
  });
  assert.equal(DB.calls.length, 0);
  assert.equal(limiter.keys.length, 1);
});

test("malformed input cannot query nullable hashes and a missing limiter is a clear 503", async () => {
  const malformed = createEnvironment();
  const malformedResult =
    await requestClaim(malformed.env, "   ");
  assert.equal(malformedResult.response.status, 400);
  assert.deepEqual(
    malformedResult.body,
    { error: "Invalid claim code" }
  );
  assert.equal(malformed.DB.calls.length, 0);

  const missing = createEnvironment();
  delete missing.env.CLAIM_VERIFY_LIMITER;
  const missingResult =
    await requestClaim(missing.env, FORMATTED_CODE);
  assert.equal(missingResult.response.status, 503);
  assert.deepEqual(missingResult.body, {
    error:
      "Claim verification is temporarily unavailable"
  });
  assert.equal(missing.DB.calls.length, 0);
});
