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

## 2.5.0 final build (versionCode 73; shipped inside 2.5.1)

- **Piper local TTS** (`PiperTts.kt`, sherpa-onnx `OfflineTts`): optional Wi‑Fi voice download (hash-verified, not bundled; needs the small `espeak-ng-data` phoneme set from the same package). Default TTS on Android *when a Piper voice is installed*; otherwise the phone voice. No silent downloads. Urdu: only a male voice exists in the catalog — stated in the UI.
- **Chat providers** (`core.js:aiRoute/runAiChain`): Groq (selected model: Qwen / GPT‑OSS / Llama entries; if the chosen model returns 429 the alternate Groq model is tried, since Groq limits are per model) → Gemini → Pollinations. Optional, off by default: **xAI/Grok** (OpenAI-compatible `https://api.x.ai/v1`, user key kept in on-device Settings, paid) as primary or backup
- **Instruction following**: Settings → Custom instructions go first in the system prompt under USER RULES; memories are a capped numbered list; style rules softened; history 24 turns; router tightened (OpenApp/Call/Flashlight); local Qwen gets a compact real system prompt + last 4 turns; Wikipedia snippets are a labelled context block.
- **Latency**: Groq timeout is time-to-first-token (~8 s) with partial-text rescue; fallback budget cap; shorter Pollinations retry; Wikipedia in parallel capped ~2 s; tool schemas sent only for action-like messages (`tools.js:looksActionable`); sentence-by-sentence speech while streaming (`ss*` in `app.js`).
- **STT**: `SpeechRecognizer` reused between turns (rebuilt after an error); `EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS`=1000 and `POSSIBLY_COMPLETE`=800 ms (hints — engines may ignore them). Text is sent on the final result.
- **Background listening** (`KeepAliveService.kt`, foreground service type `microphone`, Settings toggle, persistent notification with Stop). Started only from the foreground UI (Android 14+ rule), never at boot. Back at the top level calls `moveTaskToBack` instead of finishing. Limits: OEM battery managers, locked screen, and the system recognizer can still stop it; WebView timers may be throttled in the background.
- **Interface**: CSS variables for dark/light (Settings → Appearance: Automatic/Dark/Light), refreshed components, animated mic (rings + breathing while listening, respects reduced-motion). No screen/id removed.
- **Planned, NOT in 2.5.0**: fixes from the user's night screenshots (next version); a separate non-APK fine-tuning project (Qwen2.5 + a small Llama, QLoRA, exported to GGUF) — not started.

### 2.5.0 addendum: sources removed
- No Wikipedia lookups (`Live.wiki`, `parseWikiSearch`, the REFERENCE CONTEXT block in the system prompt) and no "Sources" block under replies (`renderMsg`, `.sources` CSS). Plain chat now makes no web request, so greetings never trigger lookups. Message objects keep an empty `sources: []` field only for old-data compatibility.
- Settings → "Live answers — news, prices, weather (no source list shown)" (`webSearchOn`) still gates `liveSearch`: Google News headlines are fetched and given to the AI as background, and the prompt forbids citing or listing sources. Currency, gold, crypto, weather and image replies no longer attach source links either. If the AI is unavailable, the fallback shows plain headline titles (no links).
- Header status (`refreshStatus`/`lastAnswer`) shows the provider that actually answered the last message, with "(fallback — check Settings)" when an earlier provider failed; before any reply it shows the configured primary.

## 2.5.1 (versionCode 74)
- **Auto voice** (`core.js:effectiveTtsProvider`): with an xAI key stored in Settings → Voice and the device online → Grok voice (xAI TTS, `eve` unless changed, language auto); any error/offline → best device voice. No xAI key → best device voice. Auto never picks Piper; Piper (and ElevenLabs-style/OpenAI-compatible TTS) remain explicit choices, and a saved `piper` choice is kept with a Settings hint to try Auto.
- **Best Android voice** (`rankNativeVoices`): reply-language match (ur-PK, hi-IN, en-IN/en-US, ar…) → `Voice.quality` (VERYHIGH > HIGH > NORMAL) → Google engine voices → gender (only when the voice reveals it) → on-device first; network voices dropped when offline. `NativeTts.kt` binds `com.google.android.tts` first and falls back to the phone's default engine if it is missing. **iPhone/Web Speech** (`scoreDeviceVoice`): Premium/Enhanced/Siri > Neural/Natural > other, `localService` voices preferred, language match first.
- **Active voice**: Settings → Voice shows `Active voice: <provider/engine> · <voice> · <language>`; the Voice Test prints the same line.
- **Create tab**: video provider fields moved to Settings → Create / Video (Generate page = prompt + Generate + status; still disabled without a real provider, nothing faked); Image Studio's unavailable buttons sit inside the Generate card; labels sit above full-width fields.
- **Removed**: the "Ollama on your PC" chat provider (card, address/model fields, connection test, chain code) was built during 2.5.0 work and removed before release. Old saved `ollama*` settings keys are ignored and dropped by `migrateSettings`.
- **Sources removed** (see addendum above).
- **Image Studio providers** (`core.js:selectImageProvider`, `app.js:runImageOp`): the img2img / Edit / BG replace / Enhance buttons used to be hard-coded `disabled` (only Pollinations text→image was wired, so they could never switch on). Settings → Create / Image now offers: Pollinations (free, text→image only), **Gemini image** (the user's Gemini key; img2img/edit/background/enhance through the Gemini image model; text→image stays on Pollinations) and **OpenAI-compatible** (https Base URL + key + model: `/images/generations` and multipart `/images/edits`). Buttons enable only when the provider can really do the op, otherwise they stay disabled with the honest reason as tooltip/note. "Enhance" is an AI clean-up/re-render, not a resolution upscaler. Results are saved in Files; keys stay in on-device Settings.

## 2.5.2 (versionCode 75): Tools → Scan / PDF
- **Files** (`scan/`): `zxing.min.js` (ZXing, Apache-2.0, bundled locally, loaded on first scan), `pdfwriter.js` (plain-JS A4 PDF writer from barcode-scanner-ios @6f6706f), `scanstore.js` (entries `{barcode, name, brand, quantity, model, ts}` in its own IndexedDB `noora-scanpdf`, in-memory fallback, CSV export with formula-injection guard), `lookup.js`, `scanpdf.js` (UI; CSS classes `sp*`, localStorage `noora.scanpdf.lang`). Nothing touches NOORA's own storage (`noora-ai`, `noora-contacts`, `noora.settings`).
- **Barcode scan**: camera via `getUserMedia` (Android: `WebChromeClient.onPermissionRequest` + the CAMERA permission already used by voice/photos); native `BarcodeDetector` when present, ZXing otherwise. If the camera is blocked, a "Take a photo of the barcode" button decodes a photo from the native file chooser. List, edit, delete, duplicate detection with "add quantity", CSV export (share or save).
- **Lookup (online only, no key)**: after a scan, Open Food Facts then the UPCitemdb trial endpoint are asked for the product name and brand of numeric EAN/UPC codes; results are cached in localStorage (`noora.scanpdf.lookup`; "not found" only for a day). Name and brand pre-fill editable fields only when a service returned them; otherwise the UI says "name not found" (offline / unreachable / rate-limited are reported differently). The **model number is never filled by lookup** — it stays manual. Limits: good for groceries, weak for electronics/appliance model codes and local (e.g. Oman) products; the barcode number is sent to those two services.
- **Photos → PDF**: choose or capture photos, reorder/remove, multi-page A4 PDF. On Android the file is handed to the existing native bridge (`share` / `saveFile` → Downloads/NOORA) because WebView cannot download blobs; on web/iPhone: Web Share or a download link.

## 2.6.0: OpenAI GPT-6 Luna provider + new app icon (web / iPhone PWA)
- Settings → AI → "OpenAI chat (GPT-6 Luna)" card: mode (Primary default / Backup / Off), API key (password, `noora.settings.openaiApiKey`, this device only), editable model (`openaiModel`, default `gpt-6-luna`), "Save & test OpenAI".
- Route (`C.aiRoute`): OpenAI primary → before Groq/Gemini (also first for photos); backup → after Groq/Gemini, before xAI backup and free Pollinations. No key = routes unchanged.
- Request: `POST https://api.openai.com/v1/chat/completions`, `Authorization: Bearer`, streaming, image input via `image_url`, `reasoning_effort: "none"` for gpt-6* (required for function calling on Chat Completions), no `temperature` for gpt-5/6/o-series.
- OpenAI error responses on /chat/completions carry no CORS headers, so the browser sees a network error; NOORA then probes `GET /v1/models/<model>` (CORS-enabled) to report invalid key (401), model not found (404) or, when key+model are fine, likely no credits / insufficient_quota. `C.openaiErrorText`, `failureKind` → "no credits (insufficient_quota)".
- Icons regenerated from noora-icon-astra (violet/blue four-point star on midnight navy): apple-touch-icon 180 (root + icons/), 192, 512, maskable 512, 64, 32; `?v=2.6.0` on manifest/HTML refs; SW cache `noora-shell-2.6.0`.

## 2.7.0: OpenAI provider on the Responses API + Luna web search + model picker (web / iPhone PWA)
Follows OpenAI's "Build a Personal AI Assistant" guide. Other providers (Groq, Gemini, own OpenAI-compatible, xAI, Pollinations, server proxy) are untouched.
- **Request** (`core.js:buildResponsesRequest`, `toResponsesInput`, `toResponsesTools`): `POST https://api.openai.com/v1/responses` with `model`, `instructions` (NOORA's unchanged system persona from `C.systemPrompt`), `input` (conversation turns as `{role, content}`; photos as `input_image`, text parts as `input_text`/`output_text`), `reasoning: {effort}` (Settings, default `low`; only sent to gpt-5/6/o-series), `tools` (NOORA function tools flattened to `{type:'function', name, description, parameters}` + `{type:'web_search'}` when Luna web search is on), `tool_choice: 'auto'`, `store: false`, `stream: true` for chat.
- **Response** (`parseResponsesOutput`, `parseResponsesStream`): `output_text`, else `output[].content[]` of type `output_text`; `function_call` items → chat-style `tool_calls` (so `handleAiToolCalls` is unchanged); `web_search_call` → `searched`; `url_citation` annotations → `citations` (deduped). Streaming reads `response.output_text.delta`, takes tool calls/citations from `response.completed`, handles `response.failed` / `error`.
- **Fallback** (`openaiResponsesCall`, `responsesShouldFallback`): /v1/responses 404 or a CORS/network failure (not a timeout) → the same message is re-sent to `/v1/chat/completions` (2.6.0 path, `reasoning_effort` as before, no web search; GPT-6.1 Sol without tools). Because a wrong key also looks like a CORS failure in the browser, a CORS failure first probes `GET /v1/models/<id>`; if that returns 401/403/404/429 the real error is shown and no chat call is wasted. 401/429/400/5xx from /responses are not retried there (the normal provider chain moves on).
- **Luna web search** (`openaiWebSearch`, default true; `C.lunaSearchActive`): with a key and OpenAI not Off, router intent `LiveSearch` goes to `chat(..., {luna})` → `AI.chat({only:'openai'})`; if OpenAI fails or only the chat-completions fallback answered, it falls back to the 2.5.0 Google News search. Cited links render under the reply in `.lunaLinks` ("🔎 Luna web search"), only from `url_citation` annotations — the 2.5.0 rule (no Wikipedia / news source lists) still holds for everything else.
- **Model picker** (`C.OPENAI_MODELS`, `openaiModelInfo`, `openaiEffortFor`): GPT-6 Luna `gpt-6-luna` (default, ≈ $0.10/$0.50 per 1M), GPT-6.1 Sol `gpt-6.1-sol` (≈ $2/$10), GPT-6 Astra `gpt-6-astra` (≈ $10/$50, ≈ 100× Luna), or a custom id. Sol and Astra support reasoning effort low…max only, so `none` is never sent to them (→ `low`), on both /responses and the chat fallback.
- **Settings keys**: `openaiWebSearch` (bool), `openaiReasoning` (`none|low|medium|high`), existing `openaiApiKey`, `openaiModel`, `openaiChatMode`.
- **CORS** (docs/cors-check.txt, 2026-10-21): /v1/responses preflight 200 (ACAO `*`, allows `authorization, content-type`); keyless POST → 401 with ACAO = reachable. Wrong-key 401 has no ACAO (same as /chat/completions). A real-key 200 was not tested.
- Tests: `test/openai-responses-270.test.js` (mock fetch), browser smoke `test/e2e/openai-270.mjs` (mocked api.openai.com). Version 2.7.0, SW cache `noora-shell-2.7.0`.
