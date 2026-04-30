import { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  AdEventType,
  AdsConsent,
  AdsConsentStatus,
  TestIds,
} from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ad unit IDs
const BANNER_AD_UNIT_ID = __DEV__ 
  ? TestIds.BANNER 
  : 'ca-app-pub-3002325591150738/9683450640';

const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-3002325591150738/4291523162';

// Keys for AsyncStorage
const CALCULATION_COUNT_KEY = '@calculation_count';
const ADS_REMOVED_KEY = '@ads_removed';

let interstitialAd: InterstitialAd | null = null;
let isInterstitialLoaded = false;

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

    // Request ATT permission first (iOS only)
    if (Platform.OS === 'ios') {
      const { status } = await requestTrackingPermissionsAsync();
      console.log('ATT permission status:', status);
      
      // Configure consent based on ATT status
      if (status === 'granted') {
        // User allowed tracking - can use personalized ads
        console.log('User allowed tracking - personalized ads enabled');
      } else {
        // User denied tracking - use non-personalized ads
        console.log('User denied tracking - using non-personalized ads');
      }
    }

    // Initialize the interstitial ad
    loadInterstitialAd();
  } catch (error) {
    console.error('Error initializing ads:', error);
  }
};

const loadInterstitialAd = () => {
  if (interstitialAd) {
    interstitialAd.destroy();
  }

  interstitialAd = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true, // Default to non-personalized for safety
  });

  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    console.log('Interstitial ad loaded');
    isInterstitialLoaded = true;
  });

  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    console.log('Interstitial ad closed');
    isInterstitialLoaded = false;
    // Load next ad
    loadInterstitialAd();
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
