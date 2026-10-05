# NOORA + Siri on iPhone (Shortcuts recipes)

iPhone web apps can't listen for a wake word or run in the background. Apple doesn't let a PWA register Siri intents. Native App Intents would need a Mac, Xcode and an Apple Developer account, which this project doesn't have.

The supported, honest route is **iOS Shortcuts**. Siri runs your shortcut, and the shortcut opens NOORA.

## 1. "Hey Siri, Noora" → open NOORA in voice mode

1. Open **Shortcuts** → **+**.
2. Add the action **Open URLs** with this URL:
   `https://azeemash572-eng.github.io/noora-ai-web/?voice=1`
3. Name the shortcut **Noora**.
4. Say **"Hey Siri, Noora"**. NOORA opens on the chat screen, ready for voice.

iOS Safari only starts the microphone after a tap, so tap the 🎤 button once.

## 2. "Hey Siri, Noora command" → dictate a command and pass it to NOORA

1. Create a new shortcut and add these actions:
   - **Dictate Text** (language: Urdu, English or Hindi as you prefer)
   - **URL Encode** (input: Dictated Text)
   - **Text**: `https://azeemash572-eng.github.io/noora-ai-web/?cmd=` followed by the **URL Encoded Text** variable
   - **Open URLs** (input: Text)
2. Name it **Noora command**.
3. Say: "Hey Siri, Noora command" … "Majo ko WhatsApp kar do ke main thori dair se aaunga".

NOORA runs the command exactly as if you had typed it. Calls, messages and WhatsApp still show a confirmation card, and iPhone needs your tap to switch apps.

## 3. Things only Shortcuts can do on iPhone (alarms, timers)

Web apps can't set alarms or timers on iOS. Make a shortcut such as **Set Alarm 7** (action: *Create Alarm*, 7:00). Then ask NOORA "run shortcut Set Alarm 7" or use Tools → Shortcut.

NOORA opens `shortcuts://run-shortcut?name=Set%20Alarm%207` after you confirm.

## Not possible on iPhone

- Background or wake-word listening.
- Reading contacts or the photo library from a web app.
- Opening arbitrary apps by name.
- Controlling music or volume.
- Toggling Bluetooth or Wi-Fi.

NOORA says so when you ask instead of pretending.
