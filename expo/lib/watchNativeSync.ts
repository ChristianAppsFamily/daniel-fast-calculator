import type { FastingRecord } from '@/types/fasting';
import {
  publishActiveFastToWatch,
  clearActiveFastOnWatch,
} from 'watch-fast-sync';

/**
 * Builds a single human-readable "fasting from" label for the watch face (comma-separated types).
 */
function formatFastingFromLabel(record: FastingRecord): string {
  if (record.fastingFrom && record.fastingFrom.length > 0) {
    return record.fastingFrom
      .map((t) => (t.startsWith('Other: ') ? t.replace(/^Other:\s*/, '') : t))
      .join(', ');
  }
  if (record.fastingType === 'Other' && record.customFastingType) {
    return record.customFastingType;
  }
  return record.fastingType ?? 'Food';
}

/**
 * Computes planned duration in seconds from start/end ISO strings.
 */
function durationSeconds(record: FastingRecord): number {
  const start = new Date(record.startTime).getTime();
  const end = new Date(record.endTime).getTime();
  return Math.max(0, (end - start) / 1000);
}

/**
 * Syncs the given record to the shared App Group + watch when it is the current active fast.
 * Does nothing on web or if the native module is unavailable.
 */
export async function syncActiveFastToNativeWatch(record: FastingRecord | null): Promise<void> {
  if (!record) {
    await clearActiveFastOnWatch();
    return;
  }
  const startMs = new Date(record.startTime).getTime();
  const endMs = new Date(record.endTime).getTime();
  await publishActiveFastToWatch({
    startMs,
    endMs,
    fastingFromLabel: formatFastingFromLabel(record),
    durationSeconds: durationSeconds(record),
    fastId: record.id,
  });
}
