#!/usr/bin/env bash
# Pełny potok wnętrza: SKP .blend -> GLB dla three.js + lightmapy.
#
#   GT=<sciezka do @gltf-transform/cli/bin/cli.js> bash wnetrze_wszystko.sh dom1 <katalog_roboczy> [etap_od] [opcje lightmap...]
#
# Etapy: buduj -> pokoje -> lightmapy -> glb -> kompresja. etap_od pozwala zacząć od środka (pliki pośrednie
# w <katalog_roboczy>: domN-web.blend, domN-pokoje.blend, domN-lm.blend, domN-raw.glb).
# Wynik w <katalog_roboczy>: bor2-wnetrze-domN.glb (meshopt + KHR_mesh_quantization 14 bit względem bboxu
#        siatki, krok < 1 mm) i lm/<G|B>_kond<n>.webp. DOSTAWA=1 kopiuje oba do assets/bor2 (+ wnetrza-lm/).
# gltf-transform: npm install --prefix <katalog> @gltf-transform/cli@4 (poza repo).
set -euo pipefail
DOM=$1; WORK=$2; FROM=${3:-buduj}; shift $(( $# >= 3 ? 3 : $# )) || true
HERE="$(cd "$(dirname "$0")" && pwd)"
BL="${BLENDER:-/d/Programy/Blender/blender.exe}"
NODE="${NODE:-/c/Program Files/nodejs/node.exe}"
mkdir -p "$WORK"
cd "$HERE"
step() { [[ " buduj pokoje lightmapy szyby glb kompresja dostawa " == *" $FROM "* ]] || { echo "zly etap $FROM"; exit 2; }; }
step
run=0
for s in buduj pokoje lightmapy szyby glb kompresja $( [[ "${DOSTAWA:-0}" == 1 ]] && echo dostawa ); do
  [[ $s == "$FROM" ]] && run=1
  [[ $run == 0 ]] && continue
  echo "=== $DOM: $s"
  case $s in
    buduj)
      extra="budzet=290000"; [[ $DOM == dom2 ]] && extra="budzet=245000 min_tris=12"
      "$BL" --background "bor2-wnetrze-$DOM.blend" --python wnetrze_buduj.py -- "$DOM" "$WORK/$DOM-web.blend" $extra > "$WORK/$DOM-buduj.log" 2>&1
      grep -E "^WN.*(RAZEM|budzet|trojkaty)" "$WORK/$DOM-buduj.log" ;;
    pokoje)
      "$BL" --background "$WORK/$DOM-web.blend" --python wnetrze_pokoje.py -- "$DOM" zapisz="$WORK/$DOM-pokoje.blend" > "$WORK/$DOM-pokoje.log" 2>&1
      grep -E "POKOJE RAZEM" "$WORK/$DOM-pokoje.log" ;;
    lightmapy)
      "$BL" --background "$WORK/$DOM-pokoje.blend" --python wnetrze_lightmapy.py -- "$DOM" "$WORK/lm" zapisz="$WORK/$DOM-lm.blend" "$@" > "$WORK/$DOM-lm.log" 2>&1
      grep -E "^LM.*(KOND|orient|urzadz)" "$WORK/$DOM-lm.log" ;;
    szyby)
      "$BL" --background "$WORK/$DOM-lm.blend" --python wnetrze_szyby.py -- "$DOM" > "$WORK/$DOM-szyby.log" 2>&1
      grep -E "SZYBY" "$WORK/$DOM-szyby.log" ;;
    glb)
      "$BL" --background "$WORK/$DOM-lm.blend" --python wnetrze_glb.py -- "$WORK/$DOM-raw.glb" > "$WORK/$DOM-glb.log" 2>&1
      grep -E "^GLB" "$WORK/$DOM-glb.log" ;;
    kompresja)
      GT_DIR="${GT_DIR:-$(cd "$(dirname "$GT")/../../../.." && pwd)}"
      cp wnetrze_odchudz.mjs "$GT_DIR/"
      "$NODE" "$GT_DIR/wnetrze_odchudz.mjs" "$WORK/$DOM-raw.glb" "$WORK/bor2-wnetrze-$DOM.glb" 2>&1 | grep -v "^quantize" | tail -2
      python check_glb.py "$WORK/bor2-wnetrze-$DOM.glb" | sed -n '2,8p' ;;
    dostawa)
      # GLB i lightmapy podmieniane razem (atlas UV1 jest inny w każdej budowie)
      cp "$WORK/bor2-wnetrze-$DOM.glb" "bor2-wnetrze-$DOM.glb"
      mkdir -p wnetrza-lm && cp "$WORK"/lm/*.webp wnetrza-lm/
      ls -la "bor2-wnetrze-$DOM.glb" wnetrza-lm/ ;;
  esac
  grep -E "Traceback|Error:" "$WORK/$DOM-"*.log 2>/dev/null | grep -v DeprecationWarning | head -5 || true
done
