// Extract the perspective view from the FM13 3-view drawing (SOLIDWORKS vector PDF → pdftocairo SVG)
// into a compact stroke-only SVG for the hero.  Usage:
//   pdftocairo -svg FM13_3View.pdf 3view.svg && node tools/img/extract-lineart.mjs 3view.svg src/assets/lineart/fm13-perspective.svg
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , input, output] = process.argv;
const svg = readFileSync(input, 'utf8');
const body = svg.replace(/<defs>[\s\S]*?<\/defs>/, '');
// page region (pt, y down) that holds the perspective view
const R = { x0: 632, x1: 1152, y0: 175, y1: 648 };
const S = 0.999622, TY = 841.675974;

const paths = [...body.matchAll(/<path[^>]*style="([^"]*)"[^>]*d="([^"]+)"/g)];
const byWidth = new Map();
let kept = 0, total = 0;
for (const [, style, d] of paths) {
  if (!/fill:none/.test(style)) continue;
  const w = Number((style.match(/stroke-width:([0-9.]+)/) || [])[1] || 0.7);
  const toks = d.trim().split(/\s+/);
  let sub = [], subs = [];
  for (let i = 0; i < toks.length; ) {
    const c = toks[i++];
    if (c === 'M') { if (sub.length) subs.push(sub); sub = [['M', +toks[i++], +toks[i++]]]; }
    else if (c === 'L') sub.push(['L', +toks[i++], +toks[i++]]);
    else if (c === 'C') sub.push(['C', +toks[i++], +toks[i++], +toks[i++], +toks[i++], +toks[i++], +toks[i++]]);
    else if (c === 'Z') sub.push(['Z']);
  }
  if (sub.length) subs.push(sub);
  for (const s of subs) {
    total++;
    const pts = s.flatMap(([c, ...n]) => { const p = []; for (let k = 0; k < n.length; k += 2) p.push([n[k], TY - S * n[k + 1]]); return p; });
    if (!pts.every(([x, y]) => x >= R.x0 && x <= R.x1 && y >= R.y0 && y <= R.y1)) continue;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const maxX = Math.max(...xs), maxY = Math.max(...ys), minY = Math.min(...ys);
    // drop pieces of the neighbouring orthographic views that fall inside the crop
    if (maxX < 960 && maxY < 322) continue; // side view (above)
    if (maxX < 690 && minY > 436) continue; // front view (left)
    kept++;
    const f = (v) => +v.toFixed(1);
    const str = s.map(([c, ...n]) => c + (n.length ? ' ' + n.map((v, k) => (k % 2 === 0 ? f(v - R.x0) : f(TY - S * v - R.y0))).join(' ') : '')).join(' ');
    const key = w < 0.9 ? 'thin' : 'thick';
    byWidth.set(key, (byWidth.get(key) || '') + str + ' ');
  }
}
const W = R.x1 - R.x0, H = R.y1 - R.y0;
const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
${[...byWidth].map(([k, d]) => `<path class="la-${k}" pathLength="1" stroke-width="${k === 'thin' ? 0.6 : 0.9}" d="${d.trim()}"/>`).join('\n')}
</svg>
`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, out);
console.log(`kept ${kept}/${total} subpaths → ${output} (${(out.length / 1024).toFixed(0)} KB)`);
