import { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import mobileAds, {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Keys for AsyncStorage
const CALCULATION_COUNT_KEY = '@calculation_count';
const ADS_REMOVED_KEY = '@ads_removed';

let interstitialAd: InterstitialAd | null = null;
let isInterstitialLoaded = false;
/** Matches latest ATT choice for interstitial reloads after close. */
let interstitialNpaOnly = true;

export const initializeAds = async (): Promise<void> => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return;
  }

  try {
    // Check if ads were removed via purchase
    const adsRemoved = await AsyncStorage.getItem(ADS_REMOVED_KEY);
    if (adsRemoved === 'true') {
      console.log('Ads disabled - user purchased removal');
      return;
    }

    let personalizedOk = false;

    if (Platform.OS === 'ios') {
      const { status } = await requestTrackingPermissionsAsync();
      console.log('ATT permission status:', status);
      personalizedOk = status === 'granted';
    }

    await mobileAds().initialize();

    interstitialNpaOnly = !personalizedOk;
    loadInterstitialAd(interstitialNpaOnly);
  } catch (error) {
    console.error('Error initializing ads:', error);
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
    console.log('Interstitial ad loaded');
    isInterstitialLoaded = true;
  });

  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    console.log('Interstitial ad closed');
    isInterstitialLoaded = false;
    loadInterstitialAd(interstitialNpaOnly);
  });

  interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
    console.error('Interstitial ad error:', error);
    isInterstitialLoaded = false;
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
        console.log('Showing interstitial ad');
        interstitialAd.show();
      } else {
        console.log('Interstitial not ready, skipping');
      }
    }

    // Save updated count
    await AsyncStorage.setItem(CALCULATION_COUNT_KEY, count.toString());
  } catch (error) {
    console.error('Error showing interstitial ad:', error);
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
    console.error('Error setting ads removed:', error);
  }
};

export const hasUserRemovedAds = async (): Promise<boolean> => {
  try {
    const adsRemoved = await AsyncStorage.getItem(ADS_REMOVED_KEY);
    return adsRemoved === 'true';
  } catch (error) {
    console.error('Error checking ads removed status:', error);
    return false;
  }
};

interface BannerAdComponentProps {
  visible?: boolean;
}

export const BannerAdComponent: React.FC<BannerAdComponentProps> = ({ visible = true }) => {
  const [adsRemoved, setAdsRemovedState] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);

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
    <View style={styles.bannerContainer}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setAdLoaded(true)}
        onAdFailedToLoad={(error) => {
          console.error('Banner ad failed to load:', error);
          setAdLoaded(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
