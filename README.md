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

## Astra Brain (3.2.4) and Astra voice (3.3.0)
Plain chat first goes to `https://astra-brain.onrender.com/chat` (Gemini + the Astra persona; repo `azeemash572-eng/astra-brain`, key only in the Render env). Only the last 10 user/assistant turns are sent, never the system prompt or memories. If the proxy answers 503/not configured (or is down) Astra says so once and uses the usual providers. Toggle: Settings → AI → Astra Brain.
Speaker button (3.3.0): tries `POST https://astra-brain.onrender.com/tts` first (Gemini TTS, voices Zephyr (default) / Kore / Aoede / Leda, chosen in Settings → Voice), with a loading pulse; on 429/503/error/offline it falls back to the device voice. Devanagari, emoji and links are removed before speaking. Only text of the reply you tap is sent.
