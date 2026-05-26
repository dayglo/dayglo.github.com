// Visual verification helper: screenshots the top of the live HTML so layout
// changes (e.g. the credential line under the name) can be eyeballed before
// shipping. Runs from inside .pdfbuild/. Output: .pdfbuild/cv-top.png
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const REPO = path.resolve(__dirname, '..');
const CSS = path.join(__dirname, 'tailwind.min.css');
const CHROME = path.join(__dirname, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
const OUT = process.argv[2] || path.join(__dirname, 'cv-top.png');
const HEIGHT = Number(process.argv[3] || 520);

let html = fs.readFileSync(path.join(REPO, 'emma-resume.html'), 'utf8');
html = html.replace(/<link href="https:\/\/unpkg\.com\/tailwindcss[^>]*>/, `<link href="file://${CSS}" rel="stylesheet">`);
html = html.replace(/<script[^>]*livejs[^>]*><\/script>/g, '');
html = html.replace('<head>', `<head>\n<base href="file://${REPO}/">`);

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 2 });
  const TMP = path.join(REPO, '.shot.html');
  fs.writeFileSync(TMP, html);
  process.on('exit', () => { try { fs.unlinkSync(TMP); } catch (e) {} });
  await p.goto('file://' + TMP, { waitUntil: 'networkidle0', timeout: 60000 });
  await p.evaluate(async () => { await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 1500));
  await p.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1100, height: HEIGHT } });
  await b.close();
  console.log('wrote', OUT);
})().catch(e => { console.error(e); process.exit(1); });
