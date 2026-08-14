const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

// Runs from inside .pdfbuild/ — repo root is one level up.
const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'resume.html');
const CSS = path.join(__dirname, 'tailwind.min.css');
const OUT = path.join(__dirname, 'George Cairns CV.pdf');
const CHROME = path.join(__dirname, 'chrome-headless-shell-linux64', 'chrome-headless-shell');

let html = fs.readFileSync(SRC, 'utf8');

// Use locally-vendored Tailwind instead of the blocked unpkg CDN.
html = html.replace(
  /<link href="https:\/\/unpkg\.com\/tailwindcss[^>]*>/,
  `<link href="file://${CSS}" rel="stylesheet">`
);

// Drop livejs (live-reload polling) — not needed and keeps network busy.
html = html.replace(/<script[^>]*livejs[^>]*><\/script>/g, '');

// Base href so relative images (gcp-logo.png, aws-logo.png, ...) resolve.
html = html.replace('<head>', `<head>\n<base href="file://${REPO}/">`);

// Match the old print-to-PDF-driver output: backgrounds stripped by the
// print pipeline (no color-adjust override), just stop job cards splitting
// across page breaks.
const printCss = `
<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" rel="stylesheet">
<style>
  /* headless chrome has no system emoji font — the 🏠/🔒 markers need one */
  body { font-family: 'IBM Plex Sans', 'Noto Color Emoji', sans-serif !important; }
  h3 strong { font-family: 'Archivo Narrow', 'Noto Color Emoji', sans-serif !important; }
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
  const TMP = path.join(REPO, '.george-resume-print.html');
  fs.writeFileSync(TMP, html);
  process.on('exit', () => { try { fs.unlinkSync(TMP); } catch (e) {} });
  await page.goto('file://' + TMP, { waitUntil: 'networkidle0', timeout: 60000 });
  // print media (matches the old print-driver output: no backgrounds, adjusted text)
  await page.evaluate(async () => { await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 2500));
  // Render onto oversized pages so the layout is desktop-width (~1100 CSS px:
  // container caps at 1024, jobs grid fits 3 columns), then scale the pages
  // down to US Letter — the same reflow+shrink the old print driver produced.
  const F = 0.742;
  await page.pdf({
    path: OUT,
    width: `${8.5 / F}in`,
    height: `${11 / F}in`,
    printBackground: false,
    margin: { top: '0.34in', bottom: '0.34in', left: '0.34in', right: '0.34in' },
  });
  await browser.close();

  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.load(fs.readFileSync(OUT));
  for (const p of doc.getPages()) p.scale(F, F);
  fs.writeFileSync(OUT, await doc.save());
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes,', doc.getPageCount(), 'pages,',
    doc.getPage(0).getSize().width.toFixed(1) + 'x' + doc.getPage(0).getSize().height.toFixed(1), 'pt');
})().catch(e => { console.error(e); process.exit(1); });
