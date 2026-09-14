import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const canonicalAudioCommit =
  "cfa1cd19bc8e1658bd8d18e8963ec335f12c4e30";
const runtimeRoot = path.join(root, "public/assets/audio");
const sourceRoot = path.join(root, "assets/source/audio");
const reportDirectory = path.join(
  root,
  "node_modules/.cache/audio-catalog"
);
const reportPath = path.join(
  reportDirectory,
  "audio-inventory.json"
);

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(root, relativePath), "utf8")
  );
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function walkFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function repositoryPath(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function exactCasePathExists(file) {
  const relative = path.relative(root, file);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }

  let current = root;

  for (const segment of relative.split(path.sep)) {
    const names = fs.readdirSync(current);

    if (!names.includes(segment)) {
      return false;
    }

    current = path.join(current, segment);
  }

  return true;
}

function gitTree(commit, prefixes) {
  const output = execFileSync(
    "git",
    ["ls-tree", "-r", commit, "--", ...prefixes],
    { cwd: root, encoding: "utf8" }
  );
  const entries = new Map();

  for (const line of output.trim().split("\n")) {
    if (!line) {
      continue;
    }

    const match = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);

    if (match) {
      entries.set(match[2], match[1]);
    }
  }

  return entries;
}

function currentGitBlob(file) {
  return execFileSync(
    "git",
    ["hash-object", file],
    { cwd: root, encoding: "utf8" }
  ).trim();
}

function extractObjectBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing source marker: ${marker}`);
  const assignment = source.indexOf("=", start);
  const arrayStart = source.indexOf("[", assignment);
  let depth = 0;

  for (let index = arrayStart; index < source.length; index += 1) {
    if (source[index] === "[") {
      depth += 1;
    } else if (source[index] === "]") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(arrayStart, index + 1);
      }
    }
  }

  throw new Error(`Unterminated source block: ${marker}`);
}

function parseSectionAssignments(bridgeSource) {
  const block = extractObjectBlock(
    bridgeSource,
    "SECTION_AUDIO_ASSIGNMENTS"
  );
  const assignments = [];

  for (const match of block.matchAll(/\{([\s\S]*?)\}/g)) {
    const body = match[1];
    const section = body.match(/section:\s*"([^"]+)"/)?.[1];
    const music = body.match(/music:\s*"([^"]+)"/)?.[1];
    const ambience = body.match(/ambience:\s*"([^"]+)"/)?.[1];
    const voice = body.match(/voice:\s*"([^"]+)"/)?.[1] ?? null;

    if (section && music && ambience) {
      assignments.push({ section, music, ambience, voice });
    }
  }

  return assignments;
}

function parseWorldSections(layoutSource) {
  const block = extractObjectBlock(layoutSource, "WORLD_SECTIONS");

  return [...block.matchAll(
    /\{\s*id:\s*"([^"]+)",\s*startX:\s*(\d+),\s*endX:\s*(\d+)/g
  )].map(match => ({
    id: match[1],
    startX: Number(match[2]),
    endX: Number(match[3])
  }));
}

function allSourceReferences() {
  const references = new Map();
  const sourceFiles = walkFiles(path.join(root, "src"))
    .filter(file => /\.(?:ts|tsx)$/.test(file));

  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, "utf8");

    for (const match of source.matchAll(/["']([a-z0-9_]+)["']/g)) {
      const id = match[1];
      const files = references.get(id) ?? new Set();
      files.add(repositoryPath(file));
      references.set(id, files);
    }
  }

  return references;
}

function classify(asset, sectionAssignments) {
  const sectionUses = sectionAssignments
    .filter(item => item.music === asset.id)
    .map(item => item.section);

  if (/^music_1[0-2]_conductor_phase_/.test(asset.id)) {
    return {
      classification: "MirrorConductor phase theme",
      purpose: asset.id.replace("music_", "boss ").replaceAll("_", " ")
    };
  }

  if (asset.id === "music_13_finale") {
    return {
      classification: "finale/completion audio",
      purpose: "MirrorConductor defeat finale soundtrack"
    };
  }

  if (asset.bus === "music") {
    return {
      classification: "section soundtrack",
      purpose: sectionUses.join(", ")
    };
  }

  if (asset.bus === "voice") {
    return {
      classification: "dialogue/voice",
      purpose: asset.id.replace(/^vo_/, "").replaceAll("_", " ")
    };
  }

  if (asset.bus === "ambience") {
    return {
      classification: "ambience",
      purpose: asset.id.replace(/^amb_/, "").replaceAll("_", " ")
    };
  }

  if (asset.id.startsWith("ui_")) {
    return {
      classification: "UI sound",
      purpose: asset.id.replace(/^ui_/, "").replaceAll("_", " ")
    };
  }

  if (asset.id.startsWith("finale_")) {
    return {
      classification: "finale/completion audio",
      purpose: asset.id.replace(/^finale_/, "").replaceAll("_", " ")
    };
  }

  return {
    classification: "SFX",
    purpose: `${asset.category}: ${asset.id.replaceAll("_", " ")}`
  };
}

const spec = readJson("assets/audio-spec.json");
const sourceManifest = readJson(
  "assets/source/audio/audio-source-manifest.json"
);
const runtimeManifest = readJson(
  "public/assets/audio/audio-manifest.json"
);
const registrySource = readSource("src/audio/AudioManifest.ts");
const loadPlanSource = readSource("src/audio/AudioLoadPlan.ts");
const bridgeSource = readSource("src/audio/AudioRuntimeBridge.ts");
const layoutSource = readSource("src/world/WorldLayout.ts");
const phaseSource = readSource("src/world/MirrorConductorPhase.ts");
const sourceReferences = allSourceReferences();
const sectionAssignments = parseSectionAssignments(bridgeSource);
const worldSections = parseWorldSections(layoutSource);

const errors = [];
const warn = message => errors.push(message);
const logicalIds = runtimeManifest.assets.map(asset => asset.id);
const logicalIdSet = new Set(logicalIds);
const duplicateKeys = logicalIds.filter(
  (id, index) => logicalIds.indexOf(id) !== index
);

if (spec.expectedAssetCount !== runtimeManifest.assetCount) {
  warn("Audio specification count does not match runtime manifest");
}

if (sourceManifest.assetCount !== runtimeManifest.assetCount) {
  warn("Source and runtime manifest logical counts differ");
}

if (duplicateKeys.length > 0) {
  warn(`Duplicate logical keys: ${duplicateKeys.join(", ")}`);
}

const specIds = new Set(spec.assets.map(asset => asset.id));
const sourceById = new Map(
  sourceManifest.assets.map(asset => [asset.id, asset])
);
const registryIds = new Set(
  [...registrySource.matchAll(/"id":\s*"([^"]+)"/g)]
    .map(match => match[1])
);
const loadPlanIds = new Set(
  [...loadPlanSource.matchAll(/["']([a-z0-9_]+)["']/g)]
    .map(match => match[1])
    .filter(id => logicalIdSet.has(id))
);

for (const id of logicalIds) {
  if (!specIds.has(id)) {
    warn(`Runtime key missing from audio specification: ${id}`);
  }

  if (!sourceById.has(id)) {
    warn(`Runtime key missing from source manifest: ${id}`);
  }

  if (!registryIds.has(id)) {
    warn(`Runtime key missing from TypeScript registry: ${id}`);
  }

  if (!loadPlanIds.has(id)) {
    warn(`Runtime key is not preloaded by any section: ${id}`);
  }
}

const directAudioReferences = new Set(
  [...bridgeSource.matchAll(
    /(?:this\.audio\.play|this\.playSpatial|this\.playVoiceOnce|this\.music\.setMusic|this\.music\.setAmbience)\(\s*["']([a-z0-9_]+)["']/g
  )].map(match => match[1])
);

for (const id of directAudioReferences) {
  if (!logicalIdSet.has(id)) {
    warn(`Referenced audio key is absent from manifest: ${id}`);
  }
}

const expectedSections = [
  "MovementRehearsal",
  "CombatRehearsal",
  "MainStage",
  "GrandGallery",
  "GalleryGauntlet",
  "SpotlightVault",
  "CardSanctum",
  "RoyalBox",
  "MirrorCore",
  "ConductorApproach",
  "MirrorConductor"
];

if (JSON.stringify(worldSections.map(item => item.id)) !== JSON.stringify(expectedSections)) {
  warn("Generated WORLD_SECTIONS does not contain the authoritative eleven-section order");
}

if (sectionAssignments.length !== expectedSections.length) {
  warn(`Expected 11 section audio assignments, found ${sectionAssignments.length}`);
}

for (let index = 0; index < expectedSections.length; index += 1) {
  const assignment = sectionAssignments[index];
  const section = worldSections[index];

  if (!assignment || assignment.section !== expectedSections[index]) {
    warn(`Missing or misordered theme assignment for ${expectedSections[index]}`);
    continue;
  }

  if (!section || section.id !== assignment.section) {
    warn(`Theme assignment is disconnected from generated section ${assignment.section}`);
  }

  const asset = runtimeManifest.assets.find(item => item.id === assignment.music);

  if (!asset || asset.bus !== "music") {
    warn(`Invalid section theme ${assignment.music} for ${assignment.section}`);
  }

  const sectionLoadBlock = loadPlanSource.match(
    new RegExp(`${assignment.section}: \\[([\\s\\S]*?)\\n  \\]`)
  )?.[1] ?? "";

  const themeIsPreloaded =
    sectionLoadBlock.includes(`"${assignment.music}"`) ||
    (
      assignment.section === "MovementRehearsal" &&
      loadPlanSource
        .slice(
          loadPlanSource.indexOf("BOOTSTRAP_AUDIO_IDS"),
          loadPlanSource.indexOf("SECTION_AUDIO_IDS")
        )
        .includes(`"${assignment.music}"`)
    );

  if (!themeIsPreloaded) {
    warn(`Section theme is not preloaded for ${assignment.section}: ${assignment.music}`);
  }
}

const bossThemeIds = [
  "music_10_conductor_phase_1",
  "music_11_conductor_phase_2",
  "music_12_conductor_phase_3"
];

for (const id of bossThemeIds) {
  const asset = runtimeManifest.assets.find(item => item.id === id);

  if (!asset || asset.bus !== "music" || asset.loop !== true) {
    warn(`Invalid boss phase theme definition: ${id}`);
  }
}

if (!bridgeSource.includes('section: "MirrorConductor"') ||
    !bridgeSource.includes('music: "music_10_conductor_phase_1"') ||
    !bridgeSource.includes('"music_11_conductor_phase_2"') ||
    !bridgeSource.includes('"music_12_conductor_phase_3"') ||
    !bridgeSource.includes('"music_13_finale"')) {
  warn("MirrorConductor phase/finale mapping is incomplete");
}

for (const [phase, seconds] of [[1, 55], [2, 60], [3, 70]]) {
  const pattern = new RegExp(`${phase}:\\s*${seconds}(?:,|\\s*\\})`);

  if (!pattern.test(phaseSource)) {
    warn(`MirrorConductor phase ${phase} guard is not ${seconds} seconds`);
  }
}

const canonicalTree = gitTree(canonicalAudioCommit, [
  "assets/source/audio",
  "public/assets/audio"
]);
const parentTree = gitTree("HEAD", [
  "assets/source/audio",
  "public/assets/audio"
]);
const actualRuntimeFiles = walkFiles(runtimeRoot)
  .filter(file => /\.(?:ogg|mp3)$/.test(file));
const actualSourceFiles = walkFiles(sourceRoot)
  .filter(file => /\.wav$/.test(file));
const actualPhysicalFiles = [...actualRuntimeFiles, ...actualSourceFiles];
const referencedPhysicalPaths = new Set();
const duplicatePathOwners = new Map();
const inventory = [];
let missingFiles = 0;
let corruptedFiles = 0;
let historicalParityFailures = 0;
let buildMissingFiles = 0;

for (const asset of runtimeManifest.assets) {
  const sourceAsset = sourceById.get(asset.id);
  const { classification, purpose } = classify(asset, sectionAssignments);
  const files = [];

  if (!sourceAsset) {
    continue;
  }

  const physicalDefinitions = [
    {
      role: "source",
      relativePath: `assets/source/audio/${sourceAsset.sourceFile}`,
      format: "wav",
      expectedHash: sourceAsset.sourceSha256,
      expectedSize: Number(sourceAsset.probe.format.size)
    },
    ...["primary", "fallback"].map(role => ({
      role,
      relativePath: `public${asset[role].url}`,
      format: asset[role].container,
      expectedHash: asset[role].sha256,
      expectedSize: Number(asset[role].probe.format.size)
    }))
  ];

  for (const definition of physicalDefinitions) {
    const file = path.join(root, definition.relativePath);
    const owners = duplicatePathOwners.get(definition.relativePath) ?? [];
    owners.push(asset.id);
    duplicatePathOwners.set(definition.relativePath, owners);
    referencedPhysicalPaths.add(definition.relativePath);

    const exists = fs.existsSync(file);
    const size = exists ? fs.statSync(file).size : 0;
    const hash = exists ? sha256(file) : null;
    const caseExact = exists && exactCasePathExists(file);
    const validExtension = new RegExp(`\\.${definition.format}$`, "i").test(file);
    const repositoryBlob = exists ? currentGitBlob(file) : null;
    const canonicalBlob = canonicalTree.get(definition.relativePath) ?? null;
    const parentBlob = parentTree.get(definition.relativePath) ?? null;
    const inCanonicalAudioCommit = canonicalBlob !== null;
    const canonicalParity = repositoryBlob !== null && repositoryBlob === canonicalBlob;
    const parentParity = repositoryBlob !== null && repositoryBlob === parentBlob;

    if (!exists) {
      missingFiles += 1;
      warn(`Missing physical audio file: ${definition.relativePath}`);
    } else if (
      size <= 0 ||
      size !== definition.expectedSize ||
      hash !== definition.expectedHash ||
      !caseExact ||
      !validExtension
    ) {
      corruptedFiles += 1;
      warn(`Invalid physical audio file: ${definition.relativePath}`);
    }

    if (!inCanonicalAudioCommit || !canonicalParity || !parentParity) {
      historicalParityFailures += 1;
      warn(`Audio history parity failure: ${definition.relativePath}`);
    }

    if (process.env.AUDIO_REQUIRE_BUILD === "1" && definition.role !== "source") {
      const builtFile = path.join(
        root,
        "dist",
        asset[definition.role].url.replace(/^\//, "")
      );

      if (!fs.existsSync(builtFile) || sha256(builtFile) !== hash) {
        buildMissingFiles += 1;
        warn(`Production build is missing/corrupt: ${repositoryPath(builtFile)}`);
      }
    }

    files.push({
      role: definition.role,
      repositoryPath: definition.relativePath,
      loadPath: definition.role === "source" ? null : asset[definition.role].url,
      format: definition.format,
      byteSize: size,
      sha256: hash,
      caseExact,
      nonEmpty: size > 0,
      inCanonicalAudioCommit,
      canonicalParity,
      parentParity
    });
  }

  const references = [...(sourceReferences.get(asset.id) ?? [])].sort();
  const preloaded = loadPlanIds.has(asset.id);
  const directlyReferenced = references.some(file =>
    file !== "src/audio/AudioManifest.ts" &&
    file !== "src/audio/AudioLoadPlan.ts"
  );

  inventory.push({
    logicalKey: asset.id,
    category: asset.category,
    bus: asset.bus,
    classification:
      directlyReferenced
        ? classification
        : "unused but intentionally retained asset",
    purpose,
    aliasOf: asset.aliasOf,
    loop: asset.loop,
    referencingSourceFiles: references,
    intendedSectionEventPhase: purpose,
    currentReachability: preloaded
      ? directlyReferenced
        ? "preloaded and event/theme referenced"
        : "preloaded retained catalog asset"
      : "unreachable",
    existedInCanonicalAudioCommit: files.every(file => file.inCanonicalAudioCommit),
    files
  });
}

const orphanedFiles = actualPhysicalFiles
  .map(repositoryPath)
  .filter(file => !referencedPhysicalPaths.has(file))
  .sort();
const unreachableAssets = inventory
  .filter(item => item.currentReachability === "unreachable")
  .map(item => item.logicalKey);
const duplicatePathGroups = [...duplicatePathOwners]
  .filter(([, owners]) => owners.length > 1)
  .map(([physicalPath, owners]) => ({ physicalPath, owners }));
const deliberateAliasPathGroups = duplicatePathGroups.filter(group =>
  group.owners.some(id => runtimeManifest.assets.find(asset => asset.id === id)?.aliasOf)
);
const unexpectedDuplicatePathGroups = duplicatePathGroups.filter(group =>
  !deliberateAliasPathGroups.includes(group)
);

if (orphanedFiles.length > 0) {
  warn(`Orphaned physical files: ${orphanedFiles.join(", ")}`);
}

if (unreachableAssets.length > 0) {
  warn(`Unreachable logical assets: ${unreachableAssets.join(", ")}`);
}

if (unexpectedDuplicatePathGroups.length > 0) {
  warn("Unexpected duplicate physical paths found");
}

const counts = {
  physicalAudioFiles: actualPhysicalFiles.length,
  runtimePhysicalFiles: actualRuntimeFiles.length,
  sourcePhysicalFiles: actualSourceFiles.length,
  logicalKeys: logicalIds.length,
  sfx: runtimeManifest.assets.filter(asset => asset.bus === "sfx").length,
  dialogueVoice: runtimeManifest.assets.filter(asset => asset.bus === "voice").length,
  sectionThemeAssignments: sectionAssignments.length,
  uniqueSectionThemeFiles: new Set(sectionAssignments.map(item => item.music)).size,
  bossThemeParts: bossThemeIds.length,
  ambience: runtimeManifest.assets.filter(asset => asset.bus === "ambience").length,
  ui: runtimeManifest.assets.filter(asset => asset.id.startsWith("ui_")).length,
  finale: runtimeManifest.assets.filter(asset =>
    asset.id === "music_13_finale" || asset.id.startsWith("finale_")
  ).length,
  missingFiles,
  corruptedFiles,
  duplicateKeys: new Set(duplicateKeys).size,
  duplicatePathGroups: duplicatePathGroups.length,
  deliberateAliasPathGroups: deliberateAliasPathGroups.length,
  orphanedAssets: orphanedFiles.length,
  unreachableAssets: unreachableAssets.length,
  historicalParityFailures,
  buildMissingFiles
};

const report = {
  schemaVersion: 1,
  canonicalAudioCommit,
  generatedAt: new Date().toISOString(),
  counts,
  sectionThemeMatrix: sectionAssignments.map((assignment, index) => ({
    ...worldSections[index],
    ...assignment,
    nextSection: sectionAssignments[index + 1]?.section ?? null,
    nextTheme: sectionAssignments[index + 1]?.music ?? null
  })),
  bossThemeMatrix: bossThemeIds.map((id, index) => ({
    phase: index + 1,
    logicalKey: id,
    minimumDurationSeconds: [55, 60, 70][index],
    startTrigger: index === 0
      ? "MirrorConductor section entry"
      : `boss_transition_${index}_${index + 1}`,
    nextTheme: bossThemeIds[index + 1] ?? "music_13_finale"
  })),
  duplicatePathGroups,
  orphanedFiles,
  unreachableAssets,
  inventory,
  errors
};

fs.mkdirSync(reportDirectory, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Audio inventory report: ${repositoryPath(reportPath)}`);
console.log(`AUDIO_FILES_TOTAL=${counts.physicalAudioFiles}`);
console.log(`AUDIO_RUNTIME_FILES=${counts.runtimePhysicalFiles}`);
console.log(`AUDIO_SOURCE_FILES=${counts.sourcePhysicalFiles}`);
console.log(`AUDIO_LOGICAL_KEYS_TOTAL=${counts.logicalKeys}`);
console.log(`SECTION_THEME_ASSIGNMENTS=${counts.sectionThemeAssignments}`);
console.log(`SECTION_THEME_UNIQUE_FILES=${counts.uniqueSectionThemeFiles}`);
console.log(`BOSS_THEME_PARTS=${counts.bossThemeParts}`);
console.log(`SFX_TOTAL=${counts.sfx}`);
console.log(`DIALOGUE_VOICE_TOTAL=${counts.dialogueVoice}`);
console.log(`AMBIENCE_TOTAL=${counts.ambience}`);
console.log(`UI_AUDIO_TOTAL=${counts.ui}`);
console.log(`FINALE_AUDIO_TOTAL=${counts.finale}`);
console.log(`MISSING_AUDIO_FILES=${counts.missingFiles}`);
console.log(`CORRUPTED_AUDIO_FILES=${counts.corruptedFiles}`);
console.log(`UNREACHABLE_AUDIO_ASSETS=${counts.unreachableAssets}`);
console.log(`DUPLICATE_AUDIO_KEYS=${counts.duplicateKeys}`);
console.log(`DUPLICATE_AUDIO_PATH_GROUPS=${counts.duplicatePathGroups}`);
console.log(`DELIBERATE_ALIAS_PATH_GROUPS=${counts.deliberateAliasPathGroups}`);
console.log(`ORPHANED_AUDIO_FILES=${counts.orphanedAssets}`);
console.log(`HISTORICAL_PARITY_FAILURES=${counts.historicalParityFailures}`);
console.log(`BUILD_AUDIO_FAILURES=${counts.buildMissingFiles}`);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("SFX_CATALOG_RESULT=PASS");
console.log("DIALOGUE_CATALOG_RESULT=PASS");
console.log("USER_COMPOSITIONS_PRESERVED=1");
