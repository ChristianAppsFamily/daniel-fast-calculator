import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Bell, Gift, Sun, Moon, Smartphone, Shield, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFasting } from '@/contexts/FastingContext';
import { useTheme, AppearanceMode } from '@/contexts/ThemeContext';
import { usePurchase } from '@/contexts/PurchaseContext';

interface SettingRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  testID?: string;
  colors: ReturnType<typeof useTheme>['colors'];
  disabled?: boolean;
}

function SettingRow({ icon, title, subtitle, value, onToggle, testID, colors, disabled }: SettingRowProps) {
  const handleToggle = useCallback((newValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(newValue);
  }, [onToggle]);

  const styles = useMemo(() => createSettingRowStyles(colors), [colors]);

  return (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]} testID={testID}>
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={handleToggle}
        trackColor={{ false: colors.border, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : colors.disabled}
        ios_backgroundColor={colors.border}
        disabled={disabled}
      />
    </View>
  );
}

interface AppearanceOptionProps {
  icon: React.ReactNode;
  label: string;
  value: AppearanceMode;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function AppearanceOption({ icon, label, value, selected, onPress, colors }: AppearanceOptionProps) {
  const styles = useMemo(() => createAppearanceOptionStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.appearanceOption, selected && styles.appearanceOptionSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`appearance-${value}`}
    >
      {icon}
      <Text style={[styles.appearanceLabel, selected && styles.appearanceLabelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, isLoading } = useFasting();
  const { colors, appearanceMode, setAppearanceMode } = useTheme();
  const { hasPurchased, isLoading: isPurchaseLoading, product, purchaseRemoveAds, restorePurchases } = usePurchase();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleTimeFormatToggle = useCallback((value: boolean) => {
    updateSettings({ use24HourFormat: value });
    console.log('Time format changed to:', value ? '24-hour' : '12-hour');
  }, [updateSettings]);

  const handleReminderSoundToggle = useCallback((value: boolean) => {
    updateSettings({ reminderSoundEnabled: value });
    console.log('Reminder sound:', value ? 'enabled' : 'disabled');
  }, [updateSettings]);

  const handleRemoveAdsToggle = useCallback((value: boolean) => {
    if (value && !hasPurchased) {
      // User is trying to enable remove ads but hasn't purchased
      handlePurchasePress();
      return;
    }
    updateSettings({ adsRemoved: value });
    console.log('Remove ads:', value ? 'enabled' : 'disabled');
  }, [hasPurchased, updateSettings]);

  const handleAppearanceChange = useCallback((mode: AppearanceMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAppearanceMode(mode);
  }, [setAppearanceMode]);

  const handlePurchasePress = async () => {
    if (hasPurchased) {
      Alert.alert('Already Purchased', 'You have already removed ads. Thank you for your support!');
      return;
    }

    setIsPurchasing(true);
    try {
      const success = await purchaseRemoveAds();
      if (success) {
        Alert.alert('Purchase Initiated', 'Please complete the purchase in the App Store dialog.');
      } else {
        Alert.alert('Purchase Failed', 'Unable to start the purchase. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred during purchase. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestorePress = async () => {
    setIsPurchasing(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert('Success', 'Your purchases have been restored!');
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while restoring purchases. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.sectionCard}>
          <View style={styles.appearanceContainer}>
            <AppearanceOption
              icon={<Smartphone size={20} color={appearanceMode === 'system' ? colors.primary : colors.textSecondary} />}
              label="System"
              value="system"
              selected={appearanceMode === 'system'}
              onPress={() => handleAppearanceChange('system')}
              colors={colors}
            />
            <AppearanceOption
              icon={<Sun size={20} color={appearanceMode === 'light' ? colors.primary : colors.textSecondary} />}
              label="Light"
              value="light"
              selected={appearanceMode === 'light'}
              onPress={() => handleAppearanceChange('light')}
              colors={colors}
            />
            <AppearanceOption
              icon={<Moon size={20} color={appearanceMode === 'dark' ? colors.primary : colors.textSecondary} />}
              label="Dark"
              value="dark"
              selected={appearanceMode === 'dark'}
              onPress={() => handleAppearanceChange('dark')}
              colors={colors}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Display</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Clock size={22} color={colors.primary} />}
            title="24-Hour Time Format"
            subtitle="Display time in 24-hour format instead of AM/PM"
            value={settings.use24HourFormat}
            onToggle={handleTimeFormatToggle}
            testID="time-format-toggle"
            colors={colors}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon={<Bell size={22} color={colors.primary} />}
            title="Reminder Sound"
            subtitle="Play a sound when your fast ends"
            value={settings.reminderSoundEnabled}
            onToggle={handleReminderSoundToggle}
            testID="reminder-sound-toggle"
            colors={colors}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Premium</Text>
        <View style={styles.sectionCard}>
          {hasPurchased ? (
            <View style={styles.purchasedContainer}>
              <View style={styles.purchasedIcon}>
                <Gift size={24} color={colors.success} />
              </View>
              <View style={styles.purchasedContent}>
                <Text style={styles.purchasedTitle}>Thank You!</Text>
                <Text style={styles.purchasedText}>
                  You have removed ads. Enjoy your ad-free experience!
                </Text>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.purchaseButton}
                onPress={handlePurchasePress}
                disabled={isPurchasing || isPurchaseLoading}
                activeOpacity={0.7}
              >
                <View style={styles.purchaseIcon}>
                  <Gift size={22} color={colors.primary} />
                </View>
                <View style={styles.purchaseContent}>
                  <Text style={styles.purchaseTitle}>Remove Ads</Text>
                  <Text style={styles.purchaseSubtitle}>
                    {product ? `${product.price} one-time purchase` : '$4.99 one-time purchase'}
                  </Text>
                </View>
                {isPurchasing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.purchaseArrow}>→</Text>
                )}
              </TouchableOpacity>
              
              <View style={styles.divider} />
              
              <TouchableOpacity 
                style={styles.restoreButton}
                onPress={handleRestorePress}
                disabled={isPurchasing}
                activeOpacity={0.7}
              >
                <RefreshCw size={18} color={colors.textSecondary} />
                <Text style={styles.restoreText}>Restore Purchases</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.sectionCard}>
          <View style={styles.privacyContent}>
            <View style={styles.privacyIcon}>
              <Shield size={22} color={colors.primary} />
            </View>
            <View style={styles.privacyTextContainer}>
              <Text style={styles.privacyTitle}>Your Data Stays Private</Text>
              <Text style={styles.privacyText}>
                All your fasting data is stored locally on your device. We do not collect, store, or share any personal information. Your progress and settings never leave your phone.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.appName}>The Daniel Fast Calculator</Text>
        <Text style={styles.footerLabel}>Developed By</Text>
        <Text style={styles.footerCompany}>Christian App Empire LLC</Text>
        <Text style={styles.footerCopyright}>Copyright © 2026</Text>
        <Text style={styles.footerRights}>All Rights Reserved</Text>
      </View>
      </ScrollView>
    </View>
  );
}

const createSettingRowStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

const createAppearanceOptionStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  appearanceOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    gap: 8,
  },
  appearanceOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  appearanceLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  appearanceLabelSelected: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
});

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  appearanceContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  purchasedContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  purchasedIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchasedContent: {
    flex: 1,
    marginLeft: 14,
  },
  purchasedTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.success,
    marginBottom: 2,
  },
  purchasedText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  purchaseIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 12,
  },
  purchaseTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text,
    marginBottom: 2,
  },
  purchaseSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  purchaseArrow: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '400' as const,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
  },
  restoreText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  aboutSection: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
  },
  footerLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 12,
  },
  footerCompany: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footerCopyright: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  footerRights: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  privacyContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text,
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
