import ExpoModulesCore
import Foundation
import WatchConnectivity

// MARK: - App Group + keys (must match WatchApp/Shared/SharedFastKeys.swift)

/// App group used by the iPhone app and watch targets after you enable the capability in Xcode.
private let appGroupId = "group.com.christianappempire.danielfast"

private enum Keys {
  static let activeFastEndTime = "activeFastEndTime"
  static let activeFastStartTime = "activeFastStartTime"
  static let activeFastingFrom = "activeFastingFrom"
  static let activeFastDuration = "activeFastDuration"
  static let isFastActive = "isFastActive"
  /// Extra key so the phone can match a watch-initiated cancel to the correct record.
  static let activeFastId = "activeFastId"
  /// When the watch taps Cancel, native sets this; JS polls `getPendingWatchCancelFastId` and calls `cancelFast`.
  static let pendingWatchCancelFastId = "pendingWatchCancelFastId"
}

// MARK: - Suite access

/// Returns the shared `UserDefaults` for the App Group, or `nil` if the entitlement is not yet configured.
private func appGroupSuite() -> UserDefaults? {
  UserDefaults(suiteName: appGroupId)
}

// MARK: - WatchConnectivity (phone side)

/// Activates `WCSession` and mirrors fast state to the watch when reachable.
/// Also receives lightweight cancel messages from the watch as a backup to shared defaults.
final class PhoneWatchSessionManager: NSObject, WCSessionDelegate {
  static let shared = PhoneWatchSessionManager()

  private override init() {
    super.init()
  }

  /// Starts the session if WatchConnectivity is supported on this device.
  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  /// Pushes the latest dictionary to the watch (reachable: message; otherwise application context).
  /// `applicationContext` must be property-list types only (no `Date`); this helper flattens timestamps.
  func pushToWatch(_ payload: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }

    var context: [String: Any] = [:]
    for (k, v) in payload {
      if let d = v as? Date {
        context[k] = d.timeIntervalSince1970
      } else {
        context[k] = v
      }
    }

    if session.isReachable {
      session.sendMessage(payload, replyHandler: { _ in }, errorHandler: { _ in
        try? session.updateApplicationContext(context)
      })
    } else {
      try? session.updateApplicationContext(context)
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  /// Receives cancel requests from the watch (companion path).
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    guard let action = message["action"] as? String, action == "cancelFast" else { return }
    let fastId = message["fastId"] as? String
    DispatchQueue.main.async {
      if let suite = appGroupSuite() {
        suite.set(false, forKey: Keys.isFastActive)
        if let id = fastId {
          suite.set(id, forKey: Keys.pendingWatchCancelFastId)
        }
        suite.synchronize()
      }
    }
  }
}

// MARK: - Expo module

/// Bridges React Native to App Group `UserDefaults` and WatchConnectivity for the Apple Watch companion.
public final class WatchFastSyncModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchFastSync")

    OnCreate {
      PhoneWatchSessionManager.shared.activate()
    }

    /// Writes active fast fields to the shared suite and notifies the watch.
    /// - Parameters use milliseconds since 1970 for portability from JavaScript.
    AsyncFunction("publishActiveFast") { (startMs: Double, endMs: Double, fastingFrom: String, durationSeconds: Double, fastId: String) in
      guard let suite = appGroupSuite() else {
        NSLog("[WatchFastSync] App Group suite unavailable — add App Group capability in Xcode.")
        return
      }
      let start = Date(timeIntervalSince1970: startMs / 1000.0)
      let end = Date(timeIntervalSince1970: endMs / 1000.0)
      suite.set(end, forKey: Keys.activeFastEndTime)
      suite.set(start, forKey: Keys.activeFastStartTime)
      suite.set(fastingFrom, forKey: Keys.activeFastingFrom)
      suite.set(durationSeconds, forKey: Keys.activeFastDuration)
      suite.set(true, forKey: Keys.isFastActive)
      suite.set(fastId, forKey: Keys.activeFastId)
      suite.removeObject(forKey: Keys.pendingWatchCancelFastId)
      suite.synchronize()

      var payload: [String: Any] = [
        "event": "activeFastUpdated",
        Keys.activeFastEndTime: end.timeIntervalSince1970,
        Keys.activeFastStartTime: start.timeIntervalSince1970,
        Keys.activeFastingFrom: fastingFrom,
        Keys.activeFastDuration: durationSeconds,
        Keys.isFastActive: true,
        Keys.activeFastId: fastId
      ]
      PhoneWatchSessionManager.shared.pushToWatch(payload)
    }

    /// Clears active fast flags when the user cancels/completes on iPhone.
    AsyncFunction("clearActiveFast") {
      guard let suite = appGroupSuite() else { return }
      suite.set(false, forKey: Keys.isFastActive)
      suite.removeObject(forKey: Keys.activeFastEndTime)
      suite.removeObject(forKey: Keys.activeFastStartTime)
      suite.removeObject(forKey: Keys.activeFastingFrom)
      suite.removeObject(forKey: Keys.activeFastDuration)
      suite.removeObject(forKey: Keys.activeFastId)
      suite.removeObject(forKey: Keys.pendingWatchCancelFastId)
      suite.synchronize()

      let payload: [String: Any] = [
        "event": "activeFastCleared",
        Keys.isFastActive: false
      ]
      PhoneWatchSessionManager.shared.pushToWatch(payload)
    }

    /// Returns and consumes a pending cancel id written by the watch (or clears stale state).
    AsyncFunction("getPendingWatchCancelFastId") { () -> String? in
      guard let suite = appGroupSuite() else { return nil }
      guard let id = suite.string(forKey: Keys.pendingWatchCancelFastId), !id.isEmpty else { return nil }
      suite.removeObject(forKey: Keys.pendingWatchCancelFastId)
      suite.synchronize()
      return id
    }
  }
}
