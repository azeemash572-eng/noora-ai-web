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

## 2.3.2: full contacts

- `ContactsReader.kt` reads all of Phone.CONTENT_URI with one forward-only cursor (no cap). Each row carries CONTACT_ID, name, number, NORMALIZED_NUMBER, type/label and account. Numbers are deduplicated per contact on their normalized digits. The output keeps `raw` and an `e164`/`number`. Nicknames come from Data/Nickname. `op:"count"` is a cheap change check.
- Permission: `contacts` requests READ_CONTACTS. `contactsPerm` reports its state. The permission event carries `blocked` (denied with "don't ask again"), and the web UI then offers `appSettings`.
- Web: `loadAllContacts` caches in memory and in the separate IndexedDB `noora-contacts`. It re-reads when `op:count` changes, including on the `resume` event. `T.matchContacts` scores name and nicknames, shows a pick card for ties and never guesses. Numbers are never put in AI prompts.

## 2.4.0 Phase 1: offline instant path

- `shouldSkipCloudAi(settings, online)` — true when `netMode === 'offline'` OR the device reports no internet (including Online mode with Wi-Fi down).
- `send()` still runs `parseCommand` → `runPlan` first (phone actions offline). Then `offlineMode()` → `offlineHandle` (router OK types + expanded `offlineReply` / `offlineNoAi`). Never starts Groq/Gemini/Pollinations.
- `AI.chat` early-returns `{ skippedCloud: true, network: true }` when `shouldSkipCloudAi` so attachment/vision callers also skip the ~20s chain.
- Status banner (`refreshStatus`) unchanged: "Offline mode — …" / "No internet — Online mode needs a connection" / "Offline — phone actions & small talk".
- Phase 2 (LiteRT / on-device model / voice-ID) not started.

## 2.4.1 Phase 2: optional on-device Qwen 0.5B

- Model: `litert-community/Qwen2.5-0.5B-Instruct` **multi-prefill q8 `.task`** (~521 MB). Not a `.litertlm` (LiteRT-LM Engine format) — those are not published for this Qwen yet. Inference: MediaPipe `tasks-genai` (LiteRT runtime), documented Android path for `.task`.
- Never in APK. `LocalLlm.kt` downloads via `DownloadManager` (Wi‑Fi default) into app storage `filesDir/models/…`. Cancel / delete supported. Metered / low-storage / low-RAM warnings in Settings.
- Online: Groq → Gemini → Pollinations unchanged; local model not used.
- Offline: `offlineReply` first; else `NooraNative.localChat` if downloaded; else `offlineNoAi`. No tool-calling from the local LLM.
- Phase 3 (voice-ID) not started.

## 2.4.2 Phase 3: owner voice identification (Android only, optional)
- **Engine**: sherpa-onnx v1.13.8 `SpeakerEmbeddingExtractor` (prebuilt AAR, arm64-v8a + armeabi-v7a only) + 3D-Speaker CAM++ `3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx` (28,281,164 bytes, sha256 `aa3cfc16…bf0ceba2`). The model is **downloaded once** (~28 MB, HTTPS from k2-fsa releases, hash-verified) — not bundled, to keep the APK lean. Libs add ~20 MB to the APK.
- **Enrollment** (Settings → Owner voice): 5 Roman-Urdu sentences (~30 s). Each needs ≥2.5 s of speech; a sentence that does not resemble earlier ones is rejected. Stored voiceprint = one averaged, normalised embedding in `noBackupFilesDir/voiceid/owner.json` (app-private, excluded from auto-backup, never uploaded). "Delete my voiceprint" removes it.
- **Owner-only mode** (default OFF): mic → **speaker check** (own AudioRecord, ~2–4 s, released before anything else) → existing SpeechRecognizer STT → `send(text)` → parseCommand / offlineHandle / localChat / Groq (unchanged). The user says a few words for the check, sees "✓ Aap hi hain — ab boliye", then speaks the command (the two steps cannot share one mic stream with SpeechRecognizer). On mismatch: nothing runs; only «معاف کیجیے، میں صرف اپنے مالک کی بات مانتی ہوں» is shown (and spoken if voice replies are on). No silence option.
- **Sensitivity** 1–10 → cosine threshold 0.25…0.70 (default 5 = 0.45). Scores within 0.10 below the threshold show "Is this you?" tap-to-confirm. "Test my voice" prints the score for tuning.
- **Honest limits**: not security-grade. Replay/recordings, close relatives, similar voices, noise, colds and phone-mic differences can pass or fail. The model is trained on Mandarin/English speakers, not Urdu specifically. Applies only to the voice button/voice mode — typed text, notifications, ?cmd= links and assistant-gesture launches of typed text are not checked; anyone holding the unlocked phone can type. Needs mic permission. Short utterances (<1 s) are not judged. The check adds ~2 s to each voice turn and the user speaks twice (check, then command). Web/iOS: unavailable. Not verified on a real phone in this build.
- Salam list, Groq/Gemini chain and on-device Qwen are unchanged. No Vosk/Whisper.
