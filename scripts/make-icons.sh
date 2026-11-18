#!/usr/bin/env bash
# Regenerates the app icons and splash screens from assets/icon/foreground.svg.
# Needs bash 4+, rsvg-convert and ImageMagick (magick).
set -euo pipefail
cd "$(dirname "$0")/.."
for tool in rsvg-convert magick; do
  command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 1; }
done
FG=assets/icon/foreground.svg
BG='#0D1117'
RES=android/app/src/main/res
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# full icon (background + foreground) at high resolution
rsvg-convert -w 1024 -h 1024 "$FG" -o "$TMP/fg.png"
magick -size 1024x1024 "xc:$BG" "$TMP/fg.png" -composite "$TMP/full.png"

declare -A LEGACY=([mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192)
for d in "${!LEGACY[@]}"; do
  s=${LEGACY[$d]}; f=$((s * 108 / 48))
  # legacy square icon with rounded corners
  magick "$TMP/full.png" -resize ${s}x${s} \
    \( -size ${s}x${s} xc:none -draw "roundrectangle 0,0 $((s-1)),$((s-1)) $((s/6)),$((s/6))" \) \
    -compose DstIn -composite "$RES/mipmap-$d/ic_launcher.png"
  # legacy round icon
  magick "$TMP/full.png" -resize ${s}x${s} \
    \( -size ${s}x${s} xc:none -draw "circle $((s/2)),$((s/2)) $((s/2)),0" \) \
    -compose DstIn -composite "$RES/mipmap-$d/ic_launcher_round.png"
  # adaptive icon foreground (108dp canvas)
  rsvg-convert -w $f -h $f "$FG" -o "$RES/mipmap-$d/ic_launcher_foreground.png"
done

# splash screens: keep each existing image's size, dark background, icon centred
for f in "$RES"/drawable*/splash.png; do
  read -r w h < <(magick identify -format '%w %h\n' "$f")
  m=$(( (w < h ? w : h) * 2 / 5 ))
  magick -size ${w}x${h} "xc:$BG" \( "$TMP/fg.png" -resize ${m}x${m} \) -gravity center -composite "$f"
done

# web favicon + PWA-style icon
magick "$TMP/full.png" -define icon:auto-resize=64,48,32,16 public/favicon.ico
cp "$TMP/full.png" public/icon-512.png && magick public/icon-512.png -resize 512x512 public/icon-512.png
echo "icons regenerated"
