import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const manifestPath = path.join(
  root,
  "public/assets/audio/audio-manifest.json"
);

const manifest = JSON.parse(
  fs.readFileSync(
    manifestPath,
    "utf8"
  )
);

const ids = new Set(
  manifest.assets.map(asset => asset.id)
);

const sourceFiles = [];

function walk(directory) {
  for (
    const entry of
    fs.readdirSync(
      directory,
      { withFileTypes: true }
    )
  ) {
    const fullPath =
      path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (
      /\.(ts|tsx)$/.test(entry.name)
    ) {
      sourceFiles.push(fullPath);
    }
  }
}

walk(path.join(root, "src"));

const combined =
  sourceFiles
    .map(file =>
      fs.readFileSync(file, "utf8")
    )
    .join("\n");

/*
 * Nur direkte Aufrufe der typisierten Audio-API prüfen.
 * Allgemeine String-Literale dürfen nicht ausgewertet werden,
 * weil Animations-Tags dieselben Präfixe wie Audio-IDs nutzen.
 *
 * Zonen und Tag-Mappings werden zusätzlich durch TypeScript als
 * AudioAssetId typisiert.
 */
const references =
  new Set(
    [...combined.matchAll(
      /(?:this\.audio\.play|playSpatial|\.setMusic|\.setAmbience|playVoiceOnce)\(\s*["']([a-z0-9_]+)["']/g
    )].map(match => match[1])
  );

const missing =
  [...references]
    .filter(id => !ids.has(id))
    .sort();

const loadPlanSource =
  fs.readFileSync(
    path.join(
      root,
      "src/audio/AudioLoadPlan.ts"
    ),
    "utf8"
  );

const loadPlanReferences =
  new Set(
    [...loadPlanSource.matchAll(
      /["']([a-z0-9_]+)["']/g
    )]
      .map(match => match[1])
      .filter(id =>
        /^(?:music|amb|vo|boss|finale|cane|combo|grand|spotlight|enemy|stagehand|card_enemy|acrobat|wraith|sentry|echo|core_mime|player|world|ui)_/.test(id)
      )
  );

const invalidLoadPlanIds =
  [...loadPlanReferences]
    .filter(id => !ids.has(id))
    .sort();

if (invalidLoadPlanIds.length > 0) {
  console.error(
    "Unknown load-plan audio IDs:",
    invalidLoadPlanIds
  );
  process.exit(1);
}

if (missing.length > 0) {
  console.error(
    "Unknown directly referenced audio IDs:",
    missing
  );
  process.exit(1);
}

for (const asset of manifest.assets) {
  for (
    const role of
    ["primary", "fallback"]
  ) {
    const relative =
      asset[role].url.replace(
        /^\/assets\/audio\//,
        ""
      );

    const file =
      path.join(
        root,
        "public/assets/audio",
        relative
      );

    if (!fs.existsSync(file)) {
      console.error(
        `Missing runtime file: ${file}`
      );
      process.exit(1);
    }
  }
}

console.log(
  `Audio runtime references valid: ` +
  `${references.size} direct IDs, ` +
  `${loadPlanReferences.size} load-plan IDs, ` +
  `${ids.size} manifest IDs.`
);
