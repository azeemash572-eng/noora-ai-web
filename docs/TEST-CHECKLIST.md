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
