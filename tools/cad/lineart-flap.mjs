// Build the flapping FM13 hero drawing from the CAD assembly.
//
//   node lineart-flap.mjs [--debug]
//
// Inputs: out/raw/fm13.glb (SwExport glb of ArmTestAssem13, one node per component, metres) and
// ../../src/assets/lineart/fm13-perspective.svg (the isometric view cut from FM13_3View.pdf by
// tools/img/extract-lineart.mjs). Output: ../../src/assets/lineart/fm13-flap.svg.
//
// 1. The drawing view is SOLIDWORKS' standard isometric at the sheet scale 1:2, so every CAD point
//    projects to the drawing by a fixed linear map; only the offset is fitted (bounding boxes,
//    then refined by aligning projected part outlines with the drawn lines).
// 2. Every component is rasterised with depth. Each drawn subpath is assigned to the nearest
//    visible component along it.
// 3. Moving parts are the Wing folder parts (spar, rib1-3, wingfoam, WingJoint13), the
//    joints (joint13L, joint13R, Mirrorjoint13L) and the two BigPin11 pins mated in each joint;
//    the Niddle bearing turns inside the pins and stays with the body. They rotate about the joint's hinge pin in
//    joint_holder13 (concentric mates, read with `SwExport mates`): an axis parallel to the
//    body (model Z) at x = 11.299 mm (joints at x < 0) or 35.599 mm (x > 0), y = 5.66 mm.
// 4. For each moving subpath the depth gives its offset n from the wing plane (spanned by the
//    hinge axis and the spar), so the client can rotate it exactly: lines are binned by n and
//    each bin gets its own transform (see src/scripts/flap.ts).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { readTess } from './merge-tess.mjs';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src/assets/lineart/fm13-perspective.svg');
const OUT = resolve(here, '../../src/assets/lineart/fm13-flap.svg');
const DEBUG = process.argv.includes('--debug');

// Drawn lines that always stay with the body, as svg segments [x0, y0, x1, y1] (owner review):
// the bottom front edge of the gearbox block, which the drawing shows a little lower than the
// current face-1 cover plate, so the joint in front of it would otherwise claim it.
const STATIC_LINES = [[210.3, 231.3, 222.8, 224.1]];
const HINGE_X = { left: 11.299, right: 35.599 }; // mm, from the joint13 ↔ joint_holder13 concentric mates
const HINGE_Y = 5.66;
const MOVING = /^(spar|rib[123]|wingfoam|Mirrorwingfoam|WingJoint13|joint13L|joint13R|Mirrorjoint13L|BigPin11)-/;

// --- projection (mm → svg units) -------------------------------------------------------------
const S = (0.5 * 72) / 25.4; // svg units (pt) per mm at 1:2
// The drawing's isometric looks at the assembly from (−X, +Y, −Z): with this basis the projected
// part outlines match the drawn lines with no residual shift (6590 matching outline pixels), while
// the view from +X needs a 4-unit fudge and matches far fewer (4381). The mechanism is nearly
// mirror-symmetric, so only the depth order and the asymmetric parts tell the two apart.
const RV = [1 / Math.SQRT2, 0, -1 / Math.SQRT2]; // screen right
const UV = [1 / Math.sqrt(6), 2 / Math.sqrt(6), 1 / Math.sqrt(6)]; // screen up
const VV = [-1 / Math.sqrt(3), 1 / Math.sqrt(3), -1 / Math.sqrt(3)]; // toward the viewer
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lin = (v) => [S * dot(RV, v), -S * dot(UV, v)]; // projected direction (svg units per mm)
let OX = 0, OY = 0;
const proj = (p) => [S * dot(RV, p) + OX, -S * dot(UV, p) + OY];

// --- load CAD ----------------------------------------------------------------------------------
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(resolve(here, 'out/raw/fm13.glb'));
const rootName = doc.getRoot().listScenes()[0].listChildren().find((n) => n.listChildren().length > 3)?.getName();
const compOf = (n) => { let p = n; while (p.getParentNode?.() && p.getParentNode().getName() !== rootName) p = p.getParentNode(); return p.getName(); };
const comps = []; // { name, tris: Float64Array (mm, 9 per triangle) }
const byName = new Map();
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh(); if (!m) continue;
  const name = compOf(n);
  const W = n.getWorldMatrix();
  const tri = [];
  for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), idx = p.getIndices(); const v = [0, 0, 0];
    const P = (i) => { pos.getElement(i, v); return [1000 * (W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12]), 1000 * (W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13]), 1000 * (W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14])]; };
    const cnt = idx ? idx.getCount() : pos.getCount();
    for (let i = 0; i < cnt; i += 3) for (let k = 0; k < 3; k++) tri.push(...P(idx ? idx.getScalar(i + k) : i + k));
  }
  if (!byName.has(name)) { byName.set(name, { name, id: comps.length, tris: [] }); comps.push(byName.get(name)); }
  byName.get(name).tris.push(...tri);
}
// Components hidden in the assembly's current display state are missing from the glb but shown in
// the drawing (face-1, the cover plate on the front of the gearbox): add their SwExport tessellation,
//   SwExport tess --src ArmTestAssem13.SLDASM --only face-1 --attach 1 --hidden 1 --out out/raw/fm13-face.tess
const extra = resolve(here, 'out/raw/fm13-face.tess');
if (existsSync(extra)) {
  for (const b of readTess(extra)) {
    const a = b.xf, sc = a[12] || 1, tri = [];
    for (let i = 0; i < b.pos.length; i += 3) {
      const [x, y, z] = [b.pos[i], b.pos[i + 1], b.pos[i + 2]];
      tri.push(1000 * (sc * (x * a[0] + y * a[3] + z * a[6]) + a[9]), 1000 * (sc * (x * a[1] + y * a[4] + z * a[7]) + a[10]), 1000 * (sc * (x * a[2] + y * a[5] + z * a[8]) + a[11]));
    }
    if (!byName.has(b.comp)) { byName.set(b.comp, { name: b.comp, id: comps.length, tris: [] }); comps.push(byName.get(b.comp)); }
    byName.get(b.comp).tris.push(...tri);
  }
}
console.log(`${comps.length} components, ${comps.reduce((a, c) => a + c.tris.length / 9, 0).toLocaleString()} triangles`);

// --- drawing -------------------------------------------------------------------------------------
const svg = readFileSync(SRC, 'utf8');
const VB = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const subs = [];
for (const [, cls, d] of svg.matchAll(/class="la-(thin|thick)"[^>]*d="([^"]+)"/g)) {
  for (const sub of d.trim().split(/(?=M )/)) {
    const n = sub.match(/-?[\d.]+/g).map(Number); const pts = [];
    for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
    subs.push({ cls, d: sub.trim(), pts });
  }
}

// --- offset: bounding boxes, then outline alignment ---------------------------------------------
{
  let a = [Infinity, -Infinity, Infinity, -Infinity], b = [Infinity, -Infinity, Infinity, -Infinity];
  for (const c of comps) for (let i = 0; i < c.tris.length; i += 3) { const [x, y] = proj([c.tris[i], c.tris[i + 1], c.tris[i + 2]]); a = [Math.min(a[0], x), Math.max(a[1], x), Math.min(a[2], y), Math.max(a[3], y)]; }
  for (const s of subs) for (const [x, y] of s.pts) b = [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], y), Math.max(b[3], y)];
  OX = (b[0] + b[1]) / 2 - (a[0] + a[1]) / 2; OY = (b[2] + b[3]) / 2 - (a[2] + a[3]) / 2;
}

const RES = 8; // pixels per svg unit
const W = Math.ceil(VB[2] * RES), H = Math.ceil(VB[3] * RES);
function rasterise() {
  const depth = new Float32Array(W * H).fill(-Infinity), id = new Int16Array(W * H).fill(-1);
  for (const c of comps) {
    const t = c.tris;
    for (let i = 0; i < t.length; i += 9) {
      const p = [0, 1, 2].map((k) => { const P = [t[i + 3 * k], t[i + 3 * k + 1], t[i + 3 * k + 2]]; const [x, y] = proj(P); return [(x - VB[0]) * RES, (y - VB[1]) * RES, dot(VV, P)]; });
      const minx = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), maxx = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
      const miny = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), maxy = Math.min(H - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
      const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((p[1][0] - px) * (p[2][1] - py) - (p[2][0] - px) * (p[1][1] - py)) / area;
        const w1 = ((p[2][0] - px) * (p[0][1] - py) - (p[0][0] - px) * (p[2][1] - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2];
        const k = y * W + x;
        if (z > depth[k]) { depth[k] = z; id[k] = c.id; }
      }
    }
  }
  return { depth, id };
}
function lineMask() {
  const m = new Uint8Array(W * H);
  for (const s of subs) for (let i = 1; i < s.pts.length; i++) {
    const [x0, y0] = s.pts[i - 1], [x1, y1] = s.pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * RES * 2));
    for (let j = 0; j <= n; j++) { const x = Math.floor(((x0 + ((x1 - x0) * j) / n) - VB[0]) * RES), y = Math.floor(((y0 + ((y1 - y0) * j) / n) - VB[1]) * RES); if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1; }
  }
  return m;
}

let buf = rasterise();
const PROBE = process.argv.find((a) => a.startsWith('--probe='));
const INSPECT = process.argv.find((a) => a.startsWith('--inspect='))?.slice(10).split(',').map(Number);
{
  // outline pixels of the CAD raster (part boundaries) vs drawn lines: search a small shift
  const edge = [];
  for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
    const k = y * W + x, a = buf.id[k];
    if (a !== buf.id[k + 1] || a !== buf.id[k + W]) edge.push([x, y]);
  }
  const lm = lineMask();
  // dilate the line mask by 1 px
  const dl = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; if (lm[k] || lm[k - 1] || lm[k + 1] || lm[k - W] || lm[k + W]) dl[k] = 1; }
  let best = { score: -1 };
  for (let dy = -80; dy <= 80; dy += 2) for (let dx = -80; dx <= 80; dx += 2) {
    let sc = 0;
    for (let i = 0; i < edge.length; i += 3) { const x = edge[i][0] + dx, y = edge[i][1] + dy; if (x >= 0 && y >= 0 && x < W && y < H && dl[y * W + x]) sc++; }
    if (sc > best.score) best = { score: sc, dx, dy };
  }
  console.log(`outline alignment: shift ${(best.dx / RES).toFixed(2)}, ${(best.dy / RES).toFixed(2)} svg units (${best.score} matches)`);
  OX += best.dx / RES; OY += best.dy / RES;
  buf = rasterise();
}

if (PROBE) {
  { const f = byName.get('face-1'); if (f) { let b = [1e9, -1e9, 1e9, -1e9]; for (let i = 0; i < f.tris.length; i += 3) { const [x, y] = proj([f.tris[i], f.tris[i + 1], f.tris[i + 2]]); b = [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], y), Math.max(b[3], y)]; } console.log('face-1 projected bbox', b.map((v) => v.toFixed(1)).join(', ')); } }
  // list every component covering the given svg points, nearest first: --probe=x,y;x,y
  for (const nm of ['Plate1-1', 'Plate2-1', 'ServoMotor-1', 'ServoMotor-3', 'ServoHolder1-1', 'ServoHolder2-1', 'MotorHolder-1', 'F15-1', 'face-1', 'Mirrorjoint13L-4', 'joint13L-2']) {
    const f = byName.get(nm); if (!f) continue; let b = [1e9, -1e9, 1e9, -1e9];
    for (let i = 0; i < f.tris.length; i += 3) { const [x, y] = proj([f.tris[i], f.tris[i + 1], f.tris[i + 2]]); b = [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], y), Math.max(b[3], y)]; }
    console.log('bbox', nm.padEnd(18), b.map((v) => v.toFixed(1)).join(', '));
  }
  for (const pt of PROBE.slice(8).split(';')) {
    const [qx, qy] = pt.split(',').map(Number); const hits = [];
    for (const c of comps) { const t = c.tris; let best = -Infinity;
      for (let i = 0; i < t.length; i += 9) {
        const p = [0, 1, 2].map((k) => { const P = [t[i + 3 * k], t[i + 3 * k + 1], t[i + 3 * k + 2]]; const [x, y] = proj(P); return [x, y, dot(VV, P)]; });
        const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]); if (Math.abs(area) < 1e-12) continue;
        const w0 = ((p[1][0] - qx) * (p[2][1] - qy) - (p[2][0] - qx) * (p[1][1] - qy)) / area, w1 = ((p[2][0] - qx) * (p[0][1] - qy) - (p[0][0] - qx) * (p[2][1] - qy)) / area, w2 = 1 - w0 - w1;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) best = Math.max(best, w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2]);
      }
      if (best > -Infinity) hits.push([c.name, best]); }
    hits.sort((a, b) => b[1] - a[1]);
    console.log(`probe ${qx},${qy}:`, hits.map(([n, z]) => `${n} (${z.toFixed(1)})`).join('  >  '));
  }
  process.exit(0);
}

// --- assign subpaths --------------------------------------------------------------------------
const R0 = Math.round(0.5 * RES); // neighbourhood radius in px
function pick(x, y) {
  const cx = Math.floor((x - VB[0]) * RES), cy = Math.floor((y - VB[1]) * RES);
  let bz = -Infinity, bi = -1;
  for (let j = -R0; j <= R0; j++) for (let i = -R0; i <= R0; i++) {
    if (i * i + j * j > R0 * R0) continue;
    const X = cx + i, Y = cy + j; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const k = Y * W + X; if (buf.id[k] >= 0 && buf.depth[k] > bz) { bz = buf.depth[k]; bi = buf.id[k]; }
  }
  return [bi, bz];
}
const toWorld = (x, y, z) => { const sx = (x - OX) / S, sy = -(y - OY) / S; return [sx * RV[0] + sy * UV[0] + z * VV[0], sx * RV[1] + sy * UV[1] + z * VV[1], sx * RV[2] + sy * UV[2] + z * VV[2]]; };

// wings: derive side/axle and spar direction from the CAD
const centroid = (c) => { let x = 0, y = 0, z = 0; const n = c.tris.length / 3; for (let i = 0; i < c.tris.length; i += 3) { x += c.tris[i]; y += c.tris[i + 1]; z += c.tris[i + 2]; } return [x / n, y / n, z / n]; };
const zMid = (() => { const zs = comps.filter((c) => /^spar-/.test(c.name)).map((c) => centroid(c)[2]); return (Math.min(...zs) + Math.max(...zs)) / 2; })();
const xMid = (HINGE_X.left + HINGE_X.right) / 2;
const wingKey = (c) => { const [x, , z] = centroid(c); return `${z > zMid ? 'f' : 'r'}${x < xMid ? 'L' : 'R'}`; };
const wings = {};
for (const c of comps) {
  if (!/^spar-/.test(c.name)) continue;
  const k = wingKey(c);
  // principal direction of the spar (power iteration on the covariance), pointing outboard
  const m = centroid(c); const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < c.tris.length; i += 3) { const d = [c.tris[i] - m[0], c.tris[i + 1] - m[1], c.tris[i + 2] - m[2]]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b]; }
  let v = [1, 0.3, 0.1]; for (let it = 0; it < 60; it++) { const w = [dot(C[0], v), dot(C[1], v), dot(C[2], v)]; const n = Math.hypot(...w); v = w.map((q) => q / n); }
  const hx = k[1] === 'L' ? HINGE_X.left : HINGE_X.right;
  if ((m[0] - hx) * v[0] < 0) v = v.map((q) => -q);
  v[2] = 0; { const n = Math.hypot(...v); v = v.map((q) => q / n); } // spars are perpendicular to the body axis
  let nrm = [-v[1], v[0], 0]; // Z × v, in the plane perpendicular to the hinge axis
  if (nrm[1] < 0) nrm = nrm.map((q) => -q); // +n points up, so rotating D toward N raises the wing
  const A3 = [hx, HINGE_Y, m[2]];
  wings[k] = { A3, D0: v, N0: nrm, phi0: (Math.asin(v[1]) * 180) / Math.PI, front: k[0] === 'f', bins: new Map() };
}
for (const [k, w] of Object.entries(wings)) console.log(`wing ${k}: spar at ${w.phi0.toFixed(2)}°, hinge (${w.A3.map((q) => q.toFixed(2)).join(', ')})`);

const groups = { body: { thin: [], thick: [] } };
const stat = {};
for (const s of subs) {
  const votes = new Map(); const samples = [];
  for (let i = 1; i < s.pts.length || i === 1; i++) {
    const [x0, y0] = s.pts[i - 1], [x1, y1] = s.pts[Math.min(i, s.pts.length - 1)];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.25));
    for (let j = 0; j <= n; j++) { const x = x0 + ((x1 - x0) * j) / n, y = y0 + ((y1 - y0) * j) / n; const [ci, z] = pick(x, y); if (ci < 0) continue; votes.set(ci, (votes.get(ci) ?? 0) + 1); samples.push([x, y, z, ci]); }
    if (s.pts.length === 1) break;
  }
  let ci = -1, top = 0; for (const [c, v] of votes) if (v > top) { top = v; ci = c; }
  const comp = ci >= 0 ? comps[ci] : null;
  if (INSPECT) {
    const xs = s.pts.map((q) => q[0]), ys = s.pts.map((q) => q[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    if (cx >= INSPECT[0] && cx <= INSPECT[2] && cy >= INSPECT[1] && cy <= INSPECT[3])
      console.log('inspect', subs.indexOf(s), `(${cx.toFixed(1)},${cy.toFixed(1)})`, comp ? comp.name : '-', [...votes].map(([c, v]) => `${comps[c].name}:${v}`).join(' '), s.d.slice(0, 60));
  }
  const onStatic = STATIC_LINES.some(([x0, y0, x1, y1]) => s.pts.every(([x, y]) => {
    const dx = x1 - x0, dy = y1 - y0, u = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - x0 - u * dx, y - y0 - u * dy) < 0.3;
  }));
  if (onStatic || !comp || !MOVING.test(comp.name)) { groups.body[s.cls].push(s.d); continue; }
  const k = wingKey(comp), w = wings[k];
  const ns = samples.filter((q) => q[3] === ci).map(([x, y, z]) => { const P = toWorld(x, y, z); return dot([P[0] - w.A3[0], P[1] - w.A3[1], P[2] - w.A3[2]], w.N0); }).sort((a, b) => a - b);
  const nOff = Math.round(ns[Math.floor(ns.length / 2)] * 2) / 2; // 0.5 mm bins
  if (!w.bins.has(nOff)) w.bins.set(nOff, { thin: [], thick: [] });
  w.bins.get(nOff)[s.cls].push(s.d);
  stat[comp.name.replace(/-\d+$/, '')] = (stat[comp.name.replace(/-\d+$/, '')] ?? 0) + 1;
}
console.log('moving subpaths by part:', stat);

// --- write -------------------------------------------------------------------------------------
const pathEls = (g) => ['thin', 'thick'].filter((c) => g[c].length).map((c) => `<path class="la-${c}" pathLength="1" stroke-width="${c === 'thin' ? 0.6 : 0.9}" d="${g[c].join(' ')}"/>`).join('');
const r4 = (v) => +v.toFixed(4);
const flap = Object.fromEntries(Object.entries(wings).map(([k, w]) => [k, {
  a: proj(w.A3).map(r4), z: lin([0, 0, 1]).map(r4), d: lin(w.D0).map(r4), n: lin(w.N0).map(r4), phi0: +w.phi0.toFixed(3), front: w.front,
}]));
const order = ['rR', 'rL', 'fR', 'fL'];
const wingEls = order.filter((k) => wings[k]).map((k) =>
  `<g class="la-wing" data-wing="${k}">${[...wings[k].bins].sort((a, b) => a[0] - b[0]).map(([n, g]) => `<g data-n="${n}">${pathEls(g)}</g>`).join('')}</g>`).join('\n');
const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.join(' ')}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" data-flap='${JSON.stringify(flap)}'>
${wingEls}
<g class="la-body">${pathEls(groups.body)}</g>
</svg>
`;
writeFileSync(OUT, out);
console.log(`→ ${OUT} (${(out.length / 1024).toFixed(0)} KB), bins per wing:`, Object.fromEntries(Object.entries(wings).map(([k, w]) => [k, w.bins.size])));

if (DEBUG) {
  // raster of the part ids (moving parts tinted per wing) for overlay checks
  const tint = { fL: [228, 87, 46], fR: [212, 160, 12], rL: [46, 134, 171], rR: [76, 154, 42] };
  const rgb = Buffer.alloc(W * H * 3, 255);
  for (let k = 0; k < W * H; k++) { const c = buf.id[k]; if (c < 0) continue; const comp = comps[c]; const col = MOVING.test(comp.name) ? tint[wingKey(comp)] : [200, 200, 200]; rgb[3 * k] = col[0] * 0.5 + 127; rgb[3 * k + 1] = col[1] * 0.5 + 127; rgb[3 * k + 2] = col[2] * 0.5 + 127; }
  writeFileSync(resolve(here, 'out/flap-ids.ppm'), Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), rgb]));
  console.log(`debug raster out/flap-ids.ppm (${W}x${H}); offset ${OX.toFixed(3)}, ${OY.toFixed(3)}`);
}
