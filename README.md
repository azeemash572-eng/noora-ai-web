# NOORA AI Command Center — 2.1.0

Personal AI command center (English, Urdu, Roman Urdu, Arabic, Hindi, Punjabi). Same core is bundled into the Android 2.1.0 WebView app.

## Files
- `index.html` / `app.css` / `app.js` / `core.js`: 7-tab shell (Home / Chat / Create / Files / Tools / Memory / Settings)
- `client/js/`: module map mirroring architecture (runtime logic in `core.js` for WebView safety)
- `server/`: optional Node proxy for Replit Secrets (not used by GitHub Pages)
- `manifest.webmanifest`, `sw.js`: PWA (cache `noora-shell-2.1.0`)
- `docs/ARCHITECTURE.md`: schema, providers, platform notes
- `docs/icon-preview.png`: new NOORA AI icon (iOS + Android renders)

## Settings keys (do not rename)
Provider settings stay in `localStorage` key `noora.settings` (including **Google Gemini** base URL and `gemini-2.5-flash`). Existing saved API keys and chats keep working after upgrade.

## Optional server
See `server/README.md`. Set **Server URL** in Settings to route AI/TTS/image through the proxy.

## Add to Home Screen (iPhone)
1. Open the https URL in Safari → Share → Add to Home Screen.

Published from `main` via GitHub Pages (static). Optional `server/` is for Replit only — not executed on Pages.
