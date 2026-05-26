const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

// This script runs from inside .pdfbuild/ (setup.sh copies it there), so the
// repo root is one level up and the toolchain lives alongside it.
const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'emma-resume.html');
const CSS = path.join(__dirname, 'tailwind.min.css');
const OUT = path.join(__dirname, 'Emma Nelson CV.pdf');
const CHROME = path.join(__dirname, 'chrome-headless-shell-linux64', 'chrome-headless-shell');

let html = fs.readFileSync(SRC, 'utf8');

// Use locally-vendored Tailwind instead of the blocked unpkg CDN.
html = html.replace(
  /<link href="https:\/\/unpkg\.com\/tailwindcss[^>]*>/,
  `<link href="file://${CSS}" rel="stylesheet">`
);

// Drop livejs (live-reload polling) — not needed and keeps network busy.
html = html.replace(/<script[^>]*livejs[^>]*><\/script>/g, '');

// Base href so relative images (coo.png, bradford.png, ...) resolve.
html = html.replace('<head>', `<head>\n<base href="file://${REPO}/">`);

// Print overrides: white page, no blue pattern, hide the download button,
// keep the design's coloured header/tag bars via print-color-adjust.
const printCss = `
<style>
  @page { size: A4; margin: 7mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { background: #ffffff !important; }
  .george-bg { background-image: none !important; background-color: #ffffff !important; padding: 0 !important; }
  .container { box-shadow: none !important; max-width: none !important; }
  .w-52 { display: none !important; }
  /* keep contact icons inline-small (print emulation otherwise balloons them) */
  a button svg { height: 16px !important; width: auto !important; display: inline-block !important; }
  /* compact 3-column work grid, like the original PDF */
  .jobs { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px 16px !important; }
  .job { break-inside: avoid; }

  /* ---- compact mode: fit ~2 pages ---- */
  html, body { font-size: 12px !important; line-height: 1.28 !important; }
  .text-7xl { font-size: 42px !important; }                 /* name */
  .text-4xl { font-size: 21px !important; padding-bottom: 2px !important; }  /* section headers */
  .text-2xl { font-size: 14px !important; line-height: 1.15 !important; }    /* job titles */
  p.text-3xl { font-size: 16px !important; }                /* tagline bar (bold) */
  .text-xl  { font-size: 12px !important; }                 /* company */
  h4.text-l { font-size: 11px !important; padding-top: 0 !important; padding-bottom: 1px !important; }
  .text-l   { font-size: 12px !important; }
  li.mt-2   { margin-top: 2px !important; }
  ul        { padding-left: 15px !important; margin: 2px 0 !important; }
  /* tighten section/element spacing */
  .my-8 { margin-top: 8px !important; margin-bottom: 8px !important; }
  .my-4 { margin-top: 6px !important; margin-bottom: 6px !important; }
  .mt-4 { margin-top: 6px !important; }
  .my-3, .mb-3 { margin-top: 3px !important; margin-bottom: 3px !important; }
  .pt-4 { padding-top: 4px !important; }
  .pt-2 { padding-top: 3px !important; }
  .pb-3 { padding-bottom: 3px !important; }
  .pb-4 { padding-bottom: 4px !important; }
  .p-2  { padding: 4px !important; }
  .pt-4.pb-4 { padding-top: 4px !important; padding-bottom: 4px !important; }
  /* contact pills smaller */
  a button.py-2 { padding-top: 3px !important; padding-bottom: 3px !important; }
  /* certifications: tighter rows */
  .grid.gap-4 { gap: 6px !important; }
  img.float-left { height: 30px !important; }
</style>
`;
html = html.replace('</head>', printCss + '</head>');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--ignore-certificate-errors', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  // write to disk and navigate so file:// images (cert logos) load
  const TMP = path.join(REPO, '.emma-resume-print.html');
  fs.writeFileSync(TMP, html);
  process.on('exit', () => { try { fs.unlinkSync(TMP); } catch (e) {} });
  await page.goto('file://' + TMP, { waitUntil: 'networkidle0', timeout: 60000 });
  // render with screen styles (matches the live site; avoids print-mode icon blowups)
  await page.emulateMediaType('screen');
  // ensure webfonts have actually loaded before printing
  await page.evaluate(async () => { await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 2500));
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
