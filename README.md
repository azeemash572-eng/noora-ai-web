# NOORA AI for iPhone (installable web app / PWA) — 2.0.0

Personal AI assistant (English, Urdu, Roman Urdu, Arabic, Hindi, Punjabi). Same core is bundled into the Android 2.0.0 WebView app.

## Files
- `index.html` / `app.css` / `app.js` / `core.js`: app shell + logic
- `manifest.webmanifest`, `sw.js`: PWA (cache `noora-shell-2.0.0-1`)
- `build-single.js`: writes `../NOORA-AI-iPhone.html`
- `test/core.test.js`: `node --test test/`

## Settings keys (do not rename)
Provider settings stay in `localStorage` key `noora.settings` with the same provider preset names (including **Google Gemini** base URL and `gemini-2.5-flash`). Existing saved API keys keep working after upgrade.

## Add to Home Screen (iPhone)
1. Open the https URL in Safari → Share → Add to Home Screen.
