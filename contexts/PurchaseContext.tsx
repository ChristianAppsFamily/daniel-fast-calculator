import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as InAppPurchases from 'expo-in-app-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAdsRemoved } from '@/components/AdManager';

const REMOVE_ADS_PRODUCT_ID = 'com.christianappempire.danielfast.removeads';
const PURCHASED_KEY = '@remove_ads_purchased';

interface PurchaseContextType {
  hasPurchased: boolean;
  isLoading: boolean;
  product: InAppPurchases.IAPItemDetails | null;
  purchaseRemoveAds: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

const PurchaseContext = createContext<PurchaseContextType>({
  hasPurchased: false,
  isLoading: true,
  product: null,
  purchaseRemoveAds: async () => false,
  restorePurchases: async () => false,
});

export const usePurchase = () => useContext(PurchaseContext);

export const PurchaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasPurchased, setHasPurchased] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [product, setProduct] = useState<InAppPurchases.IAPItemDetails | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize StoreKit connection
  useEffect(() => {
    const initStoreKit = async () => {
      if (Platform.OS === 'web') {
        setIsLoading(false);
        return;
      }

      try {
        // Connect to StoreKit
        await InAppPurchases.connectAsync();
        setIsConnected(true);
        console.log('StoreKit connected');

        // Query product details
        const { responseCode, results } = await InAppPurchases.getProductsAsync([REMOVE_ADS_PRODUCT_ID]);
        
        if (responseCode === InAppPurchases.IAPResponseCode.OK && results && results.length > 0) {
          setProduct(results[0]);
          console.log('Product found:', results[0].title, results[0].price);
        } else {
          console.log('Product not found or error:', responseCode);
        }

        // Check for existing purchases
        await checkPurchaseStatus();
      } catch (error) {
        console.error('Error initializing StoreKit:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initStoreKit();

    // Cleanup
    return () => {
      if (isConnected) {
        InAppPurchases.disconnectAsync().catch(console.error);
      }
    };
  }, []);

  // Listen for purchase updates
  useEffect(() => {
    if (!isConnected || Platform.OS === 'web') return;

    const subscription = InAppPurchases.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        for (const purchase of results) {
          if (!purchase.acknowledged) {
            // Acknowledge the purchase
            await InAppPurchases.finishTransactionAsync(purchase, true);
            console.log('Purchase acknowledged:', purchase.productId);
          }

          if (purchase.productId === REMOVE_ADS_PRODUCT_ID) {
            await completePurchase();
          }
        }
      } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
        console.log('User canceled purchase');
      } else {
        console.error('Purchase error:', errorCode);
      }
    });

    return () => {
      // @ts-ignore - cleanup
      subscription?.remove?.();
    };
  }, [isConnected]);

  const checkPurchaseStatus = async () => {
    try {
      // Check local storage first
      const purchased = await AsyncStorage.getItem(PURCHASED_KEY);
      if (purchased === 'true') {
        setHasPurchased(true);
        await setAdsRemoved(true);
        return;
      }

      // Query StoreKit for purchases
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        const hasRemoveAds = results.some(purchase => purchase.productId === REMOVE_ADS_PRODUCT_ID);
        
        if (hasRemoveAds) {
          await completePurchase();
        }
      }
    } catch (error) {
      console.error('Error checking purchase status:', error);
    }
  };

  const completePurchase = async () => {
    await AsyncStorage.setItem(PURCHASED_KEY, 'true');
    await setAdsRemoved(true);
    setHasPurchased(true);
  };

  const purchaseRemoveAds = async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !isConnected) {
      return false;
    }

    try {
      setIsLoading(true);
      await InAppPurchases.purchaseItemAsync(REMOVE_ADS_PRODUCT_ID);
      // The actual completion happens in the purchase listener
      return true;
    } catch (error) {
      console.error('Error purchasing remove ads:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !isConnected) {
      return false;
    }

    try {
      setIsLoading(true);
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        const hasRemoveAds = results.some(purchase => purchase.productId === REMOVE_ADS_PRODUCT_ID);
        
        if (hasRemoveAds) {
          await completePurchase();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PurchaseContext.Provider
      value={{
        hasPurchased,
        isLoading,
        product,
        purchaseRemoveAds,
        restorePurchases,
      }}
    >
      {children}
    </PurchaseContext.Provider>
  );
};
