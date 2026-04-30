import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Notifications from 'expo-notifications';
import { FastingRecord, AppSettings, DEFAULT_SETTINGS } from '@/types/fasting';

const HISTORY_KEY = 'fasting_history';
const SETTINGS_KEY = 'fasting_settings';

export const [FastingProvider, useFasting] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [history, setHistory] = useState<FastingRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const historyQuery = useQuery({
    queryKey: ['fastingHistory'],
    queryFn: async (): Promise<FastingRecord[]> => {
      try {
        const stored = await AsyncStorage.getItem(HISTORY_KEY);
        if (!stored || stored === 'undefined' || stored === 'null') {
          return [];
        }
        
        // Validate that stored data looks like JSON before parsing
        const trimmed = stored.trim();
        if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
          console.warn('History data is not valid JSON, clearing...');
          await AsyncStorage.removeItem(HISTORY_KEY);
          return [];
        }
        
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
          console.warn('History data is not an array, clearing...');
          await AsyncStorage.removeItem(HISTORY_KEY);
          return [];
        }
        return parsed;
      } catch {
        console.warn('Error loading history, clearing corrupted data');
        try {
          await AsyncStorage.removeItem(HISTORY_KEY);
        } catch {
          // Ignore cleanup errors
        }
        return [];
      }
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['fastingSettings'],
    queryFn: async (): Promise<AppSettings> => {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (!stored || stored === 'undefined' || stored === 'null') {
          return DEFAULT_SETTINGS;
        }
        
        // Validate that stored data looks like JSON before parsing
        const trimmed = stored.trim();
        if (!trimmed.startsWith('{')) {
          console.warn('Settings data is not valid JSON, clearing...');
          await AsyncStorage.removeItem(SETTINGS_KEY);
          return DEFAULT_SETTINGS;
        }
        
        const parsed = JSON.parse(stored);
        if (typeof parsed !== 'object' || parsed === null) {
          console.warn('Settings data is invalid, clearing...');
          await AsyncStorage.removeItem(SETTINGS_KEY);
          return DEFAULT_SETTINGS;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        console.warn('Error loading settings, clearing corrupted data');
        try {
          await AsyncStorage.removeItem(SETTINGS_KEY);
        } catch {
          // Ignore cleanup errors
        }
        return DEFAULT_SETTINGS;
      }
    },
  });

  useEffect(() => {
    if (historyQuery.data) {
      setHistory(historyQuery.data);
    }
  }, [historyQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const { mutate: saveHistory } = useMutation({
    mutationFn: async (newHistory: FastingRecord[]) => {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    },
    onSuccess: (data) => {
      setHistory(data);
      queryClient.invalidateQueries({ queryKey: ['fastingHistory'] });
    },
  });

  const { mutate: saveSettings } = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      return newSettings;
    },
    onSuccess: (data) => {
      setSettings(data);
      queryClient.invalidateQueries({ queryKey: ['fastingSettings'] });
    },
  });

  const activeFast = useMemo(() => {
    const now = new Date();
    return history.find(
      (record) => record.status === 'active' && new Date(record.endTime) > now
    ) || null;
  }, [history]);

  const pastFasts = useMemo(() => {
    const now = new Date();
    return history.filter(
      (record) => 
        record.status === 'completed' || 
        record.status === 'cancelled' ||
        (record.status === 'active' && new Date(record.endTime) <= now)
    );
  }, [history]);

  const addFastingRecord = useCallback((record: Omit<FastingRecord, 'id' | 'createdAt'>) => {
    const newRecord: FastingRecord = {
      ...record,
      fastingFrom: record.fastingFrom || ['Food'],
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const newHistory = [newRecord, ...history];
    saveHistory(newHistory);
    console.log('Added fasting record:', newRecord);
    return newRecord;
  }, [history, saveHistory]);

  const updateFastingRecord = useCallback((id: string, updates: Partial<FastingRecord>) => {
    const newHistory = history.map((record) =>
      record.id === id ? { ...record, ...updates } : record
    );
    saveHistory(newHistory);
    console.log('Updated fasting record:', id, updates);
  }, [history, saveHistory]);

  const cancelFast = useCallback(async (id: string) => {
    const record = history.find((r) => r.id === id);
    if (record?.reminderId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(record.reminderId);
        console.log('Cancelled reminder:', record.reminderId);
      } catch (error) {
        console.error('Error cancelling notification:', error);
      }
    }
    updateFastingRecord(id, { status: 'cancelled', reminderSet: false, reminderId: undefined });
  }, [history, updateFastingRecord]);

  const setReminderForFast = useCallback((id: string, reminderId: string) => {
    updateFastingRecord(id, { reminderSet: true, reminderId });
  }, [updateFastingRecord]);

  const cancelReminderForFast = useCallback(async (id: string) => {
    const record = history.find((r) => r.id === id);
    if (record?.reminderId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(record.reminderId);
        console.log('Cancelled reminder:', record.reminderId);
      } catch (error) {
        console.error('Error cancelling notification:', error);
      }
    }
    updateFastingRecord(id, { reminderSet: false, reminderId: undefined });
  }, [history, updateFastingRecord]);

  const clearHistory = useCallback(() => {
    saveHistory([]);
    console.log('Cleared fasting history');
  }, [saveHistory]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    saveSettings(newSettings);
    console.log('Updated settings:', newSettings);
  }, [settings, saveSettings]);

  return {
    history,
    settings,
    activeFast,
    pastFasts,
    addFastingRecord,
    updateFastingRecord,
    cancelFast,
    setReminderForFast,
    cancelReminderForFast,
    clearHistory,
    updateSettings,
    isLoading: historyQuery.isLoading || settingsQuery.isLoading,
  };
});
