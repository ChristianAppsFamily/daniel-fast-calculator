export type FastingType = 'Food' | 'TV' | 'Sports' | 'Alcohol' | 'Other';

export type FastingStatus = 'active' | 'completed' | 'cancelled';

export interface FastingRecord {
  id: string;
  startTime: string;
  durationMinutes: number;
  endTime: string;
  fastingFrom: string[];
  customFastingTypes?: string[];
  createdAt: string;
  status: FastingStatus;
  reminderSet: boolean;
  reminderId?: string;
  note?: string;
  // Legacy support
  fastingType?: FastingType;
  customFastingType?: string;
}

export const FASTING_TYPES: FastingType[] = ['Food', 'TV', 'Sports', 'Alcohol', 'Other'];

export interface AppSettings {
  use24HourFormat: boolean;
  reminderSoundEnabled: boolean;
  adsRemoved: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  use24HourFormat: false,
  reminderSoundEnabled: true,
  adsRemoved: false,
};

export const FAST_PRESETS = [
  { label: '12h', hours: 12, minutes: 0 },
  { label: '16h', hours: 16, minutes: 0 },
  { label: '18h', hours: 18, minutes: 0 },
  { label: '24h', hours: 24, minutes: 0 },
  { label: '36h', hours: 36, minutes: 0 },
  { label: '48h', hours: 48, minutes: 0 },
];
