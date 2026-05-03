import SwiftUI

/// Entry point for the watchOS app (SwiftUI life cycle). In Xcode, name the target **DanielFastCalculator Watch App**; this type follows the usual `…AppApp` pattern.
@main
struct DanielFastCalculatorWatchAppApp: App {
  init() {
    // Start WCSession once so live updates from the phone apply to shared defaults.
    WatchConnectivityReceiver.shared.activate()
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}
