import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FastingProvider } from '@/contexts/FastingContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { PurchaseProvider } from '@/contexts/PurchaseContext';
import { trpc, trpcClient } from '@/lib/trpc';
import { initializeAds } from '@/components/AdManager';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { colors } = useTheme();
  
  return (
    <Stack 
      screenOptions={{ 
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    
    // Initialize ads after splash screen
    initializeAds().catch(console.error);
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <PurchaseProvider>
            <FastingProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <RootLayoutNav />
              </GestureHandlerRootView>
            </FastingProvider>
          </PurchaseProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
