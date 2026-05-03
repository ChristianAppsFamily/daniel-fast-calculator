import Foundation

/// Central definition of the App Group identifier and `UserDefaults` keys shared by iOS, watchOS, and the Widget extension.
enum SharedFastKeys {
  /// App Group shared between iPhone app, Watch app, and complications (must match Xcode capabilities).
  static let appGroupIdentifier = "group.com.christianappempire.danielfast"

  static let activeFastEndTime = "activeFastEndTime"
  static let activeFastStartTime = "activeFastStartTime"
  static let activeFastingFrom = "activeFastingFrom"
  static let activeFastDuration = "activeFastDuration"
  static let isFastActive = "isFastActive"
  static let activeFastId = "activeFastId"
  static let pendingWatchCancelFastId = "pendingWatchCancelFastId"

  /// Returns the shared defaults suite, or `nil` if App Groups are not configured for this target.
  static func suite() -> UserDefaults? {
    UserDefaults(suiteName: appGroupIdentifier)
  }
}
