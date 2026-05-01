import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FastingProvider } from '@/contexts/FastingContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { PurchaseProvider } from '@/contexts/PurchaseContext';
import { initializeAds } from '@/components/AdManager';

void SplashScreen.preventAutoHideAsync().catch(() => {});

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
    void SplashScreen.hideAsync().catch(() => {});
    initializeAds().catch(console.error);
  }, []);

  return (
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
  );
}
