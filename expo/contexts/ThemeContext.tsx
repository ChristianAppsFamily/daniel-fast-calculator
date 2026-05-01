import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export type AppearanceMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  cardBackground: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  disabled: string;
  success: string;
  error: string;
  white: string;
  inputBackground: string;
  modalOverlay: string;
  errorBackground: string;
}

const lightColors: ThemeColors = {
  primary: '#F5760C',
  primaryLight: '#FFF3E8',
  background: '#FFFFFF',
  surface: '#F5F3F0',
  cardBackground: '#F0EDE8',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E0DCD6',
  disabled: '#D1D5DB',
  success: '#10B981',
  error: '#EF4444',
  white: '#FFFFFF',
  inputBackground: '#FAFAFA',
  modalOverlay: 'rgba(0, 0, 0, 0.4)',
  errorBackground: '#FEE2E2',
};

const darkColors: ThemeColors = {
  primary: '#FF8C2A',
  primaryLight: '#3D2810',
  background: '#0A0A0A',
  surface: '#1A1A1A',
  cardBackground: '#1F1F1F',
  text: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B6B',
  border: '#333333',
  disabled: '#4A4A4A',
  success: '#34D399',
  error: '#F87171',
  white: '#FFFFFF',
  inputBackground: '#2A2A2A',
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
  errorBackground: '#3D1515',
};

const APPEARANCE_KEY = 'appearance_mode';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const queryClient = useQueryClient();
  const systemColorScheme = useColorScheme();
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>('system');

  const appearanceQuery = useQuery({
    queryKey: ['appearanceMode'],
    queryFn: async (): Promise<AppearanceMode> => {
      try {
        const stored = await AsyncStorage.getItem(APPEARANCE_KEY);
        if (stored && ['system', 'light', 'dark'].includes(stored)) {
          return stored as AppearanceMode;
        }
        return 'system';
      } catch (error) {
        console.error('Error loading appearance mode:', error);
        return 'system';
      }
    },
  });

  useEffect(() => {
    if (appearanceQuery.data) {
      setAppearanceMode(appearanceQuery.data);
    }
  }, [appearanceQuery.data]);

  const { mutate: saveAppearance } = useMutation({
    mutationFn: async (mode: AppearanceMode) => {
      await AsyncStorage.setItem(APPEARANCE_KEY, mode);
      return mode;
    },
    onSuccess: (data) => {
      setAppearanceMode(data);
      queryClient.invalidateQueries({ queryKey: ['appearanceMode'] });
    },
  });

  const setAppearanceModeAndSave = useCallback((mode: AppearanceMode) => {
    saveAppearance(mode);
    console.log('Appearance mode changed to:', mode);
  }, [saveAppearance]);

  const isDark = useMemo(() => {
    if (appearanceMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return appearanceMode === 'dark';
  }, [appearanceMode, systemColorScheme]);

  const colors = useMemo(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  return {
    colors,
    isDark,
    appearanceMode,
    setAppearanceMode: setAppearanceModeAndSave,
    isLoading: appearanceQuery.isLoading,
  };
});
