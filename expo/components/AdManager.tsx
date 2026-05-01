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

// Debug flag - set to true to see ad status overlay
const SHOW_AD_DEBUG = __DEV__;

/** Google sample ads in dev / simulator; your real units in release App Store builds. */
const useGoogleSampleTestUnits =
  __DEV__ || process.env.EXPO_PUBLIC_USE_ADMOB_TEST_IDS === '1';

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

const BANNER_AD_UNIT_ID = useGoogleSampleTestUnits ? TestIds.BANNER : PROD_BANNER_UNIT!;

const INTERSTITIAL_AD_UNIT_ID = useGoogleSampleTestUnits
  ? TestIds.INTERSTITIAL
  : PROD_INTERSTITIAL_UNIT!;

// Ad status for debugging
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

// Keys for AsyncStorage
const CALCULATION_COUNT_KEY = '@calculation_count';
const ADS_REMOVED_KEY = '@ads_removed';

let interstitialAd: InterstitialAd | null = null;
let isInterstitialLoaded = false;
/** Matches latest ATT choice for interstitial reloads after close. */
let interstitialNpaOnly = true;

export const initializeAds = async (): Promise<void> => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    console.log('[Ads] Skipping initialization - not on mobile platform');
    return;
  }

  try {
    // Check if ads were removed via purchase
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

    console.log('[Ads] Initializing mobile ads...');
    await mobileAds().initialize();
    console.log('[Ads] Mobile ads initialized successfully');
    globalAdStatus.initialized = true;

    interstitialNpaOnly = !personalizedOk;
    loadInterstitialAd(interstitialNpaOnly);
  } catch (error) {
    console.error('[Ads] Error initializing ads:', error);
    globalAdStatus.initialized = false;
  }
};

const loadInterstitialAd = (requestNonPersonalizedAdsOnly = true) => {
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

  interstitialAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
    const errorMsg = error?.message || JSON.stringify(error) || 'Unknown error';
    console.error('[Ads] Interstitial ad error:', errorMsg);
    isInterstitialLoaded = false;
    globalAdStatus.interstitialLoaded = false;
    globalAdStatus.interstitialError = errorMsg;
  });

  interstitialAd.load();
};

export const showInterstitialAd = async (): Promise<void> => {
  try {
    // Check if ads were removed
    const adsRemoved = await AsyncStorage.getItem(ADS_REMOVED_KEY);
    if (adsRemoved === 'true') {
      return;
    }

    // Get current calculation count
    const countStr = await AsyncStorage.getItem(CALCULATION_COUNT_KEY);
    let count = parseInt(countStr || '0', 10);
    count += 1;

    // Show ad every 3rd calculation
    if (count >= 3) {
      count = 0; // Reset counter
      
      if (isInterstitialLoaded && interstitialAd) {
        console.log('[Ads] Showing interstitial ad');
        interstitialAd.show();
      } else {
        console.log('[Ads] Interstitial not ready, skipping');
      }
    }

    // Save updated count
    await AsyncStorage.setItem(CALCULATION_COUNT_KEY, count.toString());
  } catch (error) {
    console.error('[Ads] Error showing interstitial ad:', error);
  }
};

export const setAdsRemoved = async (removed: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(ADS_REMOVED_KEY, removed ? 'true' : 'false');
    if (removed && interstitialAd) {
      // @ts-ignore - destroy exists at runtime but types are outdated
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

  useEffect(() => {
    checkAdsStatus();
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
        <BannerAd
          unitId={BANNER_AD_UNIT_ID}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => {
            console.log('[Ads] Banner ad loaded successfully');
            setAdLoaded(true);
            setAdError(null);
            globalAdStatus.bannerLoaded = true;
            globalAdStatus.bannerError = null;
          }}
          onAdFailedToLoad={(error: any) => {
            const errorMsg = error?.message || JSON.stringify(error) || 'Unknown error';
            console.error('[Ads] Banner ad failed to load:', errorMsg);
            setAdLoaded(false);
            setAdError(errorMsg);
            globalAdStatus.bannerLoaded = false;
            globalAdStatus.bannerError = errorMsg;
          }}
        />
      </View>
      {SHOW_AD_DEBUG && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>
            {adLoaded ? '✅ Banner Loaded' : adError ? `❌ Error: ${adError.substring(0, 50)}` : '⏳ Loading...'}
          </Text>
          <Text style={styles.debugTextSmall}>
            Unit: {BANNER_AD_UNIT_ID === TestIds.BANNER ? 'TEST' : 'PROD'}
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
    height: 50, // Fixed height for BANNER size (320x50)
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
