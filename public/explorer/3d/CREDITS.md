# 3D asset credits

Every asset in `public/3d/` is licensed **CC0 1.0 Universal** (public domain dedication). No attribution is legally required; authors are credited here as a courtesy.

- Poly Haven - https://polyhaven.com - license: https://polyhaven.com/license (CC0)
- ambientCG - https://ambientcg.com - license: https://docs.ambientcg.com/license/ (CC0)

## PBR textures (`/3d/textures/<slug>/`)

| Slug | Asset | Author(s) | Provider | License | Source |
|---|---|---|---|---|---|
| `herringbone_parquet` | Herringbone Parquet | Jenelle van Heerden (Processing), Sergej Majboroda (Photography) | Poly Haven | CC0 | https://polyhaven.com/a/herringbone_parquet |
| `oak_veneer_01` | Oak Veneer 01 | Jenelle van Heerden | Poly Haven | CC0 | https://polyhaven.com/a/oak_veneer_01 |
| `black_oak_veneer` | Black Oak Veneer | Jenelle van Heerden | Poly Haven | CC0 | https://polyhaven.com/a/black_oak_veneer |
| `marble004` | Marble 004 | ambientCG (Lennart Demes) | ambientCG | CC0 | https://ambientcg.com/view?id=Marble004 |
| `marble016` | Marble 016 | ambientCG (Lennart Demes) | ambientCG | CC0 | https://ambientcg.com/view?id=Marble016 |
| `granite_tile` | Granite Tile | Charlotte Baglioni | Poly Haven | CC0 | https://polyhaven.com/a/granite_tile |
| `travertine009` | Travertine 009 | ambientCG (Lennart Demes) | ambientCG | CC0 | https://ambientcg.com/view?id=Travertine009 |
| `terrazzo013` | Terrazzo 013 | ambientCG (Lennart Demes) | ambientCG | CC0 | https://ambientcg.com/view?id=Terrazzo013 |
| `curly_teddy_natural` | Curly Teddy Natural | colormass (Photography), Rico Cilliers (Processing) | Poly Haven | CC0 | https://polyhaven.com/a/curly_teddy_natural |
| `fabric036` | Fabric 036 | ambientCG (Lennart Demes) | ambientCG | CC0 | https://ambientcg.com/view?id=Fabric036 |
| `plaster001` | Plaster 001 | ambientCG (Lennart Demes) | ambientCG | CC0 | https://ambientcg.com/view?id=Plaster001 |

## HDRIs (`/3d/hdri/`)

| Slug | Asset | Author(s) | Provider | License | Source |
|---|---|---|---|---|---|
| `zawiszy_czarnego` | Zawiszy Czarnego | Grzegorz Wronkowski | Poly Haven | CC0 | https://polyhaven.com/a/zawiszy_czarnego |
| `golden_bay` | Golden Bay | Greg Zaal | Poly Haven | CC0 | https://polyhaven.com/a/golden_bay |
| `studio_small_08` | Studio Small 08 | Sergej Majboroda | Poly Haven | CC0 | https://polyhaven.com/a/studio_small_08 |

## Models (`/3d/models/<slug>.glb`)

| Slug | Asset | Author(s) | Provider | License | Source |
|---|---|---|---|---|---|
| `potted_plant_01` | Potted Plant 01 | Rico Cilliers | Poly Haven | CC0 | https://polyhaven.com/a/potted_plant_01 |
| `potted_plant_02` | Potted Plant 02 | Rico Cilliers | Poly Haven | CC0 | https://polyhaven.com/a/potted_plant_02 |
| `potted_plant_04` | Potted Plant 04 | James Ray Cock | Poly Haven | CC0 | https://polyhaven.com/a/potted_plant_04 |
| `modern_arm_chair_01` | Modern Arm Chair 01 | Vibrant Nordic | Poly Haven | CC0 | https://polyhaven.com/a/modern_arm_chair_01 |
| `side_table_01` | Side Table 01 | James Ray Cock | Poly Haven | CC0 | https://polyhaven.com/a/side_table_01 |
| `outdoor_table_chair_set_01` | Outdoor Table Chair Set 01 | James Ray Cock | Poly Haven | CC0 | https://polyhaven.com/a/outdoor_table_chair_set_01 |
| `ceramic_vase_01` | Ceramic Vase 01 | James Ray Cock | Poly Haven | CC0 | https://polyhaven.com/a/ceramic_vase_01 |
| `ceramic_vase_02` | Ceramic Vase 02 | James Ray Cock | Poly Haven | CC0 | https://polyhaven.com/a/ceramic_vase_02 |
| `ceramic_vase_03` | Ceramic Vase 03 | James Ray Cock | Poly Haven | CC0 | https://polyhaven.com/a/ceramic_vase_03 |
| `wooden_bowl_01` | Wooden Bowl 01 | Oliver Harries | Poly Haven | CC0 | https://polyhaven.com/a/wooden_bowl_01 |
| `food_pears_asian_01` | Pears Asian 01 | Amal Kumar | Poly Haven | CC0 | https://polyhaven.com/a/food_pears_asian_01 |
| `standing_picture_frame_01` | Standing Picture Frame 01 | James Ray Cock | Poly Haven | CC0 | https://polyhaven.com/a/standing_picture_frame_01 |

## Processing applied (derivatives, still CC0)

- Textures: downloaded as JPG (Poly Haven `Diffuse` / `nor_gl` / `Rough` / `AO`; ambientCG `1K-JPG` `Color` / `NormalGL` / `Roughness` / `AmbientOcclusion`) and re-encoded for the web: colour, roughness and AO at JPEG q85 (roughness/AO as grayscale), normals at q90 4:4:4 (`fabric036` normal/AO at q80). `curly_teddy_natural` resampled from 1024x1009 to 1024x1024. `herringbone_parquet` kept at 2k, all others 1k.
- HDRIs: Poly Haven 1k `.hdr` files unchanged. `*_bg.jpg` backgrounds are Poly Haven's tonemapped 8k JPG downscaled to 4096x2048 (JPEG q82).
- Models: Poly Haven glTF (1k textures) optimized with glTF-Transform CLI v4.5.1: `optimize --compress meshopt --texture-compress webp --texture-size 1024`.
