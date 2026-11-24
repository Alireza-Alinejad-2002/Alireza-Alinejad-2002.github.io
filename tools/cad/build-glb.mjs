// Optimise a raw SOLIDWORKS glb into a web-ready, meshopt-compressed glb.
//
//   node build-glb.mjs <key> [--list]
//
// <key> is an entry in models.json. --list prints the node tree of the raw export
// (to write exclusion / accent patterns) and exits.
//
// Pipeline: remove excluded nodes -> brand materials -> strip unused attributes ->
// dedup -> instance -> flatten -> join -> weld -> simplify (light, adaptive to the
// triangle budget) -> prune -> meshopt (EXT_meshopt_compression + quantization).

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, instance, flatten, join, weld, simplify, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import { existsSync } from 'node:fs';
import { Document } from '@gltf-transform/core';
import { mergeTess } from './merge-tess.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const models = JSON.parse(readFileSync(resolve(here, 'models.json'), 'utf8'));

const key = process.argv[2];
const listOnly = process.argv.includes('--list');
const cfg = models[key];
if (!cfg) {
  console.error(`usage: node build-glb.mjs <${Object.keys(models).join('|')}> [--list]`);
  process.exit(2);
}

// Brand palette (linear-space factors are computed below from sRGB hex).
const PALETTE = {
  paper: '#CFCBC1',   // warm paper, clearly darker than the white viewer ground so forms read
  grey: '#8A8882',
  graphite: '#3A3936',
  orange: '#FF4F00',
};

const globToRegex = (g) =>
  new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
const toRegexes = (list = []) => list.map(globToRegex);

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255)).concat(1);
}

function nodePath(node, parents) {
  const parts = [];
  for (let n = node; n; n = parents.get(n)) parts.unshift(n.getName() || '(unnamed)');
  return parts.join('/');
}

function buildParents(root) {
  const parents = new Map();
  const walk = (n) => n.listChildren().forEach((c) => { parents.set(c, n); walk(c); });
  root.listScenes().forEach((s) => s.listChildren().forEach(walk));
  return parents;
}

function matchesAny(node, parents, regexes) {
  if (!regexes.length) return false;
  const name = node.getName() || '';
  const path = nodePath(node, parents);
  return regexes.some((r) => r.test(name) || r.test(path));
}

function countTriangles(doc) {
  let unique = 0;
  let rendered = 0;
  const meshTris = new Map();
  for (const mesh of doc.getRoot().listMeshes()) {
    let t = 0;
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) continue; // TRIANGLES only
      const idx = p.getIndices();
      t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    }
    meshTris.set(mesh, t);
    unique += t;
  }
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const inst = node.getExtension('EXT_mesh_gpu_instancing');
    const count = inst ? inst.listAttributes()[0]?.getCount() ?? 1 : 1;
    rendered += (meshTris.get(mesh) ?? 0) * count;
  }
  return { unique: Math.round(unique), rendered: Math.round(rendered) };
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    // The SOLIDWORKS glTF add-in may write Draco-compressed raw files; decode them on read.
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

// Raw add-in export (optional for tess-only models) + part-space tessellation of the
// surface bodies the add-in skips (SwExport tess -> cfg.tess).
const rawPath = cfg.raw ? resolve(here, cfg.raw) : null;
const doc = rawPath && existsSync(rawPath) ? await io.read(rawPath) : new Document();
if (!rawPath || !existsSync(rawPath)) console.log(`${key}: no raw add-in export, building from tessellation only`);
for (const t of [].concat(cfg.tess ?? [])) mergeTess(doc, resolve(here, t));
const root = doc.getRoot();
let parents = buildParents(root);

if (listOnly) {
  const seen = new Set();
  for (const node of root.listNodes()) {
    const p = nodePath(node, parents);
    const depth = p.split('/').length - 1;
    if (depth > (cfg.listDepth ?? 3) || seen.has(p)) continue;
    seen.add(p);
    const mats = node.getMesh()?.listPrimitives().map((x) => x.getMaterial()?.getName()).filter(Boolean) ?? [];
    console.log('  '.repeat(depth) + (node.getName() || '(unnamed)') + (mats.length ? `  [${[...new Set(mats)].join(', ')}]` : ''));
  }
  console.log('triangles', countTriangles(doc));
  process.exit(0);
}

// Drop Draco (re-encoded with meshopt below) and the exporter's punctual lights
// (model-viewer lights the scene itself).
for (const ext of root.listExtensionsUsed()) {
  if (['KHR_draco_mesh_compression', 'KHR_lights_punctual'].includes(ext.extensionName)) ext.dispose();
}

const before = countTriangles(doc);
console.log(`${key}: raw ${rawPath && existsSync(rawPath) ? (statSync(rawPath).size / 1e6).toFixed(2) : 0} MB, ${before.rendered.toLocaleString()} rendered triangles`);

// 1. Remove excluded (third-party) nodes by name.
// cfg.internal: parts fully enclosed by others (hub gears, bearings), dropped to save the budget.
const exclude = toRegexes([...(cfg.exclude ?? []), ...(cfg.internal ?? [])]);
let removed = 0;
for (const node of root.listNodes()) {
  if (node.isDisposed?.()) continue;
  if (matchesAny(node, parents, exclude)) {
    node.dispose();
    removed++;
  }
}
parents = buildParents(root);
console.log(`  removed ${removed} excluded nodes`);

// 2. Matte brand materials. Accent (orange) by node name; otherwise keep the
//    original light/dark reading of the CAD appearance as paper / grey / graphite.
const mk = (name, hex) =>
  doc.createMaterial(name).setBaseColorFactor(hexToLinear(hex)).setMetallicFactor(0).setRoughnessFactor(0.85);
const mats = {
  paper: mk('paper', PALETTE.paper),
  grey: mk('grey', PALETTE.grey),
  graphite: mk('graphite', PALETTE.graphite),
  orange: mk('orange', PALETTE.orange),
  // Translucent wing membranes / canopies.
  membrane: mk('membrane', PALETTE.paper).setAlpha(0.35).setAlphaMode('BLEND').setDoubleSided(true),
};
const accent = toRegexes(cfg.orange);
const forceTone = Object.entries(cfg.tones ?? {}).map(([tone, list]) => [tone, toRegexes(list)]);

function toneFor(node, prim) {
  for (let n = node; n; n = parents.get(n)) {
    if (matchesAny(n, parents, accent)) return 'orange';
    for (const [tone, rx] of forceTone) if (matchesAny(n, parents, rx)) return tone;
  }
  const m = prim.getMaterial();
  if (!m) return 'paper';
  const [r, g, b, a] = m.getBaseColorFactor();
  if (m.getAlphaMode() === 'BLEND' && a < 0.9) return 'membrane';
  // cfg.redAccent: strongly red CAD appearances (e.g. a hull livery) become the orange accent.
  if (cfg.redAccent && r > 0.15 && r > 4 * g && r > 4 * b) return 'orange';
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // linear
  if (lum < 0.03) return 'graphite';
  if (lum < 0.25) return 'grey';
  return 'paper';
}

const counts = Object.fromEntries(Object.keys(mats).map((k) => [k, 0]));
const meshTone = new Map(); // a mesh shared by nodes of different tones gets cloned
for (const node of root.listNodes()) {
  let mesh = node.getMesh();
  if (!mesh) continue;
  const tones = mesh.listPrimitives().map((p) => toneFor(node, p));
  const sig = tones.join(',');
  const prev = meshTone.get(mesh);
  if (prev !== undefined && prev !== sig) {
    mesh = mesh.clone();
    node.setMesh(mesh);
  }
  meshTone.set(mesh, sig);
  mesh.listPrimitives().forEach((p, i) => {
    p.setMaterial(mats[tones[i]]);
    counts[tones[i]]++;
    for (const sem of p.listSemantics()) {
      if (sem !== 'POSITION' && sem !== 'NORMAL') p.setAttribute(sem, null);
    }
  });
}
console.log('  primitives by tone', counts);

// 3. Geometry pipeline.
// No EXT_mesh_gpu_instancing: model-viewer sizes its camera from mesh bounds without the
// instance matrices, so quantized instanced meshes count as ±1 m and the model frames tiny.
// Opt in per model with "instance": true only if the viewer handles it.
await doc.transform(dedup(), ...(cfg.instance ? [instance({ min: 2 })] : []), flatten(), join(), weld());

let tris = countTriangles(doc);
const budget = cfg.budget ?? 300_000;
let ratio = cfg.simplifyRatio ?? 0.75;
let error = cfg.simplifyError ?? 0.0005;
for (let pass = 1; pass <= 4; pass++) {
  const target = Math.min(ratio, (budget * 0.95) / Math.max(1, tris.rendered));
  if (pass > 1 && tris.rendered <= budget) break;
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.02, target), error, lockBorder: false }));
  tris = countTriangles(doc);
  console.log(`  simplify pass ${pass}: ratio ${target.toFixed(3)} error ${error} -> ${tris.rendered.toLocaleString()} triangles`);
  error *= 2.5;
}

await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

const outPath = resolve(repo, cfg.out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, await io.writeBinary(doc));
const after = countTriangles(doc);
const size = statSync(outPath).size;
console.log(`  -> ${cfg.out}: ${(size / 1e6).toFixed(2)} MB, ${after.rendered.toLocaleString()} rendered / ${after.unique.toLocaleString()} unique triangles, ${root.listMeshes().length} meshes, ${root.listMaterials().length} materials`);
if (size > 3e6) console.warn('  WARNING: over the 3 MB budget');

// Meshopt decoder for <model-viewer meshoptDecoderLocation>.
const decoderOut = resolve(repo, 'public/models/decoders/meshopt.js');
mkdirSync(dirname(decoderOut), { recursive: true });
copyFileSync(resolve(here, 'node_modules/meshoptimizer/meshopt_decoder.cjs'), decoderOut);

writeFileSync(
  resolve(here, `out/${key}.stats.json`),
  JSON.stringify({ key, out: cfg.out, bytes: size, triangles: after, removedNodes: removed, tones: counts }, null, 2),
);
