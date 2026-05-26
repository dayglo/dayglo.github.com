---
name: build-cv-pdf
description: Rebuild Emma Nelson's CV PDF from emma-resume.html. Use whenever the CV HTML is edited (wording, roles, dates, fonts, layout) and a fresh "Emma Nelson CV.pdf" is needed, or when asked to regenerate / rebuild / re-export the CV. Renders the live HTML to a print-tuned 2-page A4 PDF with the correct fonts, verifies the page count and header layout, copies the PDF to the repo root, and (by default) commits, pushes, and delivers it.
---

# Build the CV PDF

`emma-resume.html` is the live web CV. `Emma Nelson CV.pdf` (repo root) is the
downloadable export linked from the site's "Download PDF CV" button. This skill
regenerates that PDF so it matches the HTML.

## How the build works

Rendering happens in `.pdfbuild/` — a **gitignored, ephemeral** toolchain
(headless Chrome, puppeteer-core, vendored Tailwind). It does NOT survive a
fresh container. The committed source of truth for the scripts lives in this
skill folder; `setup.sh` reconstructs `.pdfbuild/` from them.

Toolchain pinned versions:
- Chrome for Testing **131.0.6778.204** (chrome-headless-shell, linux64)
- **puppeteer-core 21.11.0**
- **Tailwind v2.2.19** — vendored locally because the HTML's `unpkg.com`
  CDN link is blocked by the network policy
- Fonts (Archivo, Archivo Narrow, IBM Plex Sans, Julius Sans One) are pulled
  live from Google Fonts at render time, so the render step needs network
  access to `fonts.googleapis.com` / `fonts.gstatic.com`.

`render.js` applies print overrides (white background, hidden download button,
3-column work grid, compact font sizes) to fit the CV onto **2 A4 pages**.

## Steps

1. **Ensure the toolchain exists.** If `.pdfbuild/chrome-headless-shell-linux64/chrome-headless-shell`,
   `.pdfbuild/node_modules/puppeteer-core`, or `.pdfbuild/tailwind.min.css` is
   missing (e.g. fresh container), rebuild it:
   ```bash
   bash .claude/skills/build-cv-pdf/setup.sh
   ```
   If `setup.sh` itself was changed, it re-copies `render.js`/`shot.js` into
   `.pdfbuild/`. Always re-run it after editing those scripts.

2. **Render the PDF and check the page count.**
   ```bash
   cd .pdfbuild && node render.js && \
   python3 -c "import re;d=open('Emma Nelson CV.pdf','rb').read();print('pages:',len(re.findall(rb'/Type\s*/Page[^s]',d)))"
   ```
   Expect `pages: 2`. If it spills to 3, tighten spacing/font sizes in the
   `printCss` block of `render.js` (or trim content) and re-render.

3. **Visually verify layout** when a change affects the header or could wrap
   (e.g. the credential line under the name). From `.pdfbuild`:
   ```bash
   node shot.js                       # writes .pdfbuild/cv-top.png
   ```
   Read `cv-top.png` and confirm nothing wraps awkwardly or overflows.

4. **Copy the PDF to the repo root** (this is the file the site serves):
   ```bash
   cp ".pdfbuild/Emma Nelson CV.pdf" "Emma Nelson CV.pdf"
   ```

5. **Commit & push** the HTML change and the regenerated PDF together to the
   active working branch, then **deliver the PDF** to the user with
   `SendUserFile`. (This commit/push/deliver loop is the established default
   for this repo; only the heavy `.pdfbuild/` toolchain is excluded from git.)

## Notes
- Run script commands from inside `.pdfbuild/` — `render.js`/`shot.js` resolve
  the repo root as their parent directory.
- Only `emma-resume.html` and `Emma Nelson CV.pdf` are tracked by git here;
  everything in `.pdfbuild/` is regenerated, never committed.
- If a render fails with a missing-module / missing-chrome error, the fix is
  almost always "re-run `setup.sh`", not editing `render.js`.
