// Read a SwExport `tess` file (part-space tessellation of solid + surface bodies) and add it
// to a glTF document. Used for geometry the SOLIDWORKS glTF add-in skips (sheet bodies).
//
// Each body is attached as a child of the node whose name equals its component name
// (the add-in writes one node per component, carrying the component transform). If no such
// node exists (tess-only models), a node is created under the scene with the component
// transform from SOLIDWORKS (Transform2.ArrayData).

import { readFileSync } from 'node:fs';

export function readTess(path) {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = buf.subarray(0, 8).toString('latin1');
  if (magic !== 'SWTESS1\0') throw new Error(`${path}: not a SWTESS1 file`);
  let o = 8;
  const i32 = () => { const v = dv.getInt32(o, true); o += 4; return v; };
  const f32 = () => { const v = dv.getFloat32(o, true); o += 4; return v; };
  const f64 = () => { const v = dv.getFloat64(o, true); o += 8; return v; };
  const str = () => { const n = i32(); const s = buf.subarray(o, o + n).toString('utf8'); o += n; return s; };
  const count = i32();
  const bodies = [];
  for (let b = 0; b < count; b++) {
    const comp = str();
    const name = str();
    const xf = Array.from({ length: 16 }, f64);
    const color = [f32(), f32(), f32()];
    const tris = i32();
    const n = tris * 9;
    // copy out: the source offset is not guaranteed to be 4-byte aligned
    const pos = new Float32Array(n);
    for (let k = 0; k < n; k++) pos[k] = f32();
    const nrm = new Float32Array(n);
    for (let k = 0; k < n; k++) nrm[k] = f32();
    bodies.push({ comp, name, xf, color, pos, nrm });
  }
  return bodies;
}

// SOLIDWORKS: p' = s * p R + t (row vectors), ArrayData = [R (row-major 3x3), t, s, 0,0,0]
function swToMatrix(a) {
  const s = a[12] || 1;
  return [
    a[0] * s, a[1] * s, a[2] * s, 0,
    a[3] * s, a[4] * s, a[5] * s, 0,
    a[6] * s, a[7] * s, a[8] * s, 0,
    a[9], a[10], a[11], 1,
  ];
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function mergeTess(doc, tessPath, { log = console.log } = {}) {
  const root = doc.getRoot();
  const scene = root.listScenes()[0] ?? root.setDefaultScene(doc.createScene('Scene')).listScenes()[0];
  if (!root.getDefaultScene()) root.setDefaultScene(scene);
  const buffer = root.listBuffers()[0] ?? doc.createBuffer();
  const byName = new Map();
  for (const n of root.listNodes()) if (!byName.has(n.getName())) byName.set(n.getName(), n);
  const mats = new Map();
  const created = new Map();
  let attached = 0, standalone = 0, tris = 0;

  for (const b of readTess(tessPath)) {
    const key = b.color[0] < 0 ? 'none' : b.color.map((c) => c.toFixed(3)).join(',');
    let mat = mats.get(key);
    if (mat === undefined && key !== 'none') {
      mat = doc.createMaterial(`tess-${key}`).setBaseColorFactor([...b.color.map(srgbToLinear), 1]);
      mats.set(key, mat);
    }
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(b.pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(b.nrm).setBuffer(buffer));
    if (mat) prim.setMaterial(mat);
    const mesh = doc.createMesh(b.name).addPrimitive(prim);
    const node = doc.createNode(b.name).setMesh(mesh);
    tris += b.pos.length / 9;

    let parent = byName.get(b.comp);
    if (!parent) {
      parent = created.get(b.comp);
      if (!parent) {
        parent = doc.createNode(b.comp).setMatrix(swToMatrix(b.xf));
        scene.addChild(parent);
        created.set(b.comp, parent);
      }
      standalone++;
    } else attached++;
    parent.addChild(node);
  }
  log(`  merged tess ${tessPath.split(/[\\/]/).pop()}: ${attached} bodies under existing nodes, ${standalone} under new component nodes, ${tris.toLocaleString()} triangles`);
}
