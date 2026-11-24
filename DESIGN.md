# Design system: "Blueprint minimal"

The site should read like a well-kept engineering drawing set: warm paper, black ink, hairline rules, one signal colour, and the work itself as the image. The look is restrained, so the CAD renders, prototypes and patent line art carry the page.

## Mode
This is a portfolio, so the work leads (Impeccable's "Experience" mode). Case-study pages are long-form reading ("Read" mode).

## Colour (tokens in `src/styles/global.css`)
| Token | Light (`blueprint`) | Dark (`blueprint-dark`) | Use |
|---|---|---|---|
| paper (`base-100`) | `#F6F5F1` | `#0E0F10` | page background |
| ink (`base-content`) | `#121212` | `#EDEDE9` | text, primary button |
| muted | `#5E5E5A` | `#A3A39D` | secondary text, metadata |
| hairline (`base-300`) | `#DAD8D1` | `#26282A` | 1 px rules and frames |
| signal (`primary`) | `#FF4F00` | `#FF6A1F` | focus rings, selection, diagram accents; **never body text** |
| signal-text | `#C23B00` | `#FF7A33` | the rare orange text (≥ 4.5:1 contrast) |

- Theme: an inline head script sets `data-theme` from `localStorage.theme`, falling back to `prefers-color-scheme`. There is no flash on load, and the toggle lives in `src/scripts/site.ts`.
- No gradients, glass, shadows, or rounded corners (daisyUI radius, depth and noise are all 0).

## Type
- **IBM Plex Sans** (400/500/600) for everything, self-hosted through Astro's Fonts API.
- **IBM Plex Mono** only for data: dates, measurements, specs and figure captions (`.meta`).
- Display size is `clamp(2.75rem … 6rem)` with tracking −0.035em. Section titles use `text-title`.
- Body text is 17 px with a 1.6 line height and a measure of about 42rem.

## Layout
- Content sits in `.wrap`: max 75rem wide, with 16 / 24 / 32 px gutters. Desktop uses a 12-column grid.
- Sections are separated by a full-width hairline and generous space. There are no cards-as-structure and no eyebrow labels above headings.
- Images sit in `.frame` (1 px hairline border, white ground for CAD and line art).

## Motion
Motion is one authored moment plus quiet feedback. All of it is disabled under `prefers-reduced-motion`, and content stays visible when JavaScript is off: hidden starting states only apply under `html.js`.
- Hero: the FM13 patent line art draws itself in (`stroke-dashoffset`, `pathLength=1`).
- Sections fade up 10 px once (`[data-reveal]`, IntersectionObserver).
- Hover: underlines draw in (`.link-draw`), images scale 1.025 inside their frame, and arrows nudge 4 px.

## Content rules
- Use only numbers from the sources, and record each one in `docs/facts.md`.
- Name the team and your own role on every team project.
- Don't use third-party images, except the patent drawings and the team's own renders.
