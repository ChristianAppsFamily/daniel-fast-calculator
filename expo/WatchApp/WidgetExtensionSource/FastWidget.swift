import SwiftUI
import WidgetKit

// MARK: - Timeline

/// Supplies complication entries and refreshes roughly every 15 minutes per product spec.
struct FastProvider: TimelineProvider {
  /// Placeholder used in Xcode canvas and during brief loads.
  func placeholder(in context: Context) -> FastEntry {
    FastEntry(date: Date(), snapshot: SharedFastSnapshot.load())
  }

  func getSnapshot(in context: Context, completion: @escaping (FastEntry) -> Void) {
    completion(FastEntry(date: Date(), snapshot: SharedFastSnapshot.load()))
  }

  /// Builds a single entry and schedules the next reload 15 minutes later.
  func getTimeline(in context: Context, completion: @escaping (Timeline<FastEntry>) -> Void) {
    let entry = FastEntry(date: Date(), snapshot: SharedFastSnapshot.load())
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}

/// One rendered frame for WidgetKit.
struct FastEntry: TimelineEntry {
  let date: Date
  let snapshot: SharedFastSnapshot
}

// MARK: - Views

/// Chooses layout for circular vs rectangular accessory families.
struct FastWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  var entry: FastEntry

  var body: some View {
    switch family {
    case .accessoryCircular:
      circular
    case .accessoryRectangular:
      rectangular
    default:
      circular
    }
  }

  /// Circular orange ring with hours remaining in the center (or a clock icon when idle).
  private var circular: some View {
    let p = entry.snapshot.progress(now: entry.date)
    let hoursLeft = max(0, Int(ceil(entry.snapshot.remaining(now: entry.date) / 3600)))

    return ZStack {
      Circle()
        .stroke(Color.orange.opacity(0.25), lineWidth: 3)
      Circle()
        .trim(from: 0, to: CGFloat(p))
        .stroke(Color.orange, style: StrokeStyle(lineWidth: 3, lineCap: .round))
        .rotationEffect(.degrees(-90))

      if entry.snapshot.isActive, entry.snapshot.end != nil {
        Text("\(hoursLeft)h")
          .font(.system(.caption2, design: .default).weight(.bold))
          .minimumScaleFactor(0.6)
      } else {
        Image(systemName: "clock")
          .font(.caption.weight(.semibold))
          .foregroundColor(.orange)
      }
    }
  }

  /// Three-line rectangular accessory layout.
  private var rectangular: some View {
    let rem = entry.snapshot.remaining(now: entry.date)
    let h = Int(rem) / 3600
    let m = (Int(rem) % 3600) / 60

    let endText: String = {
      guard let e = entry.snapshot.end else { return "—" }
      let df = DateFormatter()
      df.setLocalizedDateFormatFromTemplate("hmma")
      return df.string(from: e)
    }()

    let remainingText: String = {
      if !entry.snapshot.isActive { return "No active fast" }
      if h > 0 { return "\(h)h \(m)m left" }
      return "\(m)m left"
    }()

    return VStack(alignment: .leading, spacing: 2) {
      Text("Fast Ends")
        .font(.caption2)
        .foregroundStyle(.secondary)
      Text(endText)
        .font(.headline.weight(.semibold))
      Text(remainingText)
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

// MARK: - Widget

/// WidgetKit configuration for watch complications (requires watchOS 9+ for these accessory families).
@main
struct FastWidgets: Widget {
  let kind = "com.christianappempire.danielfast.widgets.fast"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: FastProvider()) { entry in
      FastWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Daniel Fast")
    .description("Active fast progress and end time.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}
