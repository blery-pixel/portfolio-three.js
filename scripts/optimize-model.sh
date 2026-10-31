#!/usr/bin/env bash
# Losslessly-in-spirit optimisation of lovecrafts_apartment.glb for the web.
#
#   bash scripts/optimize-model.sh [input.glb] [output-dir]
#
# What it does (nothing is removed; every texture, material, mesh and animation is kept):
#   1. Textures  PNG -> KTX2 / Basis Universal
#        - colour + emissive  -> ETC1S  (smallest, visually clean for albedo)
#        - normal + ORM/metal-rough + occlusion -> UASTC (higher quality, avoids normal-map artefacts)
#      The textures stay GPU-compressed, so VRAM drops ~4-6x as well as download size.
#   2. Geometry  -> Meshopt (lossless-ish quantisation + entropy coding; decoded by three.js out of the box)
#   3. Optional "mobile" variant: same file, textures capped at 2048 px (set MOBILE=1).
#
# Requirements: Node 18+, `toktx` (KTX-Software >= 4.3) on PATH, ~8 GB free RAM for the 474 MB original.
#   toktx: https://github.com/KhronosGroup/KTX-Software/releases
set -euo pipefail

IN="${1:-public/models/lovecrafts_apartment.glb}"
OUTDIR="${2:-public/models}"
GT="npx --yes @gltf-transform/cli@4.5.1"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

command -v toktx >/dev/null || { echo "toktx not found. Install KTX-Software: https://github.com/KhronosGroup/KTX-Software/releases" >&2; exit 1; }
[ -f "$IN" ] || { echo "Input not found: $IN" >&2; exit 1; }
mkdir -p "$OUTDIR"

BASE="$(basename "${IN%.glb}")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 2)}"

build() { # build <suffix> <max texture size or 0>
  local suffix="$1" size="$2" cur="$IN" step=0
  local resize=(); [ "$size" != "0" ] && resize=(--resize "$size")

  echo "==> [$suffix] colour/emissive -> ETC1S"
  $GT etc1s "$cur" "$TMP/a.glb" --slots "{baseColorTexture,emissiveTexture}" --quality 192 --jobs "$JOBS" "${resize[@]}"
  echo "==> [$suffix] normal/ORM/occlusion -> UASTC"
  $GT uastc "$TMP/a.glb" "$TMP/b.glb" --slots "{normalTexture,metallicRoughnessTexture,occlusionTexture}" --level 2 --rdo --zstd 18 --jobs "$JOBS" "${resize[@]}"
  echo "==> [$suffix] geometry -> Meshopt"
  $GT meshopt "$TMP/b.glb" "$OUTDIR/${BASE}${suffix}.glb" --level high
  ls -lh "$OUTDIR/${BASE}${suffix}.glb"
}

build ".opt" 0                                   # full-resolution textures
[ "${MOBILE:-0}" = "1" ] && build ".mobile" 2048  # optional lighter variant for phones
echo "Done. Point VITE_APARTMENT_MODEL_URL at the new file (see .env.example)."
