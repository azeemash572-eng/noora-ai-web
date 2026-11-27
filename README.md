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
3.3.2 (audit fixes): Astra Brain now also gets a short `context` (date/time, his chosen language, his own rules, saved memories when Memory is on, chat summary), so "Remember things I ask" works with the Brain; the Brain is woken on open / return / typing (Render free tier sleeps) and waits up to 40s; header and home show "Astra Brain · Gemini" instead of "free Pollinations" when the Brain is on; Devanagari voice typing is treated as Roman Urdu (never Devanagari replies) unless Hindi is chosen; plain everyday Urdu words (no sujhaav / surakshit / prayog); pet names vary instead of repeating "janu"; Memory switch off also stops sending saved notes; ⋮ button stays on screen on 320px iPhones; fresh What's new.

3.3.1: actionable messages ("open settings", "call Ali", "voice settings kahan hain") also go to Astra Brain first (the phone-action JSON-block instructions are sent along and parsed from the reply); other providers and free Pollinations are only used if the Brain fails. The app prompt now knows its own Settings map (Settings → Voice: Zephyr/Kore/Aoede/Leda + Preview).
3.3.3: iPhone Safari fix — the Brain voice arrives ~5 s after the tap, so one shared `<audio>` + AudioContext are unlocked during the first tap/click (silent clip) and reused; if play() is still refused the WAV plays through the AudioContext. Auto-read and voice-mode replies use the Brain voice too (sentence-streaming off while it is active). First sentence is requested alone, all pieces in parallel. When the Astra voice fails a short plain-language note is shown (never silent) and the phone voice takes over; Settings → Voice shows "Last spoken with". Softer, conversational Zephyr style prompt on the server.
