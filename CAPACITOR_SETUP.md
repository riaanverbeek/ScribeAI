# ScribeAI — Native App Setup (Capacitor)

The native iOS and Android apps are built with Capacitor. The shell loads the live
ScribeAI web app from your Replit deployment URL, so there is no separate mobile
build step — changes to the live app appear in the native app automatically.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| macOS | Required for iOS builds (Xcode is macOS-only) |
| Xcode 15+ | Install from the Mac App Store |
| CocoaPods | `sudo gem install cocoapods` |
| Android Studio | Download from [developer.android.com](https://developer.android.com/studio) |
| Java 17+ | Usually bundled with Android Studio |
| Node.js 18+ | Already installed if you can run the web app |

---

## One-time setup

### 1. Clone and install

```bash
git pull origin main
npm install
```

### 2. Update the live URL (if needed)

Open `capacitor.config.json` and update `server.url` to your current Replit deployment URL.
You can find this in the Replit dashboard under **Deployments**.

```json
{
  "server": {
    "url": "https://YOUR-APP.replit.app"
  }
}
```

### 3. Add native platforms

```bash
npx cap add ios
npx cap add android
```

### 4. Sync web assets and native plugins

```bash
npx cap sync
```

Run this again any time you update `capacitor.config.json` or install new Capacitor plugins.

---

## iOS — Xcode

### Open in Xcode

```bash
npx cap open ios
```

### Required: Set your signing team

1. In Xcode, click the project root in the navigator (top-left)
2. Select the **ScribeAI** target
3. Go to **Signing & Capabilities**
4. Choose your Apple Developer Team

### Required: Microphone permission

In `ios/App/App/Info.plist`, add:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>ScribeAI needs microphone access to record sessions.</string>
```

Or add it via Xcode: Info.plist → + → Privacy - Microphone Usage Description

### Build and run

Press **⌘R** or click the Run button. Select your connected device or a simulator.

---

## Android — Android Studio

### Open in Android Studio

```bash
npx cap open android
```

### Wait for Gradle sync

Android Studio will sync dependencies automatically. Wait for "Build: Gradle sync finished" in the status bar.

### Build and run

Click **Run ▶** or press **Shift+F10**. Select your connected device or an emulator.

### Microphone permission

The `capacitor-voice-recorder` plugin declares `RECORD_AUDIO` permission automatically
in its AndroidManifest. No manual step needed.

---

## Updating the app

Because the native shell loads the live Replit URL, most changes require no native rebuild:

| Change | Action needed |
|---|---|
| Web app code | Deploy on Replit — native app picks it up automatically |
| `server.url` in capacitor.config.json | Run `npx cap sync`, rebuild in Xcode/Android Studio |
| New Capacitor plugin | Run `npx cap sync`, rebuild in Xcode/Android Studio |
| App icon / splash screen | Run `npx cap sync`, rebuild |

---

## Troubleshooting

**Blank screen / can't connect**
- Check that `server.url` in `capacitor.config.json` points to the correct live Replit URL
- Make sure the Replit deployment is running
- On Android, ensure the device has internet access

**Microphone not working**
- iOS: Confirm `NSMicrophoneUsageDescription` is set in Info.plist
- Android: Check that `RECORD_AUDIO` permission is granted in device Settings

**Pod install fails**
- Run `sudo gem install cocoapods` then `cd ios/App && pod install`

**Gradle sync fails**
- Check that Java 17+ is configured in Android Studio: **File → Project Structure → SDK Location**
