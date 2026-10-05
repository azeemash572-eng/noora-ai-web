# NOORA AI Command Center — Architecture (Phase 1)

**Version:** 2.1.0  
**Hosting:** Static GitHub Pages (`azeemash572-eng/noora-ai-web`) + Android WebView (`com.nura.assistant`). Optional Node `/server` proxy for Replit Secrets (not deployed with Pages).

## Current working features (preserved)

| Area | What works |
|------|------------|
| AI chat | Free Pollinations (no key), Google Gemini OpenAI-compat (`https://generativelanguage.googleapis.com/v1beta/openai`, `gemini-2.5-flash`), Custom OpenAI-compatible; keys in `localStorage` `noora.settings` |
| Streaming | OpenAI-compatible SSE (`stream: true`) with graceful fallback to non-stream |
| Conversations | Multiple chats, search, rename, delete, folders/projects; IndexedDB `noora-ai` |
| Voice | STT Web Speech; TTS Browser / OpenAI-compatible / ElevenLabs + fallback; mute/stop/replay; continuous voice mode |
| Files | PDF/CSV/XLSX/DOCX/images attach + Files tab; File Center picker/drag-drop/camera/gallery/validate |
| Web & research | Wikipedia + Google News (rss2json); Sources citations |
| Memory | On/off; view/edit/delete; categories (preferences, facts, projects, context, user) |
| Image | Pollinations txt2img + multi-gen + download/share; img2img/edit disabled unless a real provider path exists |
| Video | Registry entry; ops disabled until a provider is configured |
| Phone | Android `NooraNative` bridge (call/SMS/maps/alarm/timer/torch/open-app); iOS/web deep links (`tel:`, `sms:`, `mailto:`, maps, WhatsApp); Bluetooth → Android settings intent only |
| Security | PIN lock; export/import; no hardcoded keys; device actions whitelisted + confirmation |
| i18n | EN / Urdu / Roman Urdu / Punjabi / Hindi / Arabic; RTL; auto language match in system prompt |
| PWA | `manifest.webmanifest` + `sw.js` shell cache |

## Data / storage schema

### `localStorage`

| Key | Purpose |
|-----|---------|
| `noora.settings` | Provider, API keys, voice/TTS, personality, PIN hash, memoryOn, webSearchOn, serverUrl (optional), etc. **Do not rename keys** — Gemini key survives upgrades. |
| `noora.conv` | Active conversation id |
| `noora.hint` | Install hint dismissed |
| `noora.fallbackdb` | Full DB mirror when IndexedDB unavailable |

### IndexedDB `noora-ai` (version 2)

Stores: `conversations`, `messages` (index `conv` → `convId`), `memories`, `files`, `notes`, `prompts`, `assistants`, `folders`, `meta` (summaries as `summary:{convId}`).

**Conversation:** `{ id, title, created, updated, folderId, assistantId, project }`  
**Message:** `{ id, convId, role, text, ts, image?, sources?, meta? }`  
**Memory:** `{ id, fact, ts, category? }` — categories: `preferences` \| `facts` \| `projects` \| `context` \| `user`

### Migration (2.0.x → 2.1.0)

- Settings: `Object.assign(defaults, saved)` + `mergeVoiceSettings`; new fields (`serverUrl`, memory categories) default without wiping keys.
- Chats: same IndexedDB stores; no destructive schema bump. Category on memories optional.
- Helpers: `NooraCore.migrateSettings`, `NooraCore.searchConversations`, `NooraCore.validateUpload`.

## Provider config (client)

Preserved preset names in `NooraCore.PRESETS` / `MODEL_MAP`:

- Free (Pollinations, no key)
- Google Gemini → base `…/v1beta/openai`, models `gemini-2.5-flash` / `gemini-2.5-pro`
- OpenAI, Groq, OpenRouter, Pollinations (with key), Custom

Optional **Server URL** in Settings: when set, AI / TTS / image route through `/server` proxy (`process.env` keys) instead of browser-held keys.

## Target module map

```
/client/js/
  ai/          — chat provider interface (OpenAI-compat + stream)
  voice/       — TTS provider interface
  image/       — image provider (Pollinations txt2img)
  video/       — video provider (none configured → clear message)
  web/         — Wikipedia / News search
  device/      — whitelisted device actions
  files/       — validate type/size, metadata
  memory/      — categories + CRUD helpers
  tools/       — registry (calculator, datetime, web, memory, device, files, image, video)
  stream/      — SSE chunk parser
  conversations/ — search / rename helpers

/server/                 — optional Node proxy (Express)
  ai/ tools/ memory/ files/ voice/ image/ video/ web/ device/
  reads GEMINI_API_KEY, ELEVENLABS_API_KEY, OPENAI_API_KEY, …
  .env.example only — never commit real keys
```

Runtime (Pages / WebView) still loads bundled static files: `core.js` (pure shared logic + registry) + `app.js` (UI). Client modules are source-of-truth mirrors bundled/merged into `core.js` for WebView safety (no bare ES module dependency on old WebViews).

## Platform-dependent

| Capability | Web / iOS PWA | Android WebView |
|------------|---------------|-----------------|
| Call / SMS / Maps | Deep links (`tel:`, `sms:`, Apple/Google Maps) + user confirm | `NooraNative.action` + confirm |
| Alarm / timer / torch / open-app | Not available — honest message / Siri suggestion | Native bridge |
| Bluetooth toggle | N/A | Opens Bluetooth **settings** intent (does not toggle) |
| Camera / gallery | `<input capture>` / file picker | Same + WebChromeClient file chooser |
| Wake word | Impossible in web — documented | Not faked |
| STT | Often blocked on iOS Home Screen | Usually works while app open |

## Honesty rules

- Never fake a button or claim an OS action succeeded if it did not.
- Video / img2img / edit / upscale: disabled with reason until a real provider is configured.
- Keys never hard-coded; optional server keeps secrets in env.
