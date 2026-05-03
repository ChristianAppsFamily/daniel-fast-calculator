import SwiftUI
import WatchConnectivity

/// Primary watch UI: countdown, end label, cancel, or empty state.
struct ContentView: View {
  @State private var snapshot: SharedFastSnapshot = .load()
  @State private var now: Date = Date()

  private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

  var body: some View {
    Group {
      if snapshot.isActive, let end = snapshot.end {
        activeBody(end: end)
      } else {
        emptyBody
      }
    }
    .padding(.horizontal, 6)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black)
    .onAppear {
      snapshot = .load()
    }
    .onReceive(timer) { date in
      now = date
      snapshot = .load()
    }
    .onReceive(NotificationCenter.default.publisher(for: .fastSnapshotChanged)) { _ in
      snapshot = .load()
    }
  }

  /// Layout when a fast is currently active.
  private func activeBody(end: Date) -> some View {
    let remaining = max(0, end.timeIntervalSince(now))
    let h = Int(remaining) / 3600
    let m = (Int(remaining) % 3600) / 60
    let s = Int(remaining) % 60

    return VStack(alignment: .center, spacing: 6) {
      Text("Fasting From:")
        .font(.caption2)
        .foregroundColor(Color.orange.opacity(0.9))

      Text(snapshot.fastingFrom.isEmpty ? "—" : snapshot.fastingFrom)
        .font(.caption)
        .foregroundColor(.orange)
        .multilineTextAlignment(.center)
        .minimumScaleFactor(0.7)

      Text(String(format: "%02d:%02d:%02d", h, m, s))
        .font(.system(.title2, design: .default).weight(.bold))
        .foregroundColor(.orange)
        .monospacedDigit()

      Text(formattedEnd(end))
        .font(.caption2)
        .foregroundColor(.gray)
        .multilineTextAlignment(.center)

      Button(action: cancelFromWatch) {
        Text("Cancel Fast")
          .font(.caption)
          .fontWeight(.semibold)
      }
      .buttonStyle(.bordered)
      .tint(.red)
      .padding(.top, 4)
    }
  }

  /// Shown when `isFastActive` is false or dates are missing.
  private var emptyBody: some View {
    VStack(spacing: 8) {
      Image(systemName: "clock")
        .font(.title2)
        .foregroundColor(.orange)
      Text("No active fast")
        .font(.footnote)
        .foregroundColor(.gray)
    }
  }

  /// Formats the end time for the subtitle line.
  private func formattedEnd(_ end: Date) -> String {
    let df = DateFormatter()
    df.locale = Locale.current
    df.setLocalizedDateFormatFromTemplate("EEEEMMMdhmma")
    return "Ends " + df.string(from: end)
  }

  /// Clears the active fast in the App Group and pings the phone over `WCSession`.
  private func cancelFromWatch() {
    guard let suite = SharedFastKeys.suite() else { return }
    let id = suite.string(forKey: SharedFastKeys.activeFastId)
    suite.set(false, forKey: SharedFastKeys.isFastActive)
    if let id {
      suite.set(id, forKey: SharedFastKeys.pendingWatchCancelFastId)
    }
    suite.synchronize()

    var msg: [String: Any] = [
      "action": "cancelFast"
    ]
    if let id {
      msg["fastId"] = id
    }

    if WCSession.default.isReachable {
      WCSession.default.sendMessage(msg, replyHandler: { _ in }, errorHandler: { _ in })
    } else {
      try? WCSession.default.updateApplicationContext(msg)
    }

    snapshot = .load()
  }
}

#Preview {
  ContentView()
}
