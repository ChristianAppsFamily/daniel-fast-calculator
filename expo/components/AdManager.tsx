import { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import mobileAds, {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOW_AD_DEBUG = __DEV__;

/**
 * Use real AdMob unit IDs only when explicitly enabled (e.g. EAS production / App Store).
 * Otherwise use Google's sample units so Xcode Debug *and* Release builds always receive fill.
 */
const useProductionAdUnits =
  process.env.EXPO_PUBLIC_ADMOB_USE_PRODUCTION_UNITS === '1';

const PROD_BANNER_UNIT = Platform.select({
  ios: 'ca-app-pub-3002325591150738/9683450640',
  android: 'ca-app-pub-3002325591150738/4141981051',
  default: 'ca-app-pub-3002325591150738/9683450640',
});

const PROD_INTERSTITIAL_UNIT = Platform.select({
  ios: 'ca-app-pub-3002325591150738/4291523162',
  android: 'ca-app-pub-3002325591150738/1901681741',
  default: 'ca-app-pub-3002325591150738/4291523162',
});

const BANNER_AD_UNIT_ID = useProductionAdUnits ? PROD_BANNER_UNIT! : TestIds.BANNER;

const INTERSTITIAL_AD_UNIT_ID = useProductionAdUnits
  ? PROD_INTERSTITIAL_UNIT!
  : TestIds.INTERSTITIAL;

function parseTestDeviceIdsFromEnv(): string[] {
  const raw = process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS;
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Google requires this list before `initialize()` on physical devices when using
 * production units, and it improves reliability for sample units on some devices.
 * @see https://developers.google.com/admob/ios/test-ads
 */
function buildTestDeviceIdentifiers(): string[] {
  const ids = new Set<string>(parseTestDeviceIdsFromEnv());
  if (Platform.OS === 'android') {
    ids.add('EMULATOR');
  }
  return [...ids];
}

// Keys for AsyncStorage
const CALCULATION_COUNT_KEY = '@calculation_count';
const ADS_REMOVED_KEY = '@ads_removed';
const FASTING_TAB_VISIT_COUNT_KEY = '@fasting_tab_visit_count';
const FASTING_TAB_START_NEW_COUNT_KEY = '@fasting_tab_start_new_count';
const INTERSTITIAL_24H_TIMESTAMPS_KEY = '@interstitial_24h_timestamps';
const MS_24H = 24 * 60 * 60 * 1000;

let interstitialAd: InterstitialAd | null = null;
let isInterstitialLoaded = false;
let interstitialNpaOnly = true;
/** Set during initializeAds; banner reads after sdkReady. */
let bannerRequestNpaOnly = true;

let resolveMobileAdsReady: (() => void) | null = null;
export const mobileAdsInitPromise = new Promise<void>((resolve) => {
  resolveMobileAdsReady = resolve;
});

function signalMobileAdsReady(): void {
  resolveMobileAdsReady?.();
  resolveMobileAdsReady = null;
}

interface AdStatus {
  initialized: boolean;
  attStatus: string | null;
  bannerLoaded: boolean;
  bannerError: string | null;
  interstitialLoaded: boolean;
  interstitialError: string | null;
}

let globalAdStatus: AdStatus = {
  initialized: false,
  attStatus: null,
  bannerLoaded: false,
  bannerError: null,
  interstitialLoaded: false,
  interstitialError: null,
};

export const getAdStatus = (): AdStatus => ({ ...globalAdStatus });

export const initializeAds = async (): Promise<void> => {
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      console.log('[Ads] Skipping initialization - not on mobile platform');
      return;
    }

    const adsRemoved = await AsyncStorage.getItem(ADS_REMOVED_KEY);
    if (adsRemoved === 'true') {
      console.log('[Ads] Disabled - user purchased removal');
      return;
    }

    let personalizedOk = false;

    if (Platform.OS === 'ios') {
      console.log('[Ads] Requesting ATT permission...');
      const { status } = await requestTrackingPermissionsAsync();
      console.log('[Ads] ATT permission status:', status);
      globalAdStatus.attStatus = status;
      personalizedOk = status === 'granted';
    }

    const testDeviceIdentifiers = buildTestDeviceIdentifiers();
    if (testDeviceIdentifiers.length > 0) {
      await mobileAds().setRequestConfiguration({ testDeviceIdentifiers });
      console.log('[Ads] Request configuration set, test devices:', testDeviceIdentifiers.join(', '));
    } else if (!useProductionAdUnits) {
      console.log(
        '[Ads] Tip: if sample ads still show no-fill on a physical iPhone, add your device ID from Xcode logs to EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS in .env',
      );
    }

    console.log('[Ads] Initializing mobile ads...');
    await mobileAds().initialize();
    console.log('[Ads] Mobile ads initialized successfully');
    globalAdStatus.initialized = true;

    // Sample units: allow personalized requests (better fill). Production: respect ATT.
    interstitialNpaOnly = useProductionAdUnits ? !personalizedOk : false;
    bannerRequestNpaOnly = interstitialNpaOnly;

    loadInterstitialAd(interstitialNpaOnly);
  } catch (error) {
    console.error('[Ads] Error initializing ads:', error);
    globalAdStatus.initialized = false;
  } finally {
    signalMobileAdsReady();
  }
};

const loadInterstitialAd = (requestNonPersonalizedAdsOnly: boolean) => {
  if (interstitialAd) {
    // @ts-ignore - destroy exists at runtime but types are outdated
    interstitialAd.destroy();
  }

  interstitialAd = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly,
  });

  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    console.log('[Ads] Interstitial ad loaded');
    isInterstitialLoaded = true;
    globalAdStatus.interstitialLoaded = true;
    globalAdStatus.interstitialError = null;
  });

  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    console.log('[Ads] Interstitial ad closed');
    isInterstitialLoaded = false;
    globalAdStatus.interstitialLoaded = false;
    loadInterstitialAd(interstitialNpaOnly);
  });

  interstitialAd.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
    const errorMsg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : JSON.stringify(error);
    console.error('[Ads] Interstitial ad error:', errorMsg);
    isInterstitialLoaded = false;
    globalAdStatus.interstitialLoaded = false;
    globalAdStatus.interstitialError = errorMsg;
  });

  interstitialAd.load();
};

/** Legacy calculator hook (optional); fasting screen uses fasting-specific helpers below. */
export const showInterstitialAd = async (): Promise<void> => {
  try {
    const adsRemoved = await AsyncStorage.getItem(ADS_REMOVED_KEY);
    if (adsRemoved === 'true') {
      return;
    }

    const countStr = await AsyncStorage.getItem(CALCULATION_COUNT_KEY);
    let count = parseInt(countStr || '0', 10);
    count += 1;

    if (count >= 3) {
      count = 0;

      if (isInterstitialLoaded && interstitialAd) {
        console.log('[Ads] Showing interstitial ad');
        interstitialAd.show();
      } else {
        console.log('[Ads] Interstitial not ready, skipping');
      }
    }

    await AsyncStorage.setItem(CALCULATION_COUNT_KEY, count.toString());
  } catch (error) {
    console.error('[Ads] Error showing interstitial ad:', error);
  }
};

async function tryShowInterstitialWith24hCap(): Promise<void> {
  try {
    const adsRemoved = await AsyncStorage.getItem(ADS_REMOVED_KEY);
    if (adsRemoved === 'true') {
      return;
    }

    const raw = await AsyncStorage.getItem(INTERSTITIAL_24H_TIMESTAMPS_KEY);
    const now = Date.now();
    let timestamps: number[] = [];
    try {
      timestamps = raw ? (JSON.parse(raw) as number[]) : [];
      if (!Array.isArray(timestamps)) timestamps = [];
    } catch {
      timestamps = [];
    }

    const recent = timestamps.filter((t) => typeof t === 'number' && now - t < MS_24H);
    if (recent.length >= 2) {
      console.log('[Ads] Interstitial: 2 per 24h cap reached');
      return;
    }

    if (!isInterstitialLoaded || !interstitialAd) {
      console.log('[Ads] Interstitial not ready (fasting trigger)');
      return;
    }

    recent.push(now);
    await AsyncStorage.setItem(INTERSTITIAL_24H_TIMESTAMPS_KEY, JSON.stringify(recent));
    console.log('[Ads] Showing interstitial (fasting screen rule)');
    interstitialAd.show();
  } catch (e) {
    console.error('[Ads] tryShowInterstitialWith24hCap', e);
  }
}

/** Call when the Fasting tab gains focus. Shows on 3rd, 6th, 9th… visit if under daily cap. */
export async function onFastingTabFocused(): Promise<void> {
  try {
    const adsRemoved = await AsyncStorage.getItem(ADS_REMOVED_KEY);
    if (adsRemoved === 'true') return;

    const prev = parseInt((await AsyncStorage.getItem(FASTING_TAB_VISIT_COUNT_KEY)) || '0', 10);
    const visit = prev + 1;
    await AsyncStorage.setItem(FASTING_TAB_VISIT_COUNT_KEY, String(visit));

    if (visit >= 3 && visit % 3 === 0) {
      await tryShowInterstitialWith24hCap();
    }
  } catch (e) {
    console.error('[Ads] onFastingTabFocused', e);
  }
}

/**
 * Call when user commits to starting a new fast from the Fasting tab (navigate to calculator
 * or confirm modal). Shows on 2nd, 4th, 6th… start if under daily cap.
 */
export async function onStartNewFastFromFastingScreen(): Promise<void> {
  try {
    const adsRemoved = await AsyncStorage.getItem(ADS_REMOVED_KEY);
    if (adsRemoved === 'true') return;

    const prev = parseInt((await AsyncStorage.getItem(FASTING_TAB_START_NEW_COUNT_KEY)) || '0', 10);
    const n = prev + 1;
    await AsyncStorage.setItem(FASTING_TAB_START_NEW_COUNT_KEY, String(n));

    if (n >= 2 && n % 2 === 0) {
      await tryShowInterstitialWith24hCap();
    }
  } catch (e) {
    console.error('[Ads] onStartNewFastFromFastingScreen', e);
  }
}

export const setAdsRemoved = async (removed: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(ADS_REMOVED_KEY, removed ? 'true' : 'false');
    if (removed && interstitialAd) {
      // @ts-ignore
      interstitialAd.destroy();
      interstitialAd = null;
    }
  } catch (error) {
    console.error('[Ads] Error setting ads removed:', error);
  }
};

export const hasUserRemovedAds = async (): Promise<boolean> => {
  try {
    const adsRemoved = await AsyncStorage.getItem(ADS_REMOVED_KEY);
    return adsRemoved === 'true';
  } catch (error) {
    console.error('[Ads] Error checking ads removed status:', error);
    return false;
  }
};

interface BannerAdComponentProps {
  visible?: boolean;
}

export const BannerAdComponent: React.FC<BannerAdComponentProps> = ({ visible = true }) => {
  const [adsRemoved, setAdsRemovedState] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    checkAdsStatus();
  }, []);

  useEffect(() => {
    void mobileAdsInitPromise.then(() => setSdkReady(true));
  }, []);

  const checkAdsStatus = async () => {
    const removed = await hasUserRemovedAds();
    setAdsRemovedState(removed);
  };

  if (!visible || adsRemoved || Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.bannerWrapper}>
      <View style={styles.bannerContainer}>
        {!sdkReady ? (
          <View style={styles.placeholder} />
        ) : (
          <BannerAd
            unitId={BANNER_AD_UNIT_ID}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: bannerRequestNpaOnly }}
            onAdLoaded={() => {
              console.log('[Ads] Banner ad loaded successfully');
              setAdLoaded(true);
              setAdError(null);
              globalAdStatus.bannerLoaded = true;
              globalAdStatus.bannerError = null;
            }}
            onAdFailedToLoad={(error: unknown) => {
              const errorMsg =
                error && typeof error === 'object' && 'message' in error
                  ? String((error as { message: unknown }).message)
                  : JSON.stringify(error);
              console.error('[Ads] Banner ad failed to load:', errorMsg);
              setAdLoaded(false);
              setAdError(errorMsg);
              globalAdStatus.bannerLoaded = false;
              globalAdStatus.bannerError = errorMsg;
            }}
          />
        )}
      </View>
      {SHOW_AD_DEBUG && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>
            {!sdkReady
              ? '⏳ SDK init…'
              : adLoaded
                ? '✅ Banner Loaded'
                : adError
                  ? `❌ ${adError.substring(0, 45)}`
                  : '⏳ Loading ad…'}
          </Text>
          <Text style={styles.debugTextSmall}>
            {useProductionAdUnits ? 'PROD units' : 'SAMPLE test units'} · ATT:{' '}
            {globalAdStatus.attStatus ?? 'n/a'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerContainer: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  placeholder: {
    width: '100%',
    height: 50,
  },
  debugOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    alignItems: 'center',
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  debugTextSmall: {
    color: '#aaa',
    fontSize: 8,
  },
});
