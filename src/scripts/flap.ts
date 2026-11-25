// Flap the FM13 hero drawing's wings about their real hinges (data from tools/cad/lineart-flap.mjs).
//
// Each wing (Wing-folder parts + its joint13) rotates about its hinge pin in joint_holder13, an
// axis parallel to the body. In the wing's frame a point is P = A + z·Z + t·D + n·N (Z the hinge
// axis, D the spar direction, N the normal pointing up), and a flap by Δ turns D and N about Z.
// Projected to the drawing that is, for all lines with the same offset n,
//   p' = M p + (a − M a) + n (N' − M N0'),   M = [Z' | D'(Δ)] · [Z' | D0']⁻¹,
// so lines are grouped by n and each group gets one transform per frame.
// Front and rear pairs beat in antiphase through the real ±22.5° stroke.

const AMP = 22.5; // degrees
const PERIOD = 1400; // ms per wingbeat (the real mechanism runs at about 20 Hz)
const START = 2800; // ms after load, once the line drawing has finished
const BLEND = 500; // ms to ease from the drawn pose into the stroke

type V2 = [number, number];
type WingData = { a: V2; z: V2; d: V2; n: V2; phi0: number; front: boolean };
type Bin = { el: SVGGElement; n: number };
type Wing = WingData & { bins: Bin[]; inv: [number, number, number, number] };

const rad = (deg: number) => (deg * Math.PI) / 180;

function setup(svg: SVGSVGElement): Wing[] {
  const data = JSON.parse(svg.dataset.flap ?? '{}') as Record<string, WingData>;
  return [...svg.querySelectorAll<SVGGElement>('.la-wing')].flatMap((g) => {
    const w = data[g.dataset.wing ?? ''];
    if (!w) return [];
    const det = w.z[0] * w.d[1] - w.d[0] * w.z[1];
    const inv: Wing['inv'] = [w.d[1] / det, -w.d[0] / det, -w.z[1] / det, w.z[0] / det];
    const bins = [...g.querySelectorAll<SVGGElement>(':scope > g[data-n]')].map((el) => ({ el, n: Number(el.dataset.n) }));
    return [{ ...w, bins, inv }];
  });
}

function pose(w: Wing, delta: number) {
  const c = Math.cos(delta), s = Math.sin(delta);
  const D: V2 = [c * w.d[0] + s * w.n[0], c * w.d[1] + s * w.n[1]];
  const N: V2 = [-s * w.d[0] + c * w.n[0], -s * w.d[1] + c * w.n[1]];
  const [i00, i01, i10, i11] = w.inv;
  const m00 = w.z[0] * i00 + D[0] * i10, m01 = w.z[0] * i01 + D[0] * i11;
  const m10 = w.z[1] * i00 + D[1] * i10, m11 = w.z[1] * i01 + D[1] * i11;
  const bx = w.a[0] - (m00 * w.a[0] + m01 * w.a[1]);
  const by = w.a[1] - (m10 * w.a[0] + m11 * w.a[1]);
  const kx = N[0] - (m00 * w.n[0] + m01 * w.n[1]);
  const ky = N[1] - (m10 * w.n[0] + m11 * w.n[1]);
  const m = `${m00.toFixed(5)} ${m10.toFixed(5)} ${m01.toFixed(5)} ${m11.toFixed(5)}`;
  for (const b of w.bins) b.el.setAttribute('transform', `matrix(${m} ${(bx + b.n * kx).toFixed(3)} ${(by + b.n * ky).toFixed(3)})`);
}

const host = document.querySelector<HTMLElement>('.lineart-draw');
const svg = host?.querySelector<SVGSVGElement>('svg[data-flap]');
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (host && svg) {
  const wings = setup(svg);
  let visible = true;
  let ready = false; // set once the line drawing has finished
  let raf = 0;
  let t0 = 0;
  let elapsed = 0; // beat time accumulated before a pause

  const frame = (now: number) => {
    const t = elapsed + (now - t0);
    const c = Math.cos((2 * Math.PI * t) / PERIOD);
    const k = Math.min(1, t / BLEND);
    const ease = k * k * (3 - 2 * k);
    for (const w of wings) {
      const target = (w.front ? 1 : -1) * AMP * c;
      pose(w, rad(ease * (target - w.phi0)));
    }
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    if (raf || !ready || !visible || motion.matches) return;
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
    elapsed += performance.now() - t0;
  };

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) run();
    else stop();
  }).observe(host);
  motion.addEventListener('change', () => {
    if (motion.matches) {
      stop();
      for (const w of wings) for (const b of w.bins) b.el.removeAttribute('transform'); // back to the drawn pose
    } else run();
  });
  setTimeout(() => {
    ready = true;
    run();
  }, Math.max(0, START - performance.now()));
}
