# NOORA AI for iPhone (installable web app / PWA) — 2.0.1

Personal AI assistant (English, Urdu, Roman Urdu, Arabic, Hindi, Punjabi). Same core is bundled into the Android 2.0.1 WebView app.

## Files
- `index.html` / `app.css` / `app.js` / `core.js`: app shell + logic
- `manifest.webmanifest`, `sw.js`: PWA (cache `noora-shell-2.0.1-1`)
- `build-single.js`: writes `../NOORA-AI-iPhone.html`
- `test/core.test.js`: `node --test test/`

## Settings keys (do not rename)
Provider settings stay in `localStorage` key `noora.settings` with the same provider preset names (including **Google Gemini** base URL and `gemini-2.5-flash`). Existing saved API keys keep working after upgrade.

## Add to Home Screen (iPhone)
1. Open the https URL in Safari → Share → Add to Home Screen.

## Voice / TTS (2.0.1)
- **Voice Mode** on chat: continuous listen → AI → speak → listen (Stop / Mute / Replay / Mic).
- **Browser TTS** (default, no key) via Web Speech API; pick device voice, speed, pitch, volume.
- **OpenAI-compatible TTS**: set Base URL + API key + model + voice ID in **Settings → Voice**. Keys are stored only in `localStorage` (`noora.settings`) — never hard-coded in the repo.
- **Voice Test** plays a sample with the current form values before/without saving.
- iPhone Safari / Home Screen often blocks web speech recognition; use keyboard dictation if STT fails. Honest status messages clear “Listening…” on refusal.
