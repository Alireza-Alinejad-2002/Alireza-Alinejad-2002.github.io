# alireza-alinejad-2002.github.io

Personal portfolio of Alireza Alinejad. It is built with [Astro](https://astro.build) 7, Tailwind CSS 4 and daisyUI 5, and deployed to GitHub Pages by `.github/workflows/deploy.yml`, which builds on every push and deploys only from `main`.

## Run locally
```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # astro check + static build into dist/
npm run preview
```

## Where things live
| What | Where |
|---|---|
| Home page | `src/pages/index.astro` |
| Bio, education, TA roles, skills, honors, certifications, publications | `src/data/profile.ts` |
| Project case studies (one MDX file each) | `src/content/projects/*.mdx` (schema in `src/content.config.ts`) |
| Shared SITL section | `src/content/partials/sitl.mdx` |
| Images (optimized at build time) | `src/assets/` |
| Files served as-is (CV, thesis, PDFs, certificates) | `public/` |
| Design tokens and theme | `src/styles/global.css`, `DESIGN.md` |
| Sources for every published number | `docs/facts.md` |

**Keep these paths**: `public/assets/CV_AlirezaAlinejad.pdf`, `public/assets/BScThesis_AlirezaAlinejad.pdf` and `public/images/certifications/*`. The CV PDF links to them.

## Adding a project
Create `src/content/projects/<slug>.mdx` with the frontmatter fields from `content.config.ts`. Set `order` to its position, put its images in `src/assets/projects/<slug>/`, and it appears on the home page and at `/work/<slug>/`.

## Asset tools
- `tools/img/prepare.py`: crops, resizes (≤ 2560 px) and strips metadata from source figures. Run it with miniconda Python and pass the folder of `pdfimages` extracts.
- `tools/img/extract-lineart.mjs`: cuts the perspective view out of the FM13 3-view drawing (`pdftocairo -svg`) for the hero.
- `tools/cad/` (not deployed): the SOLIDWORKS → PNG/GLB pipeline. Its Node dependencies are in `tools/cad/package.json`, and its outputs go to `tools/cad/out/`, which is gitignored.
  1. Build the helper with `build.cmd`. It needs .NET Framework `csc.exe` and the SOLIDWORKS 2025 interop DLLs.
  2. Start SOLIDWORKS yourself; the helper attaches to it. `SwExport.exe` opens every model read-only, never saves, and restores system settings when it finishes. Its commands:
     - `audit` lists components and imported parts.
     - `render` writes the PNG views; finish them with `postprocess.py`.
     - `glb` uses the native glTF add-in.
     - `tess` tessellates the surface bodies the add-in skips.
  3. Run `node build-glb.mjs <fm13|aeronex|manticores>`. It merges the `tess` output, applies the exclusions and brand tones from `models.json`, simplifies to the triangle budget and writes a meshopt-compressed `public/models/*.glb`.
- `tools/cad/lineart-flap.mjs`: builds the flapping hero drawing `src/assets/lineart/fm13-flap.svg`.
  - It projects the FM13 assembly (`out/raw/fm13.glb`, plus `face-1` from `tess --attach 1 --hidden 1`) onto the isometric line art.
  - It assigns each drawn line to its CAD part, so only the `Wing` folder parts and the `joint13` joints move.
  - It records each line's depth relative to its wing.
  - `src/scripts/flap.ts` then rotates each wing about its hinge pin. The hinge axes come from the `joint13`/`joint_holder13` concentric mates (`SwExport mates`).
  - Add `--debug` to write a part raster for overlay checks.
