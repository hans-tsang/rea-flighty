## iOS builds, signing, and TestFlight without a Mac

> **Not performed in this session:** I have not run any iOS build, EAS build, signing step, TestFlight upload, or device test. `eas.json` follows Expo's documented profile format but has not been validated against an EAS account (the sandbox cannot reach Expo's servers).

### Accounts and costs (confirm current prices)

| Item | Needed for | Cost |
| --- | --- | --- |
| Expo account | EAS Build and Submit | Free tier with limited monthly builds and queue priority; paid plans for more |
| Apple Developer Program | Any install on a device outside Expo Go, plus TestFlight and the App Store | Paid annual membership (reported as US $99/year) |
| iPhone | Expo Go testing, dev builds | Optional but strongly recommended |

### 1. One-time setup (Windows or Linux)

```bash
npm install --global eas-cli    # or use: npx eas-cli <command>
eas login
eas init                        # links the project and writes extra.eas.projectId into app.json
```

Before your first real build, change `ios.bundleIdentifier` in `app.json` from the placeholder `com.example.reaflighty` to an identifier you own.

### 2. Build profiles (`eas.json`)

| Profile | Use | Notes |
| --- | --- | --- |
| `development` | Dev client on your iPhone | Run `npx expo install expo-dev-client` first. Install it only when you add native modules that Expo Go lacks. Register your device with `eas device:create`. |
| `preview` | Internal ad-hoc build for registered devices | Signed with an ad-hoc provisioning profile |
| `production` | App Store / TestFlight | `autoIncrement` bumps the build number remotely |

### 3. Signing

Run `eas build -p ios --profile production`. When asked, sign in with your Apple ID and let EAS **generate and store** the distribution certificate and provisioning profile. You do not need a Mac or a keychain. To manage them later, run `eas credentials`.

- For CI, create an **App Store Connect API key** (Users and Access → Integrations) and give it to EAS (`eas credentials` → App Store Connect API Key) instead of storing an Apple ID password.
- Never commit `.p8`, `.p12`, or `.mobileprovision` files. `.gitignore` already excludes them.

### 4. TestFlight

```bash
eas build -p ios --profile production
eas submit -p ios --latest      # uploads to App Store Connect, then TestFlight
```

The first submission needs an app record in App Store Connect; EAS can create one. External TestFlight testers require Beta App Review. `ios.config.usesNonExemptEncryption: false` in `app.json` answers the export-compliance question for this app, which uses only standard HTTPS. Re-check this if you add custom cryptography.

### 5. Optional: build from GitHub Actions

Add an `EXPO_TOKEN` repository secret, then add a job that runs `npx eas-cli build -p ios --profile preview --non-interactive --no-wait`. **Not added yet.** Every build counts against your EAS quota, so turn this on deliberately.

### Features that need more than Expo Go

| Feature | Requires |
| --- | --- |
| Push notifications (production) | EAS build, push entitlement, APNs key (EAS can manage it) |
| Widgets, Live Activities, Dynamic Island | Swift widget-extension target added through a config plugin, then an EAS build. Hard to debug without Xcode. |
| Calendar import | `expo-calendar` (included in Expo Go) plus permission strings |
| Background refresh | `expo-background-task`, which is limited by iOS scheduling. Real alerts should come from server push. |
