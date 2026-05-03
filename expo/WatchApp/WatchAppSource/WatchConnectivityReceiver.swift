import Foundation
import WatchConnectivity

/// Forwards live updates from the iPhone into `UserDefaults` when the phone pushes `WCSession` messages.
final class WatchConnectivityReceiver: NSObject, WCSessionDelegate {
  static let shared = WatchConnectivityReceiver()

  private override init() {
    super.init()
  }

  /// Activates the watch-side session so application context and messages from iOS are received.
  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    applyPayload(applicationContext)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    applyPayload(message)
  }

  /// Writes known keys from the phone into the shared suite when an update arrives.
  private func applyPayload(_ message: [String: Any]) {
    guard let suite = SharedFastKeys.suite() else { return }

    if (message["event"] as? String) == "activeFastCleared" {
      suite.set(false, forKey: SharedFastKeys.isFastActive)
      suite.removeObject(forKey: SharedFastKeys.activeFastEndTime)
      suite.removeObject(forKey: SharedFastKeys.activeFastStartTime)
      suite.removeObject(forKey: SharedFastKeys.activeFastingFrom)
      suite.removeObject(forKey: SharedFastKeys.activeFastDuration)
      suite.removeObject(forKey: SharedFastKeys.activeFastId)
      suite.removeObject(forKey: SharedFastKeys.pendingWatchCancelFastId)
      suite.synchronize()
      NotificationCenter.default.post(name: .fastSnapshotChanged, object: nil)
      return
    }

    if let active = message[SharedFastKeys.isFastActive] as? Bool {
      suite.set(active, forKey: SharedFastKeys.isFastActive)
    } else if let num = message[SharedFastKeys.isFastActive] as? NSNumber {
      suite.set(num.boolValue, forKey: SharedFastKeys.isFastActive)
    }

    if let end = timeInterval(from: message[SharedFastKeys.activeFastEndTime]) {
      suite.set(Date(timeIntervalSince1970: end), forKey: SharedFastKeys.activeFastEndTime)
    }
    if let start = timeInterval(from: message[SharedFastKeys.activeFastStartTime]) {
      suite.set(Date(timeIntervalSince1970: start), forKey: SharedFastKeys.activeFastStartTime)
    }
    if let label = message[SharedFastKeys.activeFastingFrom] as? String {
      suite.set(label, forKey: SharedFastKeys.activeFastingFrom)
    }
    if let dur = timeInterval(from: message[SharedFastKeys.activeFastDuration]) {
      suite.set(dur, forKey: SharedFastKeys.activeFastDuration)
    }
    if let id = message[SharedFastKeys.activeFastId] as? String {
      suite.set(id, forKey: SharedFastKeys.activeFastId)
    }

    suite.synchronize()
    NotificationCenter.default.post(name: .fastSnapshotChanged, object: nil)
  }

  /// Normalizes numeric payload values from `WCSession` / plist bridging.
  private func timeInterval(from value: Any?) -> TimeInterval? {
    if let d = value as? Double { return d }
    if let n = value as? NSNumber { return n.doubleValue }
    return nil
  }
}

extension Notification.Name {
  static let fastSnapshotChanged = Notification.Name("SharedFastSnapshotChanged")
}
