# Daniel Fast Calculator — Apple Watch companion

This folder contains **Swift / SwiftUI source** for the watch app, complications, and shared App Group helpers. The **iPhone → Watch data path** is implemented in the Expo module `modules/watch-fast-sync` (runs after `npx expo prebuild` + `pod install`).

> **WidgetKit complications** use `accessoryCircular` / `accessoryRectangular`, which require **watchOS 9+** on device. The main watch UI targets **watchOS 7+**. In Xcode, set the **Widget Extension** deployment to **watchOS 9.0** and the **Watch App** to **7.0** (or raise the app to 9.0 if you prefer one minimum).

---

## Manual steps in Xcode (required)

Expo cannot fully generate a watchOS target; after every `npx expo prebuild --platform ios` you may need to **re-apply** target membership for files you add to the repo (or keep the `ios/` folder checked in—your choice).

### 1) App Group on the iPhone target

1. Open `ios/*.xcworkspace`.
2. Select the **iOS app target** (e.g. `DanielFastCalculator`).
3. **Signing & Capabilities** → **+ Capability** → **App Groups**.
4. Enable `group.com.christianappempire.danielfast` (must match `app.json` / plugin).

The Expo plugin `plugins/withAppGroupEntitlements.js` adds the entitlement to the **prebuilt** entitlements plist; Xcode must still show the capability toggled on for your team.

### 2) Add the watchOS target

1. **File → New → Target…**
2. Choose **watchOS → App** (SwiftUI life cycle).
3. Product name: **`DanielFastCalculator Watch App`** (bundle id suffix usually `.watchkitapp`).
4. Finish the assistant; Xcode creates the Watch App + Watch Extension scaffold.

### 3) Replace default Watch sources with this folder

1. Delete the template `ContentView.swift` / `App` file in the watch target if Xcode created duplicates.
2. Drag these **WatchApp/** groups into the Xcode project (copy if needed):

| Files | Target membership |
|-------|-------------------|
| `WatchApp/Shared/*` | Watch App **and** Widget Extension (if you use keys there) |
| `WatchApp/WatchAppSource/*` | Watch App only |
| `WatchApp/WidgetExtensionSource/*` | **Widget Extension** only |

### 4) App Group on Watch targets

For **Watch App** target and **Widget Extension** target:

1. **Signing & Capabilities** → **+ Capability** → **App Groups**.
2. Check the **same** group: `group.com.christianappempire.danielfast`.

### 5) Widget Extension target (complications)

1. **File → New → Target…** → **watchOS → Widget Extension**.
2. Deployment **watchOS 9.0** or newer.
3. Add `WidgetExtensionSource/FastWidget.swift` (and remove the default template widget if it conflicts `@main`).
4. **Embedded in** the Watch App: Build Phases → **Embed Watch Content** should include the widget extension (Xcode usually wires this).

### 6) `WKWatchKitApp` / bundle IDs

- Watch App `Info.plist`: ensure **`WKCompanionAppBundleIdentifier`** is your iOS bundle id: `com.christianappempire.danielfast`.
- iOS app’s `Info.plist` may include **`UISupportedInterfaceOrientations`** only; no Face ID is required for this feature (**`NSFaceIDUsageDescription`** not needed unless you add Face ID).

### 7) Build & run

1. Select the **Watch** scheme paired with your iPhone.
2. Build & run on a paired watch.

### 8) JavaScript / Expo

From the `expo/` directory:

```bash
npm install
npx expo prebuild --platform ios
```

Then open the workspace and repeat any Xcode steps that prebuild reset (entitlements usually persist if `ios/` is committed).

---

## Shared `UserDefaults` keys

| Key | Type | Meaning |
|-----|------|---------|
| `activeFastEndTime` | `Date` | Planned end |
| `activeFastStartTime` | `Date` | Start |
| `activeFastingFrom` | `String` | Label, e.g. `"Food, Sports"` |
| `activeFastDuration` | `Double` | Planned duration in **seconds** |
| `isFastActive` | `Bool` | Whether a fast is active |
| `activeFastId` | `String` | Record id for cancel matching (extra) |
| `pendingWatchCancelFastId` | `String?` | Watch requests cancel; iOS consumes via `watch-fast-sync` |

---

## NSFaceIDUsageDescription

Not required for this Watch feature set. Add only if you introduce Face ID / biometrics in a native screen you build later.
