const { pdfToPng } = require('pdf-to-png-converter');
(async () => {
  const [pdf, prefix] = process.argv.slice(2);
  const pages = await pdfToPng(pdf, { viewportScale: 1.5, outputFolder: 'pngs', outputFileMaskFunc: n => `${prefix}-p${n}.png` });
  console.log(pages.map(p => p.path).join('\n'));
})().catch(e => { console.error(e.message); process.exit(1); });
