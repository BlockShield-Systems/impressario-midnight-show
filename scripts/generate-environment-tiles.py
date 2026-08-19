#!/usr/bin/env python3

from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

WIDTH = 256
HEIGHT = 256
TILE = 32
CHANNELS = 4

OUTPUT = Path(
    "public/assets/world/"
    "impressario-environment.png"
)

METADATA = Path(
    "assets/source/world/"
    "environment-tileset.json"
)

PALETTES = [
    ((24, 8, 20), (68, 20, 42), (205, 150, 58)),
    ((20, 11, 30), (83, 28, 67), (235, 190, 86)),
    ((18, 10, 25), (98, 26, 47), (233, 182, 72)),
    ((7, 17, 31), (20, 47, 78), (90, 211, 229)),
    ((7, 19, 29), (17, 62, 77), (113, 230, 238)),
    ((21, 7, 23), (70, 19, 65), (225, 80, 181)),
    ((15, 12, 29), (82, 35, 83), (226, 177, 72)),
    ((8, 8, 21), (31, 30, 64), (107, 225, 236)),
    ((4, 9, 19), (20, 38, 68), (91, 223, 233)),
    ((12, 5, 18), (55, 16, 55), (230, 74, 183)),
    ((5, 7, 17), (27, 22, 55), (241, 202, 88)),
]

pixels = bytearray(
    WIDTH * HEIGHT * CHANNELS
)

def set_pixel(
    x: int,
    y: int,
    color: tuple[int, int, int],
    alpha: int = 255,
) -> None:
    if not (
        0 <= x < WIDTH and
        0 <= y < HEIGHT
    ):
        return

    offset = (
        (y * WIDTH + x) *
        CHANNELS
    )

    pixels[offset:offset + 4] = bytes(
        (
            max(0, min(255, color[0])),
            max(0, min(255, color[1])),
            max(0, min(255, color[2])),
            max(0, min(255, alpha)),
        )
    )

def mix(
    left: tuple[int, int, int],
    right: tuple[int, int, int],
    amount: float,
) -> tuple[int, int, int]:
    return tuple(
        round(
            left[index] *
            (1 - amount) +
            right[index] *
            amount
        )
        for index in range(3)
    )

for tile_index in range(64):
    tile_x = (
        tile_index % 8
    ) * TILE

    tile_y = (
        tile_index // 8
    ) * TILE

    palette = PALETTES[
        tile_index %
        len(PALETTES)
    ]

    base, secondary, accent = palette

    for local_y in range(TILE):
        for local_x in range(TILE):
            noise = (
                (
                    local_x * 17 +
                    local_y * 31 +
                    tile_index * 13
                ) % 19
            ) / 18

            color = mix(
                base,
                secondary,
                0.12 + noise * 0.16,
            )

            if (
                local_x in (0, 1, 30, 31) or
                local_y in (0, 1, 30, 31)
            ):
                color = mix(
                    secondary,
                    accent,
                    0.22,
                )

            pattern = tile_index % 8

            if pattern == 0:
                if (
                    local_x % 16 in (0, 1) or
                    local_y % 16 in (0, 1)
                ):
                    color = mix(
                        color,
                        accent,
                        0.35,
                    )

            elif pattern == 1:
                if (
                    local_x +
                    local_y
                ) % 16 in (0, 1):
                    color = mix(
                        color,
                        accent,
                        0.34,
                    )

            elif pattern == 2:
                dx = local_x - 16
                dy = local_y - 16

                if 65 <= dx * dx + dy * dy <= 105:
                    color = mix(
                        color,
                        accent,
                        0.58,
                    )

            elif pattern == 3:
                if (
                    local_x % 8 == 0 and
                    local_y % 8 == 0
                ):
                    color = accent

            elif pattern == 4:
                if abs(
                    local_x -
                    local_y
                ) <= 1:
                    color = mix(
                        color,
                        accent,
                        0.5,
                    )

            elif pattern == 5:
                if (
                    local_x in (8, 23) or
                    local_y in (8, 23)
                ):
                    color = mix(
                        color,
                        accent,
                        0.42,
                    )

            elif pattern == 6:
                if (
                    local_y % 8
                ) in (0, 1):
                    color = mix(
                        color,
                        accent,
                        0.28,
                    )

            else:
                if (
                    local_x // 8 +
                    local_y // 8
                ) % 2 == 0:
                    color = mix(
                        color,
                        secondary,
                        0.3,
                    )

            set_pixel(
                tile_x + local_x,
                tile_y + local_y,
                color,
            )

raw = bytearray()

for y in range(HEIGHT):
    raw.append(0)

    start = (
        y * WIDTH *
        CHANNELS
    )

    end = start + (
        WIDTH * CHANNELS
    )

    raw.extend(pixels[start:end])

def chunk(
    chunk_type: bytes,
    data: bytes,
) -> bytes:
    body = chunk_type + data

    return (
        struct.pack(
            ">I",
            len(data),
        )
        + body
        + struct.pack(
            ">I",
            zlib.crc32(body) &
            0xFFFFFFFF,
        )
    )

png = bytearray(
    b"\x89PNG\r\n\x1a\n"
)

png.extend(
    chunk(
        b"IHDR",
        struct.pack(
            ">IIBBBBB",
            WIDTH,
            HEIGHT,
            8,
            6,
            0,
            0,
            0,
        ),
    )
)

png.extend(
    chunk(
        b"IDAT",
        zlib.compress(
            bytes(raw),
            level=9,
        ),
    )
)

png.extend(
    chunk(
        b"IEND",
        b"",
    )
)

OUTPUT.parent.mkdir(
    parents=True,
    exist_ok=True,
)

OUTPUT.write_bytes(png)

section_frames = {
    "MovementRehearsal": 0,
    "CombatRehearsal": 1,
    "MainStage": 2,
    "GrandGallery": 3,
    "GalleryGauntlet": 4,
    "SpotlightVault": 5,
    "CardSanctum": 6,
    "RoyalBox": 7,
    "MirrorCore": 8,
    "ConductorApproach": 9,
    "MirrorConductor": 10,
}

METADATA.parent.mkdir(
    parents=True,
    exist_ok=True,
)

METADATA.write_text(
    json.dumps(
        {
            "version": 1,
            "image": (
                "/assets/world/"
                "impressario-environment.png"
            ),
            "width": WIDTH,
            "height": HEIGHT,
            "tileWidth": TILE,
            "tileHeight": TILE,
            "columns": 8,
            "rows": 8,
            "tileCount": 64,
            "sectionFrames": section_frames,
        },
        indent=2,
        ensure_ascii=False,
    ) + "\n",
    encoding="utf-8",
)

print(
    f"Generated {OUTPUT}: "
    f"{WIDTH}x{HEIGHT}, 64 tiles."
)
