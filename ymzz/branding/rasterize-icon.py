#!/usr/bin/env python3
"""Rasterize the 湛箴_ymzz source SVG without executing it as XML.

The owner-supplied source is an SVG wrapper around one embedded raster
(JPEG bytes mislabelled as image/png). This tool only does a textual
safety scan, extracts the data URI, and resizes with Pillow. It never
feeds the document to an SVG engine or script host.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

ALLOWED_XMLNS = {
    "http://www.w3.org/2000/svg",
    "http://www.w3.org/1999/xlink",
}

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
TRAY_SIZES = (16, 20, 24, 32, 40, 48, 64)
WINDOWS_ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)
# Same inset as the archived DSH designer tile (1024 art on a 1104 canvas).
TILE_CANVAS = 1104
TILE_SIZE = 1024
TILE_INSET = (40, 32)
MASKABLE_SCALE = 0.82
FAVICON_RASTER = 256


class RasterError(RuntimeError):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def inspect_svg(text: str) -> None:
    if re.search(r"<script\b", text, re.I):
        raise RasterError("SVG contains a script element")
    if re.search(r"javascript:", text, re.I):
        raise RasterError("SVG contains a javascript: URL")
    if re.search(r"\son[a-z]+\s*=", text, re.I):
        raise RasterError("SVG contains an inline event handler")
    if re.search(r"<(foreignObject|iframe|embed|object)\b", text, re.I):
        raise RasterError("SVG contains an unsafe foreign element")
    if re.search(r"<!DOCTYPE|<!ENTITY|\bSYSTEM\b|\bPUBLIC\b", text, re.I):
        raise RasterError("SVG contains a DTD or entity declaration")
    stripped = re.sub(r"data:[^\"']+", "data:STRIPPED", text)
    for url in re.findall(r"https?://[^\s\"'<>]+", stripped):
        if url not in ALLOWED_XMLNS:
            raise RasterError(f"SVG contains an external URL: {url}")
    hrefs = re.findall(r"(?:xlink:)?href\s*=\s*([\"'])(.*?)\1", stripped, re.I)
    for _, value in hrefs:
        if not value.startswith("data:STRIPPED"):
            raise RasterError(f"SVG href is not an embedded data URI: {value[:80]}")


def extract_embedded_raster(text: str) -> tuple[str, bytes]:
    match = re.search(r"(?:xlink:)?href=\"data:([^;]+);base64,([^\"]+)\"", text)
    if match is None:
        raise RasterError("SVG has no embedded base64 raster")
    declared = match.group(1)
    raw = base64.b64decode(match.group(2))
    return declared, raw


def load_square_rgb(raw: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(raw))
    image.load()
    if image.size[0] != image.size[1]:
        raise RasterError(f"embedded raster is not square: {image.size}")
    return image.convert("RGBA")


def resize_square(image: Image.Image, size: int) -> Image.Image:
    if image.size == (size, size):
        return image.convert("RGBA")
    return image.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.convert("RGBA").save(buffer, format="PNG", optimize=True)
    data = buffer.getvalue()
    if not data.startswith(PNG_SIGNATURE):
        raise RasterError("PNG encoder produced a non-PNG stream")
    return data


def canvas_1104(image: Image.Image) -> Image.Image:
    tile = resize_square(image, TILE_SIZE)
    canvas = Image.new("RGBA", (TILE_CANVAS, TILE_CANVAS), (0, 0, 0, 0))
    canvas.paste(tile, TILE_INSET)
    return canvas


def maskable(image: Image.Image, size: int = 512, scale: float = MASKABLE_SCALE) -> Image.Image:
    art_size = int(round(size * scale))
    art = resize_square(image, art_size)
    background = image.convert("RGB").getpixel((0, 0)) + (255,)
    canvas = Image.new("RGBA", (size, size), background)
    offset = (size - art_size) // 2
    canvas.paste(art, (offset, offset))
    return canvas


def pack_ico(entries: list[tuple[int, bytes]]) -> bytes:
    header = bytearray(6 + 16 * len(entries))
    header[2:4] = (1).to_bytes(2, "little")
    header[4:6] = len(entries).to_bytes(2, "little")
    offset = len(header)
    blobs: list[bytes] = []
    for index, (size, png) in enumerate(entries):
        if size < 1 or size > 256 or not png.startswith(PNG_SIGNATURE):
            raise RasterError(f"invalid ICO entry {size}")
        at = 6 + 16 * index
        header[at] = size % 256
        header[at + 1] = size % 256
        header[at + 4:at + 6] = (1).to_bytes(2, "little")
        header[at + 6:at + 8] = (32).to_bytes(2, "little")
        header[at + 8:at + 12] = len(png).to_bytes(4, "little")
        header[at + 12:at + 16] = offset.to_bytes(4, "little")
        offset += len(png)
        blobs.append(png)
    return bytes(header) + b"".join(blobs)


def unpack_ico(data: bytes) -> list[tuple[int, bytes]]:
    if len(data) < 6 or data[0:2] != b"\x00\x00" or data[2:4] != b"\x01\x00":
        raise RasterError("not an ICO file")
    count = int.from_bytes(data[4:6], "little")
    entries: list[tuple[int, bytes]] = []
    for index in range(count):
        at = 6 + 16 * index
        declared = data[at]
        size = 256 if declared == 0 else declared
        length = int.from_bytes(data[at + 8:at + 12], "little")
        offset = int.from_bytes(data[at + 12:at + 16], "little")
        png = data[offset:offset + length]
        if not png.startswith(PNG_SIGNATURE):
            raise RasterError("ICO entry is not a PNG stream")
        entries.append((size, png))
    return entries


def compact_favicon_svg(png: bytes, size: int) -> bytes:
    b64 = base64.b64encode(png).decode("ascii")
    svg = (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
        f' width="{size}" height="{size}" viewBox="0 0 {size} {size}" role="img"'
        f' aria-label="湛箴_ymzz">\n'
        f'  <image width="{size}" height="{size}" preserveAspectRatio="xMidYMid meet"'
        f' href="data:image/png;base64,{b64}"'
        f' xlink:href="data:image/png;base64,{b64}" />\n'
        f"</svg>\n"
    )
    return svg.encode("utf-8")


def write(path: Path, data: bytes) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {"file": path.name, "bytes": len(data), "sha256": sha256(data)}


def generate(source_svg: Path, output_dir: Path) -> dict:
    text = source_svg.read_text(encoding="utf-8")
    inspect_svg(text)
    declared, raw = extract_embedded_raster(text)
    image = load_square_rgb(raw)
    output_dir.mkdir(parents=True, exist_ok=True)

    records: dict[str, dict] = {}
    native = image.convert("RGBA")
    records["icon-1536.png"] = write(output_dir / "icon-1536.png", png_bytes(native if native.size == (1536, 1536) else resize_square(image, 1536)))
    preview = resize_square(image, 512)
    records["preview-512.png"] = write(output_dir / "preview-512.png", png_bytes(preview))
    records["icon-1024.png"] = write(output_dir / "icon-1024.png", png_bytes(resize_square(image, 1024)))
    records["icon-1104.png"] = write(output_dir / "icon-1104.png", png_bytes(canvas_1104(image)))
    records["icon-192.png"] = write(output_dir / "icon-192.png", png_bytes(resize_square(image, 192)))
    records["icon-180.png"] = write(output_dir / "icon-180.png", png_bytes(resize_square(image, 180)))
    records["icon-maskable-512.png"] = write(output_dir / "icon-maskable-512.png", png_bytes(maskable(image, 512)))

    tray_entries = [(size, png_bytes(resize_square(image, size))) for size in TRAY_SIZES]
    records["tray-windows.ico"] = write(output_dir / "tray-windows.ico", pack_ico(tray_entries))
    win_entries = [(size, png_bytes(resize_square(image, size))) for size in WINDOWS_ICO_SIZES]
    records["icon.ico"] = write(output_dir / "icon.ico", pack_ico(win_entries))

    favicon_png = png_bytes(resize_square(image, FAVICON_RASTER))
    records["favicon-256.png"] = write(output_dir / "favicon-256.png", favicon_png)
    records["favicon.svg"] = write(output_dir / "favicon.svg", compact_favicon_svg(favicon_png, FAVICON_RASTER))

    manifest = {
        "source": str(source_svg),
        "sourceSha256": sha256(source_svg.read_bytes()),
        "embeddedDeclaredMime": declared,
        "embeddedMagic": raw[:4].hex(),
        "embeddedFormat": Image.open(io.BytesIO(raw)).format,
        "embeddedSize": list(Image.open(io.BytesIO(raw)).size),
        "outputs": records,
        "notes": {
            "svgExecution": "never; data URI extracted by text scan only",
            "maskable": "artwork scaled to 82% on the source corner colour, no redesign",
            "icon-1104": "1024 artwork placed at DSH tile inset (40, 32) on a transparent 1104 canvas",
        },
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Rasterize 湛箴_ymzz icon.svg without executing SVG")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args(argv)
    manifest = generate(args.source.resolve(), args.output_dir.resolve())
    json.dump(manifest, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except RasterError as error:
        print(f"rasterize-icon: {error}", file=sys.stderr)
        raise SystemExit(1)
