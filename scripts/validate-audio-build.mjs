import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const expectQaHook = process.argv.includes("--qa");
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "public/assets/audio/audio-manifest.json"
    ),
    "utf8"
  )
);

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

assert.ok(
  fs.existsSync(dist),
  "dist must exist before audio build validation"
);

const javascript = fs.readdirSync(
  path.join(dist, "assets")
)
  .filter(name => name.endsWith(".js"))
  .map(name =>
    fs.readFileSync(
      path.join(dist, "assets", name),
      "utf8"
    )
  )
  .join("\n");
const hookPresent =
  javascript.includes(
    "__IMPRESSARIO_AUDIO_DEBUG__"
  );

assert.equal(
  hookPresent,
  expectQaHook,
  expectQaHook
    ? "QA production build must expose the read-only audio snapshot hook"
    : "ordinary production build must not contain the QA audio hook"
);

let checkedFiles = 0;

for (const asset of manifest.assets) {
  for (const role of ["primary", "fallback"]) {
    const source = path.join(
      root,
      "public",
      asset[role].url.replace(/^\//, "")
    );
    const built = path.join(
      dist,
      asset[role].url.replace(/^\//, "")
    );

    assert.ok(
      fs.existsSync(built),
      `Production build is missing ${asset[role].url}`
    );
    assert.equal(
      fs.statSync(built).size,
      fs.statSync(source).size,
      `Production build size mismatch for ${asset[role].url}`
    );
    assert.equal(
      sha256(built),
      asset[role].sha256,
      `Production build hash mismatch for ${asset[role].url}`
    );
    checkedFiles += 1;
  }
}

console.log(
  `Audio production build valid: ${checkedFiles} files, ` +
  `QA hook ${hookPresent ? "present" : "absent"}.`
);
