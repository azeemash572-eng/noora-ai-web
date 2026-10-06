# NOORA AI Command Center — Architecture (Phase 1)

**Version:** 2.2.0  
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


## 2.2.0: voice-first tool engine

```
voice (Web Speech or Android SpeechRecognizer via NooraNative.sttStart) / typed text / ?cmd=
   → send()
      → pending reply? (haan / nahi / contact choice / number / address) → handlePendingReply
      → T.parseCommand (local NL rules, multi-step)  ──┐
      → C.route (legacy live data / greetings)          ├→ runPlan(steps) → advancePlan loop
      → AI.chat({tools}) → tool_calls / noora-action ──┘      resolveStep (memory nicknames → Android contacts → ask)
                                                              T.prepare (schema validation, platform availability, URL / intent build)
                                                              confirm? → action card (tap or voice "haan") → executePrep
                                                              executePrep → openExternal (deep link) | nativeRun (NooraNative.run JSON) | ics | local
                                                              reportResult → spoken reply (NOORA persona) → next step after returning to the app
```

- **`tools.js` (NooraTools)**: the tool registry. Each tool has name, group, label, description, JSON-schema params, permissions, confirm/risk, platforms, an unavailable reason and `prepare`. It also holds the URL builders, the safe calculator, `parseWhen`, the NL parser, yes/no, contact matching, nickname memory records, attachment helpers, AI tool-call helpers and persona strings. It is pure and Node-testable.
- **`app.js` orchestrator block**: plan/pending state, action cards, voice state machine (`body[data-voice-state]`, `#homeVoiceBtn` / `#vsOrb` `data-state`), native bridge calls, chat attachment tray, Tools-tab forms (no `prompt()`), deep-link params, Android native STT events (`window.__nooraNativeEvent`) and `window.__nooraStartVoice` (ACTION_ASSIST).
- **Android `NativeActions.kt`**: `run(json)` → `{ok, code, message, leftApp, results}` using standard intents only. Contacts and media reads are permission-gated. `ReminderReceiver` posts reminder notifications. There is no Accessibility Service and no foreground/background listening service.
- **Memory**: nickname rows `{kind:'nickname', key, name, value, category:'contacts'|'places'}` in the existing `memories` store. They are saved only when the user taps "Remember …" or says "yaad rakho …".
- **Settings** (`noora.settings`, keys preserved): new `mapsProvider` ('' = ask, apple, google, geo) and `defaultCountryCode` (WhatsApp numbers without a country code).
- **Tests**: see `docs/TEST-CHECKLIST.md`.


## 2.3.0 additions (Android)

- **Messaging**: `send_message` tool → `resolveStep` → contact cache (`NooraNative.run({op:'contacts',all:true})`, up to 5000, deduped) → JS fuzzy matcher (`translit`, `phoneticKey`, honorific stripping, Levenshtein) → ambiguity / app / message prompts → confirm card → `whatsapp` (wa.me, ACTION_SENDTO fallback) or `sms`. Numbers stay on the device and are never put in AI prompts.
- **TTS**: `NativeTts.kt` (Android TextToSpeech, chunking, locale pick, events `onNativeTts`) is the Android default. Providers: native, browser, xAI (`api.x.ai/v1/tts`, user key), OpenAI-compatible. ElevenLabs was removed and migrates to auto.
- **File chooser**: `ChooserIntents.kt` plans the pick/capture intents from accept types plus the capture flag. The camera writes to a FileProvider URI.
- **Reminders**: the `Reminders` object persists to SharedPreferences, and `BootReceiver` reschedules after reboot.
- **Image edit**: `edit_image` tool / `isImageEditRequest` → Gemini `generateContent` with responseModalities IMAGE (user key), or a local canvas eraser/inpaint. Results go to `saveToMedia` or native share.
- **Net mode**: `netMode` auto/online/offline. Offline uses the rule engine, `offlineReply`, and STT with `EXTRA_PREFER_OFFLINE`.
- **Persona**: `systemPrompt` CONVERSATION STYLE carries the user-approved "GAALI / PROFANITY" rule with its hard limits. Cloud provider filters still apply.

## 2.3.1: Groq primary + automatic fallback

- `core.aiRoute(S, {vision})` returns the keyed attempts in order. With a Groq key: Groq `qwen/qwen3.8-27b` first, then the user's own provider (Gemini). For a photo with a Gemini key: Gemini, then Groq (Qwen 3.8 27B accepts images, max 3). With no Groq key the route is unchanged from 2.3.0.
- `core.runAiChain(attempts, call)` stops at the first attempt that returns text or tool calls. Tool actions therefore come from one provider only and are never run twice. Failed attempts become `failureKind` values (busy, key rejected, server error, timed out, unreachable, empty reply) and are turned into `fallbackNotice` text, e.g. "Groq busy, answered with Gemini". This shows as a small `.aiNotice` line under the reply and is not spoken.
- `AI.chat` (app.js) runs the chain, then the existing free Pollinations loop. Groq calls use a 20 s total deadline (headers plus stream), `reasoning_effort:"none"`, and the same messages and system prompt as every other provider. `cleanAi` strips any `<think>` text.
- Keys live only in `noora.settings` on the phone (`groqApiKey`, `apiKey`). `redactKeys` scrubs provider error text before it is shown or logged.
