# NOORA AI 2.3.0 — Test checklist (Android)

2.3.0 targets Android only. Statuses mean the same as in the 2.2.0 section below. **No emulator or phone was available**, so anything that needs a real device is marked *built – not device-tested*.

Test commands (all passed on 2026-10-06):

- `npm test`: 48 Node unit tests (`core` 18, `cc` 9, `tools` 21).
- `npm run test:e2e`: `cc-smoke`, `voice-smoke`, `actions-smoke` (27 checks), and the new `android-230` (19 checks, NooraNative bridge mocked).
- Android: `./gradlew testReleaseUnitTest --tests NativeActionsTest --tests Noora230Test` (7 + 9 Robolectric tests). Then `assembleRelease`, `aapt dump`, and `apksigner verify`. The legacy `UiSmokeTest` tests the 1.0.0-proto native UI that was replaced in 2.0. It is stale and fails on purpose (it expects the old EditText and the "1.0.0-proto" about text), so it is excluded.

| # | Item | Status | How tested |
|---|---|---|---|
| 1 | "Noora Toyota message" / "Ammi jaan ko likho …" / "Navra … send a message to Mariam" → messaging flow, never "Done: 0 contact numbers" | tested (web) / built – not device-tested | tools.test fixtures; e2e android-230 (lookup → app → message → confirm → whatsapp intent); Noora230Test contacts all/query/dedupe/permission-denied |
| 2 | "open WhatsApp write a message to Ammi Jaan/Madhu" → WhatsApp flow, misheard wake words tolerated | tested (web) / built – not device-tested | tools.test; e2e; wa.me + ACTION_SENDTO fallback |
| 3 | No ElevenLabs toast; elevenlabs → auto (native) migration | tested | core.test migration; e2e voice mode |
| 4 | Image text removal → Gemini image edit (key) or free manual eraser, preview + save/share | tested (mock Gemini) | e2e request body; eraser pixel test; save/share bridge calls. Real Gemini image model not tested live (no key) |
| 5 | File chooser: all accept types and capture modes, CAMERA/RECORD_AUDIO prompts, FileProvider | tested (Robolectric intents) / built – not device-tested | Noora230Test ChooserIntents |
| 6 | Attach to chat → Chat tab + chips (Explain/Edit/Summarize/Read/Send/Save) | tested | e2e image + document flows |
| A | Native Android TTS (Voice bridge), locales ur-PK / hi-IN / pa-IN / en, voice list, rate/pitch/volume, voice-pack hint → TTS settings; xAI Grok TTS (optional key) | tested (Robolectric + e2e mock) / built – not device-tested | Noora230Test NativeTts; e2e. Piper **not shipped** (no verified on-demand Android build) |
| B | Offline/Online/Auto mode: rule engine, EXTRA_PREFER_OFFLINE STT, native TTS, honest no-AI replies | tested | e2e offline. On-device LLM (MediaPipe/Gemma) **not included** |
| C | Smarter parsing: Roman Urdu / Punjabi / Hinglish fixtures, multi-step, contact-aware tools (numbers never sent to the AI) | tested | tools.test; e2e asserts no numbers in AI request |
| D | Phone control (apps, call, SMS, WhatsApp, email, camera, gallery, files, share, maps, calendar, alarms/timers, reminders + BOOT_COMPLETED, media, volume, torch, settings panels) | partly tested (Robolectric intents, reminders reboot) / built – not device-tested | Android 10+ can't toggle Wi-Fi/BT directly; NOORA opens the panel and says so |
| E | Design refresh: big voice orb, cleaner bubbles, chips, RTL fonts, 360–412 px | tested (screenshots) | `/workspace/noora-2.3.0-screens/before-*` / `after-*` |
| 14 | Conversation style: user-approved strong profanity/gaali as friendly banter, mirrors the user, drops it when the user is serious or upset; limits: no hateful slurs, threats, third-party abuse, or minors | tested (prompt text) | core.test asserts the rule and its limits. Gemini/Pollinations have their own safety filters that NOORA can't override, so some replies may still be softened or refused |

---

# NOORA AI 2.2.0 — Test checklist

Status values:

- **tested**: an automated test exercised the real code path. Unit tests run in Node. E2E runs in headless Chrome with an iPhone viewport and UA; external sites are mocked or intercepted.
- **built – not device-tested**: the code is compiled into the APK, the manifest/intent wiring is verified, and Robolectric or the web↔bridge contract test passed. **No Android emulator or phone was available**, so real-device behaviour is unverified.
- **not possible**: the OS or browser doesn't allow it. NOORA says so instead of faking it.

Test commands:

- `npm test`: Node unit tests. `test/core.test.js` (16), `test/cc.test.js` (9) and `test/tools.test.js` (16) = 41 tests.
- `npm run test:e2e`: Playwright. `cc-smoke` (7 tabs, no console errors), `voice-smoke` (TTS settings and voice mode), and `actions-smoke` (27 checks: tools, confirmations, multi-step, voice states, attachments, Android bridge contract, deep links).
- Android: `./gradlew assembleRelease` plus `testReleaseUnitTest --tests com.nura.assistant.NativeActionsTest` (7 Robolectric tests). `aapt dump` checks the permissions and `<queries>`, and `apksigner verify` checks the signature.

The AI was tested against a **mocked** Gemini endpoint (`generativelanguage.googleapis.com/v1beta/openai/chat/completions`). No real API key was available.

The free Pollinations endpoint was checked live on 2026-10-05. Plain requests returned 200, but requests with a system prompt returned 402 / 500 ("ENOSPC: no space left on device"). This is server-side and intermittent. NOORA shows "Connection issue hai, jaanu. Dobara try karun?" with a retry button instead of inventing a reply.

## Orchestrator / AI

| Capability | Platform | Status | How tested |
|---|---|---|---|
| Local NL intent parser (Roman Urdu / Urdu / Hinglish / English; strips "janu/darling/noora") | all | tested | `tools.test.js`: the 3 user fixtures plus about 20 more commands. Chat sentences return `null` (not hijacked) |
| Multi-step plans ("… aur phir …"), sequential, pause at confirmation | all | tested | unit test (split, keeping "aur" inside a message); e2e: WhatsApp (1/2) → tap → asks home address → maps (2/2) |
| Voice/typed confirmation "haan / ji / yes" and cancel "nahi / cancel" | all | tested | unit `parseYesNo`; e2e "haan" opens wa.me, "nahi" cancels with nothing opened, spoken "haan ji" confirms |
| Confirmation rules (calls/SMS/WhatsApp/email/share/Shortcuts always confirm; camera/maps/search/timer/calc run at once) | all | tested | unit `needsConfirm` and `prepare().confirm`; e2e cards |
| Purchases / payments / security actions | all | not possible (by design) | no such tool exists; unknown tool names are rejected (unit test) |
| AI native tool calling (`tools` + `tool_choice:auto`, streamed `tool_calls` merged) | keyed providers (Gemini/OpenAI-compatible) | tested (mock) | e2e: request body has tools[] and no alarm tool on iPhone; streamed deltas → open_maps card |
| JSON fallback (```noora-action``` block) when the provider rejects `tools` or for free/server paths | all | tested (unit); live free AI not verifiable (402/500) | `extractActionBlock` unit tests; HTTP 400/422 → retry without tools (code path) |
| AI args validated before anything runs | all | tested | unit: bad timer/alarm/email/url rejected |
| Spoken replies in NOORA persona; friendly Roman Urdu errors; no raw JS errors | all | tested | e2e: mic-denied text, connection retry card, `unhandledrejection` → friendly toast; no console errors in any e2e |

## Tools

| Tool group / action | Android app | iPhone / web | How tested |
|---|---|---|---|
| Phone: call | built – not device-tested (ACTION_DIAL after confirm; ACTION_CALL only if `direct` and CALL_PHONE granted — not used by default) | tested: `tel:` after confirm | e2e form → card → `tel:+923001234567`; Robolectric ACTION_DIAL; bridge contract (contacts → dial) |
| Messaging: SMS | built – not device-tested (SENDTO smsto + sms_body) | tested: iOS `sms:…&body=`, others `?body=` | unit + e2e + Robolectric |
| Messaging: WhatsApp | built – not device-tested (installed check com.whatsapp / w4b, else "installed nahi mil raha" + wa.me browser fallback) | tested: `https://wa.me/<digits>?text=` | e2e both paths; Robolectric not_installed |
| Messaging: email | built – not device-tested (SENDTO mailto with extras) | tested: `mailto:` | e2e + Robolectric |
| Contacts lookup (READ_CONTACTS, ambiguity "Janu, Ali Ahmed ya Ali Khan?", never guesses) | built – not device-tested | not possible (no contacts API in web apps) → asks for the number, offers to remember it | unit `matchContacts` / `pickChoice`; bridge contract e2e (permission → choice → dial); Robolectric permission gate; e2e web honest message |
| Nicknames / places memory ("Majo", "home", "Lulu") | tested | tested | e2e: save button → memory row `{kind:'nickname'}`; reused for the next WhatsApp |
| Camera (photo / video) | built – not device-tested (STILL_IMAGE_CAMERA / VIDEO_CAMERA) | tested up to the tap card / form; the picker itself is the browser's (`capture` input) | e2e form |
| Gallery / files / downloads | built – not device-tested (APP_GALLERY, ACTION_VIEW_DOWNLOADS) | tested up to the form; web can only open the file picker, not Downloads | e2e form |
| Share "send this photo to Majo" | built – not device-tested (FileProvider + ACTION_SEND, optional WhatsApp package) | tested code path: Web Share API with the attached file (needs a tap) | unit `prepare`; shown honestly when unsupported |
| Latest photo via MediaStore (READ_MEDIA_IMAGES / READ_EXTERNAL_STORAGE ≤32) | built – not device-tested | not possible (web can't read the photo library) | unit (unavailable on web) |
| Maps / navigation | built – not device-tested (`google.navigation:q=`, `geo:`, https fallback) | tested: Apple/Google choice, remembered; `daddr` / `dir/?api=1` | unit URLs; e2e |
| Browser / open URL (http/https only) | built – not device-tested | tested | unit (javascript: rejected); Robolectric |
| Calendar event | built – not device-tested (CalendarContract ACTION_INSERT) | tested: `.ics` download → "Add to Calendar" | unit ICS; Robolectric intent |
| Reminder | built – not device-tested (AlarmManager inexact alarm + notification; may be delayed in Doze; lost on reboot) | tested: `.ics` with VALARM | unit |
| Alarm / timer | built – not device-tested (AlarmClock.ACTION_SET_ALARM / SET_TIMER) | not possible (web can't set alarms) → suggests a Shortcut / Siri | unit; e2e honest message; bridge contract (voice → alarm 07:00); Robolectric extras |
| Media controls / volume | built – not device-tested (dispatchMediaKeyEvent, adjustStreamVolume) | not possible | unit; Robolectric key mapping |
| System settings (Bluetooth, Wi-Fi, internet, volume, display, location, sound, notifications, app, battery) | built – not device-tested (opens panel/screen; says it can't toggle on Android 10+) | not possible | Robolectric; bridge contract "bluetooth on karo" |
| Notifications (POST_NOTIFICATIONS runtime request) | built – not device-tested | iPhone: only for an installed Home Screen app (iOS 16.4+), with permission | code path |
| Torch | built – not device-tested | not possible | unit |
| App launcher (installed-app discovery via launcher intents, `<queries>`) | built – not device-tested ("not installed" message) | iPhone/web: only universal links (WhatsApp, YouTube, Instagram…); can't open apps by name | unit |
| iOS Shortcuts `shortcuts://run-shortcut` | not offered (iOS only) | tested | e2e |
| Web search (live news + Wikipedia; never fabricated) | tested | tested | e2e shows "nothing found" when the network is blocked (no fake results) |
| Calculator (safe parser, no eval; iPhone keyboard shows operators) | tested | tested | unit + e2e (inputmode=text) |
| Image generation | tested (existing) | tested (existing) | — |
| Video generation | not possible without a provider (disabled with reason) | same | unit |

## Voice

| Capability | Platform | Status | How tested |
|---|---|---|---|
| Voice states IDLE / LISTENING / THINKING / EXECUTING / SPEAKING / ERROR on the orb and the chat voice panel; partial + final transcript; detected command / current action | web/iPhone | tested | e2e with mocked SpeechRecognition (states seen in order; partial "… " transcript; action line) |
| Android STT via native SpeechRecognizer (partial results, language from the chips, e.g. ur-PK / en-US / pa / hi) | Android | built – not device-tested | bridge contract e2e (partial → final → alarm) |
| Mic permission (WebView `onPermissionRequest` now asks at runtime; native STT asks RECORD_AUDIO) | Android | built – not device-tested | code review + build |
| Continuous listen while the app is open (voice mode) | all | tested (web); Android built – not device-tested | e2e voice-smoke |
| Assistant gesture: ACTION_ASSIST / VOICE_COMMAND intent filters → voice mode | Android | built – not device-tested | aapt manifest dump. Whether the gesture lists NOORA depends on the phone; the Android 10+ "Digital assistant app" setting requires a VoiceInteractionService, which is **not** included |
| Foreground listening service | Android | **not included** in 2.2.0 | listening stops when the app is paused (no hidden background mic) |
| Accessibility Service | Android | **not included** (possible future opt-in with privacy text) | — |
| Wake word / background listening | iPhone / PWA | not possible | Siri Shortcut recipes in `docs/SIRI-SHORTCUTS.md` |
| `?voice=1` / `?cmd=<text>` deep links (Siri Shortcuts) | web/iPhone | tested | e2e: `?cmd=calculate 6*7` → 42 and the URL is cleaned; `?voice=1` asks for a tap (iOS needs a gesture to start the mic) |
| Native iOS App Intents / Siri extension | iPhone | not possible (no Mac / Xcode / Apple Developer account) | — |
| TTS speed / volume / voice / replay / auto-play (voice replies on/off) | all | tested (existing, voice-smoke) | — |

## Files

| Capability | Platform | Status | How tested |
|---|---|---|---|
| Multi-file chat tray: preview, remove, status, validation errors | all | tested | e2e |
| PDF (text layer, pdf.js) / DOCX / XLSX / CSV / TXT → AI | all | tested | e2e with real generated files → request body contains the text |
| Image → vision (`image_url`) | all (needs Gemini/OpenAI key or server; free model is text-only and says so) | tested (mock) | e2e |
| Audio → Gemini `input_audio`, or OpenAI/Groq Whisper transcription | keyed | tested (mock, Gemini route) | e2e WAV |
| Video → metadata + one extracted frame, honestly labelled | all | tested (mock) | e2e MP4 ("ONE frame") |
| Old .doc / unsupported types | all | tested (honest error) | e2e |
| "read / summarize this PDF" voice command | all | tested | uses the attached file; without one, says "attach it first" (e2e) |
| Android WebView file chooser: multiple + camera capture (FileProvider) | Android | built – not device-tested | build |
