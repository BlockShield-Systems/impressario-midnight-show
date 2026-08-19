#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(
    subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
    ).stdout.strip()
).resolve()

INCOMING = ROOT / "assets/incoming/audio"
SOURCE = ROOT / "assets/source/audio"
PUBLIC = ROOT / "public/assets/audio"
SPEC_FILE = ROOT / "assets/audio-spec.json"
SOURCE_MANIFEST = SOURCE / "audio-source-manifest.json"
RUNTIME_MANIFEST = PUBLIC / "audio-manifest.json"

AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}

MUSIC_SOURCE_GLOBS = {
    "music_01_opening_rehearsal":
        "music_01_opening_rehearsal_raw_*.mp3",
    "music_02_combat_rehearsal":
        "music_02_combat_rehearsal_raw_*.mp3",
    "music_03_backstage_ambush":
        "music_03_backstage_ambush_raw_*.mp3",
    "music_04_grand_gallery":
        "music_04_grand_gallery_raw_*.mp3",
    "music_05_gallery_gauntlet":
        "music_05_gallery_gauntlet_raw_*.mp3",
    "music_06_spotlight_vault":
        "music_06_spotlight_vault_raw_*.mp3",
    "music_07_card_sanctum":
        "music_07_card_sanctum_raw_*.mp3",
    "music_08_royal_box":
        "music_08_royal_box_raw_*.mp3",
    "music_09_mirror_core":
        "music_09_mirror_core_raw_*.mp3",
    "music_10_conductor_phase_1":
        "music_10_conductor_phase1_raw_*.mp3",
    "music_11_conductor_phase_2":
        "music_11_conductor_phase2_raw_*.mp3",
    "music_12_conductor_phase_3":
        "music_12_conductor_phase3_raw_*.mp3",
    "music_13_finale":
        "music_13_finale_raw_*.mp3",
}


def fail(message: str) -> None:
    raise RuntimeError(message)


def run(
    args: list[str],
    *,
    capture: bool = True,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        args,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )

    if check and result.returncode != 0:
        stderr = result.stderr.strip() if result.stderr else ""
        stdout = result.stdout.strip() if result.stdout else ""
        detail = stderr or stdout
        fail(
            f"Befehl fehlgeschlagen ({result.returncode}): "
            f"{' '.join(args)}\n{detail}"
        )

    return result


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def probe(path: Path) -> dict[str, Any]:
    result = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_name,sample_rate,channels,"
            "channel_layout,bits_per_sample,bit_rate",
            "-show_entries",
            "format=format_name,duration,size,bit_rate",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(result.stdout)


def decode_validate(path: Path) -> None:
    run(
        [
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-v",
            "error",
            "-xerror",
            "-i",
            str(path),
            "-map",
            "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            "-f",
            "null",
            "-",
        ]
    )


def decoded_pcm_sha256(path: Path) -> str:
    result = run(
        [
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-v",
            "error",
            "-xerror",
            "-i",
            str(path),
            "-map",
            "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            "-map_metadata",
            "-1",
            "-acodec",
            "pcm_s24le",
            "-ar",
            "48000",
            "-f",
            "hash",
            "-hash",
            "sha256",
            "-",
        ]
    )

    match = re.search(r"SHA256=([0-9a-fA-F]{64})", result.stdout)
    if not match:
        fail(f"PCM-Hash konnte nicht gelesen werden: {path}")

    return match.group(1).lower()


def extract_loudnorm_json(stderr: str) -> dict[str, str]:
    blocks = re.findall(r"\{\s*\"input_i\".*?\}", stderr, re.DOTALL)
    if not blocks:
        fail("FFmpeg-loudnorm-Ausgabe enthielt keinen JSON-Messblock")

    return json.loads(blocks[-1])


def measure_loudness(path: Path, target_i: float) -> dict[str, str]:
    result = run(
        [
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-v",
            "info",
            "-i",
            str(path),
            "-map",
            "0:a:0",
            "-af",
            f"loudnorm=I={target_i}:TP=-1:LRA=11:print_format=json",
            "-f",
            "null",
            "-",
        ],
        check=True,
    )

    return extract_loudnorm_json(result.stderr)


def resolve_source(asset: dict[str, Any]) -> Path:
    category = asset["category"]
    asset_id = asset["id"]

    if category == "music":
        pattern = MUSIC_SOURCE_GLOBS[asset_id]
        candidates = sorted((INCOMING / "music").glob(pattern))
    else:
        directory = INCOMING / category
        candidates = sorted(
            path
            for path in directory.glob(f"{asset_id}.*")
            if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS
        )

    if len(candidates) != 1:
        fail(
            f"{asset_id}: genau eine Quelle erwartet, "
            f"gefunden={len(candidates)}: "
            f"{[str(path) for path in candidates]}"
        )

    return candidates[0]


def normalize_filter(
    source: Path,
    category: str,
) -> tuple[str, dict[str, str] | None]:
    targets = {
        "music": -16.0,
        "ambience": -22.5,
        "voice/en": -16.0,
    }

    if category not in targets:
        # Vierfaches Oversampling vor dem Limiter reduziert
        # Inter-Sample-Peaks. Kein automatisches SFX-Loudness-Matching.
        return (
            "aresample=192000,"
            "alimiter=limit=0.891251:attack=5:release=50:level=false,"
            "aresample=48000",
            None,
        )

    target = targets[category]
    measured = measure_loudness(source, target)

    required = (
        "input_i",
        "input_tp",
        "input_lra",
        "input_thresh",
        "target_offset",
    )
    if any(key not in measured for key in required):
        fail(f"Unvollständige Loudness-Messung für {source}")

    if not all(
        math.isfinite(float(measured[key]))
        for key in required
    ):
        fail(f"Nicht normalisierbare Loudness-Werte für {source}")

    audio_filter = (
        f"loudnorm=I={target}:TP=-1:LRA=11:"
        f"measured_I={measured['input_i']}:"
        f"measured_TP={measured['input_tp']}:"
        f"measured_LRA={measured['input_lra']}:"
        f"measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:"
        "linear=true:print_format=summary"
    )

    return audio_filter, measured


def prepare() -> None:
    spec = load_json(SPEC_FILE)
    assets = spec["assets"]

    if len(assets) != 95:
        fail(f"Audio-Spezifikation enthält nicht 95 Assets: {len(assets)}")

    temporary = SOURCE.parent / f".audio-preparing-{os.getpid()}"
    shutil.rmtree(temporary, ignore_errors=True)
    temporary.mkdir(parents=True)

    entries: list[dict[str, Any]] = []

    try:
        for index, asset in enumerate(assets, start=1):
            asset_id = asset["id"]
            category = asset["category"]
            source = resolve_source(asset)

            decode_validate(source)

            channels = 2 if category in {"music", "ambience", "boss"} else 1
            destination = temporary / category / f"{asset_id}.wav"
            destination.parent.mkdir(parents=True, exist_ok=True)

            audio_filter, input_measurement = normalize_filter(
                source,
                category,
            )

            print(
                f"[{index:02d}/95] prepare "
                f"{category}/{asset_id} "
                f"({channels}ch)"
            )

            run(
                [
                    "ffmpeg",
                    "-nostdin",
                    "-hide_banner",
                    "-v",
                    "error",
                    "-xerror",
                    "-y",
                    "-i",
                    str(source),
                    "-map",
                    "0:a:0",
                    "-vn",
                    "-sn",
                    "-dn",
                    "-map_metadata",
                    "-1",
                    "-af",
                    audio_filter,
                    "-ar",
                    "48000",
                    "-ac",
                    str(channels),
                    "-c:a",
                    "pcm_s24le",
                    str(destination),
                ]
            )

            decode_validate(destination)
            destination_probe = probe(destination)
            pcm_digest = decoded_pcm_sha256(destination)

            output_measurement = None
            if category in {"music", "ambience", "voice/en"}:
                target = {
                    "music": -16.0,
                    "ambience": -22.5,
                    "voice/en": -16.0,
                }[category]
                output_measurement = measure_loudness(
                    destination,
                    target,
                )

            entries.append(
                {
                    "id": asset_id,
                    "category": category,
                    "bus": asset["bus"],
                    "loop": asset["loop"],
                    "required": True,
                    "sourceInput": source.relative_to(ROOT).as_posix(),
                    "sourceInputSha256": sha256(source),
                    "sourceFile": destination.relative_to(
                        temporary
                    ).as_posix(),
                    "sourceSha256": sha256(destination),
                    "decodedPcmSha256": pcm_digest,
                    "aliasOf": None,
                    "probe": destination_probe,
                    "loudnessInput": input_measurement,
                    "loudnessOutput": output_measurement,
                }
            )

        # Deduplizierung erfolgt erst nach identischer Formatierung,
        # Kanalzuweisung und Normalisierung.
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for entry in entries:
            groups[entry["decodedPcmSha256"]].append(entry)

        duplicate_groups: list[dict[str, Any]] = []

        for digest, group in sorted(groups.items()):
            group.sort(key=lambda item: item["id"])
            owner = group[0]

            if len(group) == 1:
                continue

            aliases: list[str] = []

            for alias in group[1:]:
                alias_path = temporary / alias["sourceFile"]
                if alias_path.exists():
                    alias_path.unlink()

                alias["aliasOf"] = owner["id"]
                alias["sourceFile"] = owner["sourceFile"]
                alias["sourceSha256"] = owner["sourceSha256"]
                aliases.append(alias["id"])

            duplicate_groups.append(
                {
                    "decodedPcmSha256": digest,
                    "canonicalId": owner["id"],
                    "aliases": aliases,
                }
            )

        manifest = {
            "schemaVersion": 1,
            "generatedUtc": datetime.now(timezone.utc).isoformat(),
            "assetCount": len(entries),
            "physicalSourceCount": len(groups),
            "duplicateGroupCount": len(duplicate_groups),
            "format": {
                "container": "WAV",
                "codec": "PCM signed 24-bit little-endian",
                "sampleRate": 48000,
            },
            "duplicateGroups": duplicate_groups,
            "assets": entries,
        }

        write_json(
            temporary / "audio-source-manifest.json",
            manifest,
        )

        shutil.rmtree(SOURCE, ignore_errors=True)
        temporary.replace(SOURCE)

    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise

    print()
    print(f"Canonical assets: {len(entries)}")
    print(f"Physical WAV masters: {len(groups)}")
    print(f"Duplicate groups: {len(duplicate_groups)}")


def export_runtime() -> None:
    source_manifest = load_json(SOURCE_MANIFEST)
    entries = source_manifest["assets"]

    temporary = PUBLIC.parent / f".audio-exporting-{os.getpid()}"
    shutil.rmtree(temporary, ignore_errors=True)
    temporary.mkdir(parents=True)

    owner_by_id = {
        entry["id"]: entry
        for entry in entries
        if entry["aliasOf"] is None
    }

    runtime_owner: dict[str, dict[str, Any]] = {}

    try:
        for index, owner in enumerate(
            sorted(owner_by_id.values(), key=lambda item: item["id"]),
            start=1,
        ):
            asset_id = owner["id"]
            category = owner["category"]
            source = SOURCE / owner["sourceFile"]

            opus = temporary / category / f"{asset_id}.ogg"
            mp3 = temporary / category / f"{asset_id}.mp3"
            opus.parent.mkdir(parents=True, exist_ok=True)

            probe_data = probe(source)
            channels = int(probe_data["streams"][0]["channels"])
            opus_bitrate = "160k" if channels == 2 else "96k"
            mp3_bitrate = "192k" if channels == 2 else "128k"

            print(
                f"[{index:02d}/{len(owner_by_id):02d}] export "
                f"{category}/{asset_id}"
            )

            run(
                [
                    "ffmpeg",
                    "-nostdin",
                    "-hide_banner",
                    "-v",
                    "error",
                    "-xerror",
                    "-y",
                    "-i",
                    str(source),
                    "-map",
                    "0:a:0",
                    "-map_metadata",
                    "-1",
                    "-c:a",
                    "libopus",
                    "-b:a",
                    opus_bitrate,
                    "-vbr",
                    "on",
                    "-application",
                    "audio",
                    str(opus),
                ]
            )

            run(
                [
                    "ffmpeg",
                    "-nostdin",
                    "-hide_banner",
                    "-v",
                    "error",
                    "-xerror",
                    "-y",
                    "-i",
                    str(source),
                    "-map",
                    "0:a:0",
                    "-map_metadata",
                    "-1",
                    "-c:a",
                    "libmp3lame",
                    "-b:a",
                    mp3_bitrate,
                    str(mp3),
                ]
            )

            decode_validate(opus)
            decode_validate(mp3)

            runtime_owner[asset_id] = {
                "primary": {
                    "url": (
                        "/assets/audio/"
                        + opus.relative_to(temporary).as_posix()
                    ),
                    "codec": "opus",
                    "container": "ogg",
                    "sha256": sha256(opus),
                    "probe": probe(opus),
                },
                "fallback": {
                    "url": (
                        "/assets/audio/"
                        + mp3.relative_to(temporary).as_posix()
                    ),
                    "codec": "mp3",
                    "container": "mp3",
                    "sha256": sha256(mp3),
                    "probe": probe(mp3),
                },
            }

        runtime_assets = []

        source_by_id = {
            entry["id"]: entry
            for entry in entries
        }

        for entry in sorted(entries, key=lambda item: item["id"]):
            owner_id = entry["aliasOf"] or entry["id"]
            owner_runtime = runtime_owner[owner_id]

            runtime_assets.append(
                {
                    "id": entry["id"],
                    "category": entry["category"],
                    "bus": entry["bus"],
                    "loop": entry["loop"],
                    "required": entry["required"],
                    "aliasOf": entry["aliasOf"],
                    "primary": owner_runtime["primary"],
                    "fallback": owner_runtime["fallback"],
                }
            )

        runtime_manifest = {
            "schemaVersion": 1,
            "generatedUtc": datetime.now(timezone.utc).isoformat(),
            "assetCount": len(runtime_assets),
            "physicalAssetCount": len(owner_by_id),
            "physicalRuntimeFileCount": len(owner_by_id) * 2,
            "primaryCodec": "Opus in Ogg",
            "fallbackCodec": "MP3",
            "assets": runtime_assets,
        }

        write_json(
            temporary / "audio-manifest.json",
            runtime_manifest,
        )

        shutil.rmtree(PUBLIC, ignore_errors=True)
        temporary.replace(PUBLIC)

    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise

    print()
    print(f"Runtime asset IDs: {len(runtime_assets)}")
    print(f"Physical runtime owners: {len(owner_by_id)}")
    print(f"Physical runtime files: {len(owner_by_id) * 2}")


def validate() -> None:
    spec = load_json(SPEC_FILE)
    source_manifest = load_json(SOURCE_MANIFEST)
    runtime_manifest = load_json(RUNTIME_MANIFEST)

    expected_ids = {
        asset["id"]
        for asset in spec["assets"]
    }
    source_entries = source_manifest["assets"]
    runtime_entries = runtime_manifest["assets"]

    source_ids = {entry["id"] for entry in source_entries}
    runtime_ids = {entry["id"] for entry in runtime_entries}

    if len(expected_ids) != 95:
        fail(f"Audio-Spezifikation enthält {len(expected_ids)} IDs")

    if source_ids != expected_ids:
        fail(
            "Source-Manifest weicht von der Spezifikation ab: "
            f"missing={sorted(expected_ids - source_ids)}, "
            f"extra={sorted(source_ids - expected_ids)}"
        )

    if runtime_ids != expected_ids:
        fail(
            "Runtime-Manifest weicht von der Spezifikation ab: "
            f"missing={sorted(expected_ids - runtime_ids)}, "
            f"extra={sorted(runtime_ids - expected_ids)}"
        )

    source_by_id = {
        entry["id"]: entry
        for entry in source_entries
    }

    physical_source_paths: set[str] = set()
    physical_runtime_paths: set[str] = set()

    for entry in source_entries:
        alias = entry["aliasOf"]

        if alias is not None:
            if alias not in source_by_id:
                fail(f"{entry['id']}: Alias-Ziel fehlt: {alias}")
            if source_by_id[alias]["aliasOf"] is not None:
                fail(f"{entry['id']}: Alias-Kette ist nicht erlaubt")

        source_path = SOURCE / entry["sourceFile"]
        if not source_path.is_file():
            fail(f"Source-Datei fehlt: {source_path}")

        physical_source_paths.add(entry["sourceFile"])

    for relative in sorted(physical_source_paths):
        path = SOURCE / relative
        decode_validate(path)

        info = probe(path)
        stream = info["streams"][0]

        if stream["codec_name"] != "pcm_s24le":
            fail(f"Falscher Source-Codec: {relative}")

        if int(stream["sample_rate"]) != 48000:
            fail(f"Falsche Source-Samplerate: {relative}")

        if int(stream.get("bits_per_sample", 0)) != 24:
            fail(f"Falsche Source-Bittiefe: {relative}")

    for entry in runtime_entries:
        for role in ("primary", "fallback"):
            runtime = entry[role]
            relative = runtime["url"].removeprefix("/assets/audio/")
            path = PUBLIC / relative

            if not path.is_file():
                fail(f"Runtime-Datei fehlt: {path}")

            if sha256(path) != runtime["sha256"]:
                fail(f"Runtime-Checksumme falsch: {path}")

            decode_validate(path)
            physical_runtime_paths.add(relative)

    expected_runtime_count = len(physical_source_paths) * 2
    if len(physical_runtime_paths) != expected_runtime_count:
        fail(
            "Unerwartete Zahl physischer Runtime-Dateien: "
            f"{len(physical_runtime_paths)} != {expected_runtime_count}"
        )

    actual_runtime_files = {
        path.relative_to(PUBLIC).as_posix()
        for path in PUBLIC.rglob("*")
        if path.is_file() and path.suffix.lower() in {".ogg", ".mp3"}
    }

    if actual_runtime_files != physical_runtime_paths:
        fail(
            "Nicht referenzierte oder fehlende Runtime-Dateien: "
            f"extra={sorted(actual_runtime_files - physical_runtime_paths)}, "
            f"missing={sorted(physical_runtime_paths - actual_runtime_files)}"
        )

    # Kontrolliert, dass kein physisch exportierter Owner denselben
    # normalisierten PCM-Inhalt wie ein anderer Owner besitzt.
    seen_pcm: dict[str, str] = {}

    for relative in sorted(physical_source_paths):
        path = SOURCE / relative
        digest = decoded_pcm_sha256(path)

        if digest in seen_pcm:
            fail(
                "Nicht deduplizierte PCM-Quellen: "
                f"{seen_pcm[digest]} und {relative}"
            )

        seen_pcm[digest] = relative

    duplicate_groups = source_manifest["duplicateGroups"]

    print("Audio validation successful.")
    print(f"Semantic asset IDs: {len(expected_ids)}")
    print(f"Physical WAV masters: {len(physical_source_paths)}")
    print(f"Exact duplicate groups aliased: {len(duplicate_groups)}")
    print(f"Physical runtime files: {len(physical_runtime_paths)}")
    print("Source format: PCM WAV, 48000 Hz, 24-bit")
    print("Runtime primary: Ogg/Opus")
    print("Runtime fallback: MP3")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        choices=("prepare", "export", "validate", "all"),
    )
    args = parser.parse_args()

    if args.command in {"prepare", "all"}:
        print("=== Prepare canonical source audio ===")
        prepare()

    if args.command in {"export", "all"}:
        print("=== Export runtime audio ===")
        export_runtime()

    if args.command in {"validate", "all"}:
        print("=== Validate audio assets ===")
        validate()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=os.sys.stderr)
        raise SystemExit(1)
