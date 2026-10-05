// Builds a single self-contained HTML file (no manifest / service worker; icons inlined as data URIs).
const fs = require('fs'), path = require('path');
const d = __dirname, out = process.argv[2] || path.join(d, '..', 'NOORA-AI-iPhone.html');
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(d, f)).toString('base64');
let html = fs.readFileSync(path.join(d, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(d, 'app.css'), 'utf8');
const js = (f) => fs.readFileSync(path.join(d, f), 'utf8').replace(/<\/script/gi, '<\\/script');
html = html.replace(/<link[^>]*rel="manifest"[^>]*>\s*/, '')
  .replace(/<link rel="stylesheet" href="app.css">/, () => `<style>\n${css}\n</style>`)
  .replace(/href="(icons\/[^"]+\.png|apple-touch-icon\.png)"/g, (m, f) => `href="${b64(f)}"`)
  .replace(/src="(icons\/[^"]+\.png)"/g, (m, f) => `src="${b64(f)}"`)
  .replace(/<script src="core.js"><\/script>/, () => `<script>\n${js('core.js')}\n</script>`)
  .replace(/<script src="tools.js"><\/script>/, () => `<script>\n${js('tools.js')}\n</script>`)
  .replace(/<script src="app.js"><\/script>/, () => `<script>\n${js('app.js')}\n</script>`);
if (/src="(core|tools|app)\.js"|href="app\.css"|rel="manifest"/.test(html)) throw new Error('inline failed');
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
