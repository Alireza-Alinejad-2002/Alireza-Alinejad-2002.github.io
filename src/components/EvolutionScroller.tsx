// M1 → M4 design evolution as a sticky, scroll-driven sequence (lg and up).
// Server-rendered as a plain list with inline images, so it reads fine without JS
// and on small screens. After hydration, on wide screens, the image panel sticks
// and crossfades to the step in the middle of the viewport.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'motion/react';

export interface EvolutionStep {
  id: string;
  name: string;
  alt: string;
  what: string;
  result: string;
  verdict: string;
  img: { src: string; srcset: string; width: number; height: number };
}

export default function EvolutionScroller({ steps }: { steps: EvolutionStep[] }) {
  const [active, setActive] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: list, offset: ['start 55%', 'end 55%'] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    setHydrated(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const step = steps[active];
  const fade = reduce ? { duration: 0 } : { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="not-prose my-10 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
      {/* Sticky panel: wide screens only, and only once JS runs (the list has its own images). */}
      <div className={hydrated ? 'hidden lg:block' : 'hidden'} aria-hidden="true">
        <div className="sticky top-24">
          <div className="frame relative aspect-[4/3] overflow-hidden border border-hairline bg-white">
            <AnimatePresence initial={false}>
              <motion.img
                key={step.id}
                src={step.img.src}
                srcSet={step.img.srcset}
                sizes="(min-width: 1024px) 420px, 100vw"
                width={step.img.width}
                height={step.img.height}
                alt=""
                className="absolute inset-0 size-full object-cover"
                initial={{ opacity: 0, scale: reduce ? 1 : 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={fade}
              />
            </AnimatePresence>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="meta tabular-nums">
              {step.id} / {steps[steps.length - 1].id}
            </span>
            <div className="relative h-px flex-1 bg-hairline">
              <motion.div className="absolute inset-0 origin-left bg-signal" style={{ scaleX: reduce ? scrollYProgress : progress }} />
            </div>
            <span className="meta">{step.name}</span>
          </div>
        </div>
      </div>

      <ol ref={list} className="border-t border-hairline">
        {steps.map((s, i) => {
          const dim = hydrated && i !== active;
          return (
            <li
              key={s.id}
              ref={(el) => {
                items.current[i] = el;
              }}
              data-index={i}
              className={
                'grid gap-4 border-b border-hairline py-6 sm:grid-cols-[9rem_1fr] md:grid-cols-[11rem_1fr] ' +
                'transition-opacity duration-500 ' +
                (hydrated ? 'lg:flex lg:min-h-[52vh] lg:flex-col lg:justify-center lg:py-10 ' : '') +
                (dim ? 'lg:opacity-35' : '')
              }
            >
              <div className={'frame aspect-[4/3] border border-hairline bg-white ' + (hydrated ? 'lg:hidden' : '')}>
                <img
                  src={s.img.src}
                  srcSet={s.img.srcset}
                  sizes="11rem"
                  width={s.img.width}
                  height={s.img.height}
                  alt={s.alt}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-lg font-medium">
                    <span className="font-mono text-muted">{s.id}</span> {s.name}
                  </h3>
                  <span className={'meta shrink-0' + (s.verdict === 'Final' ? ' !text-signal-text' : '')}>{s.verdict}</span>
                </div>
                <p className="mt-1.5">{s.what}</p>
                <p className="mt-1.5 text-muted">{s.result}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
