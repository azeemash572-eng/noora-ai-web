# NOORA AI for iPhone (installable web app / PWA) — 1.0.0-proto-web

The same Noora as the Android 1.0.0-proto build (same routing, greetings, doctor warning, persona prompt and honesty rules: `core.js` is a line-by-line port of `noora-ai/app/.../core`), packaged as a static web app for Safari.

## Files
- `index.html`: app shell with the apple-mobile-web-app meta tags, `viewport-fit=cover` and safe-area padding
- `app.css`: dark UI (same colours as Android)
- `core.js`: language detection, router, local replies and parsers (pure JS, also loaded by the node tests)
- `app.js`: UI, IndexedDB history and memory, live APIs, AI chain, speech, phone links
- `manifest.webmanifest`, `sw.js`: PWA manifest and service worker. The service worker caches only the app shell; live data is never cached.
- `apple-touch-icon.png`, `icons/`: built from the same face icon as the Android app
- `build-single.js`: `node build-single.js` writes `../NOORA-AI-iPhone.html`, a single-file build with no service worker
- `test/core.test.js`: `node --test test/`
- `test/cors-check.sh`: live CORS sweep. Output is in `docs/cors-check.txt`.
- `docs/*.png`: headless-Chrome screenshots at iPhone size

## Hosting (it must be https for Safari, the home-screen install and the microphone)
Any static host works. Upload the folder as it is. Examples:
- GitHub Pages: `gh auth login` → `gh repo create noora-ai-web --public --source . --push` → in the repo, Settings → Pages → Deploy from branch `main` / root.
- Netlify Drop: drag the folder onto https://app.netlify.com/drop (needs a Netlify account).
- Cloudflare Pages: `npx wrangler pages deploy . --project-name noora-ai` (needs `wrangler login`).

## Add to Home Screen (iPhone)
1. Open the https URL in **Safari**.
2. Tap the **Share** button (the square with an up arrow).
3. Scroll down and tap **Add to Home Screen**. The name shows "NOORA AI".
4. Tap **Add**.
5. Open NOORA AI from the home-screen icon. It runs full screen, with no Safari bars.
