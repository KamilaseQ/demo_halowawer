// Odchudzenie GLB wnętrza (zamiast samego `gltf-transform meshopt`):
//  1. usuwa TEXCOORD_0 z prymitywów, których materiał nie ma żadnej tekstury (TYNK, BIALY, DETAL, SZALWIA...),
//     - Blender eksportuje UV dla całej siatki, a nieskwantyzowane UV0 w metrach to ~25 % geometrii,
//  2. kwantyzacja (pozycje 14 bit względem bboxu siatki: krok < 1 mm; UV1 lightmapy 14 bit) + meshopt.
// Uruchomienie (moduły @gltf-transform/* i meshoptimizer z katalogu instalacji gltf-transform):
//   node <GT_DIR>/wnetrze_odchudz.mjs <wejscie.glb> <wyjscie.glb>
// Plik trzeba skopiować do <GT_DIR> (katalog z node_modules/@gltf-transform), bo ESM nie korzysta z NODE_PATH.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { quantize, meshopt, prune, dedup } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const [src, dst] = process.argv.slice(2);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder,
});
const doc = await io.read(src);
let stripped = 0, kept = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const m = prim.getMaterial();
    const textured = m && (m.getBaseColorTexture() || m.getNormalTexture() || m.getMetallicRoughnessTexture()
      || m.getOcclusionTexture() || m.getEmissiveTexture());
    // TEXCOORD_1 (lightmapa, three.js uv1) może istnieć bez TEXCOORD_0 - specyfikacja glTF na to pozwala.
    if (!textured && prim.getAttribute("TEXCOORD_0")) { prim.setAttribute("TEXCOORD_0", null); stripped++; } else kept++;
  }
}
console.log(`UV0 usunięte z ${stripped} prymitywów bez tekstur, zostawione w ${kept}`);
await doc.transform(dedup(), prune({ keepAttributes: true, keepLeaves: true }), quantize({ quantizePosition: 14, quantizeTexcoord: 14, quantizeNormal: 10, pattern: /^(POSITION|NORMAL|TEXCOORD_1|COLOR_0)$/ }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
await io.write(dst, doc);
console.log("zapisano", dst);
