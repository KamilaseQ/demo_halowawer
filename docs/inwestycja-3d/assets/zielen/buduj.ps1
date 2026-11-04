# Pełna budowa zestawu roślin (z katalogu głównego projektu):
#   powershell -ExecutionPolicy Bypass -File docs/inwestycja-3d/assets/zielen/buduj.ps1 [-Kafle] [-Probki 64]
# -Kafle: renderuje też kafle (Cycles, ~1,5 min); bez tego używa istniejących kafle/*.png.
param([switch]$Kafle, [int]$Probki = 64)
$ErrorActionPreference = "Stop"
$blender = "D:\Programy\Blender\blender.exe"
$node = "C:\Program Files\nodejs\node.exe"
$dir = "docs/inwestycja-3d/assets/zielen"
if (-not (Test-Path "$dir/elementy.json")) { & $node "$dir/elementy.mjs" }
if ($Kafle) { & $blender --background --factory-startup --python "$dir/kafle.py" -- "probki=$Probki" }
& $node "$dir/atlas.mjs"
& $blender --background --factory-startup --python "$dir/rosliny.py"
& $blender --background "$dir/rosliny.blend" --python "docs/inwestycja-3d/assets/bor2/blend_to_glb.py" -- "$dir/rosliny.glb" tekstury=2048 kamery=0 scal=0 instancje=0
Get-Item "$dir/rosliny.glb" | Select-Object Name, Length
