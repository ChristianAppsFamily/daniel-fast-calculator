import { requireOptionalNativeModule } from 'expo-modules-core';

type WatchFastSyncNative = {
  publishActiveFast: (
    startMs: number,
    endMs: number,
    fastingFrom: string,
    durationSeconds: number,
    fastId: string,
  ) => Promise<void>;
  clearActiveFast: () => Promise<void>;
  getPendingWatchCancelFastId: () => Promise<string | null | undefined>;
};

const native = requireOptionalNativeModule<WatchFastSyncNative>('WatchFastSync');

/**
 * Pushes the current active fast into the App Group `UserDefaults` and notifies the watch via WCSession.
 * Call whenever an active fast exists on the phone (start time &lt; now &lt; end time, status active).
 */
export async function publishActiveFastToWatch(params: {
  startMs: number;
  endMs: number;
  fastingFromLabel: string;
  durationSeconds: number;
  fastId: string;
}): Promise<void> {
  if (!native) return;
  await native.publishActiveFast(
    params.startMs,
    params.endMs,
    params.fastingFromLabel,
    params.durationSeconds,
    params.fastId,
  );
}

/**
 * Clears shared fast state when the user has no active fast (cancelled, completed, or cleared).
 */
export async function clearActiveFastOnWatch(): Promise<void> {
  if (!native) return;
  await native.clearActiveFast();
}

/**
 * Returns a pending fast id if the watch requested cancellation via shared defaults, then clears the flag.
 * Used by the app to mirror cancel into AsyncStorage-backed history.
 */
export async function consumePendingWatchCancelFastId(): Promise<string | null> {
  if (!native) return null;
  const id = await native.getPendingWatchCancelFastId();
  return id ?? null;
}
