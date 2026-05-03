import Foundation

/// A lightweight snapshot of the active fast read from the App Group `UserDefaults`.
struct SharedFastSnapshot {
  let isActive: Bool
  let start: Date?
  let end: Date?
  let fastingFrom: String
  let plannedDurationSeconds: Double
  let fastId: String?

  /// Reads the suite and builds a snapshot for UI and complications.
  static func load() -> SharedFastSnapshot {
    guard let suite = SharedFastKeys.suite() else {
      return SharedFastSnapshot(
        isActive: false,
        start: nil,
        end: nil,
        fastingFrom: "",
        plannedDurationSeconds: 0,
        fastId: nil
      )
    }

    let active = suite.bool(forKey: SharedFastKeys.isFastActive)
    let start = suite.object(forKey: SharedFastKeys.activeFastStartTime) as? Date
    let end = suite.object(forKey: SharedFastKeys.activeFastEndTime) as? Date
    let label = suite.string(forKey: SharedFastKeys.activeFastingFrom) ?? ""
    let duration = suite.double(forKey: SharedFastKeys.activeFastDuration)
    let id = suite.string(forKey: SharedFastKeys.activeFastId)

    return SharedFastSnapshot(
      isActive: active,
      start: start,
      end: end,
      fastingFrom: label,
      plannedDurationSeconds: duration,
      fastId: id
    )
  }

  /// Fraction complete in `0...1` based on start/end and current time.
  func progress(now: Date = Date()) -> Double {
    guard isActive, let s = start, let e = end, e > s else { return 0 }
    let t = now.timeIntervalSince(s) / e.timeIntervalSince(s)
    return min(1, max(0, t))
  }

  /// Remaining time interval; zero if inactive or past end.
  func remaining(now: Date = Date()) -> TimeInterval {
    guard isActive, let e = end else { return 0 }
    return max(0, e.timeIntervalSince(now))
  }
}
