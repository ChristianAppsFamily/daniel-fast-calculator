import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  Share,
} from 'react-native';
import {
  BannerAdComponent,
  onFastingTabFocused,
  onStartNewFastFromFastingScreen,
} from '@/components/AdManager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, Clock, Calendar, Timer, X, Play, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useFasting } from '@/contexts/FastingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FastingRecord } from '@/types/fasting';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeFast, pastFasts, settings, clearHistory, cancelFast, isLoading } = useFasting();
  const { colors } = useTheme();
  const [showStartNewModal, setShowStartNewModal] = useState(false);
  const [activeTimeRemaining, setActiveTimeRemaining] = useState<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  

  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    if (settings.use24HourFormat) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });
    }
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  }, [settings.use24HourFormat]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const formatDateTime = useCallback((dateString: string) => {
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
  }, [formatDate, formatTime]);

  const formatDuration = useCallback((minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }, []);

  const updateActiveTimeRemaining = useCallback(() => {
    if (!activeFast) {
      setActiveTimeRemaining('');
      return;
    }

    const endTime = new Date(activeFast.endTime);
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();

    if (diff <= 0) {
      setActiveTimeRemaining('Complete!');
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    let remaining = '';
    if (days > 0) remaining += `${days}d `;
    if (hrs > 0 || days > 0) remaining += `${hrs}h `;
    remaining += `${mins}m ${secs}s`;

    setActiveTimeRemaining(remaining.trim());
  }, [activeFast]);

  useEffect(() => {
    if (activeFast) {
      updateActiveTimeRemaining();
      intervalRef.current = setInterval(updateActiveTimeRemaining, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeFast, updateActiveTimeRemaining]);

  const handleClearHistory = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all fasting records? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            clearHistory();
            console.log('History cleared');
          }
        },
      ]
    );
  }, [clearHistory]);

  const handleCancelFast = useCallback(() => {
    if (!activeFast) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Cancel Fast',
      'Are you sure you want to cancel your current fast?',
      [
        { text: 'Keep Fasting', style: 'cancel' },
        { 
          text: 'Cancel Fast', 
          style: 'destructive',
          onPress: async () => {
            await cancelFast(activeFast.id);
            console.log('Fast cancelled');
          }
        },
      ]
    );
  }, [activeFast, cancelFast]);

  const handleStartNewFast = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeFast) {
      setShowStartNewModal(true);
    } else {
      void (async () => {
        await onStartNewFastFromFastingScreen();
        router.push('/(tabs)');
      })();
    }
  }, [activeFast, router]);

  const confirmStartNewFast = useCallback(async () => {
    if (activeFast) {
      await cancelFast(activeFast.id);
    }
    setShowStartNewModal(false);
    await onStartNewFastFromFastingScreen();
    router.push('/(tabs)');
  }, [activeFast, cancelFast, router]);

  useFocusEffect(
    useCallback(() => {
      void onFastingTabFocused();
    }, []),
  );

  const getFastingFromDisplay = useCallback((item: FastingRecord): string[] => {
    if (item.fastingFrom && item.fastingFrom.length > 0) {
      return item.fastingFrom.map(type => type.startsWith('Other: ') ? type.replace('Other: ', '') : type);
    }
    if (item.fastingType === 'Other' && item.customFastingType) {
      return [item.customFastingType];
    }
    return [item.fastingType || 'Food'];
  }, []);

  const getStatusBadge = useCallback((item: FastingRecord) => {
    const now = new Date();
    const endTime = new Date(item.endTime);
    
    if (item.status === 'cancelled') {
      return { label: 'Cancelled', color: colors.error };
    }
    if (item.status === 'completed' || endTime <= now) {
      return { label: 'Completed', color: colors.success };
    }
    return { label: 'Active', color: colors.primary };
  }, [colors]);

  const handleViewActiveFast = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)');
  }, [router]);

  const handleShareFast = useCallback(async (item: FastingRecord, isActive: boolean = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const fastTypes = getFastingFromDisplay(item).join(', ');
    const durationText = formatDuration(item.durationMinutes);
    const startDate = formatDateTime(item.startTime);
    const endDate = formatDateTime(item.endTime);
    
    let statusText = '';
    if (item.status === 'cancelled') {
      statusText = '❌ Cancelled';
    } else if (isActive) {
      statusText = `⏱️ ${activeTimeRemaining} remaining`;
    } else {
      statusText = '✅ Completed!';
    }
    
    const message = `🙏 My Fasting Journey\n\n` +
      `📋 Fasting from: ${fastTypes}\n` +
      `⏰ Duration: ${durationText}\n` +
      `🕐 Started: ${startDate}\n` +
      `🏁 Ends: ${endDate}\n` +
      `📊 Status: ${statusText}\n\n` +
      `#Fasting #SpiritualJourney`;
    
    try {
      await Share.share({
        message,
        title: 'My Fast Progress',
      });
      console.log('Fast shared successfully');
    } catch (error) {
      console.error('Error sharing fast:', error);
    }
  }, [getFastingFromDisplay, formatDuration, formatDateTime, activeTimeRemaining]);

  const renderActiveFastSection = useCallback(() => {
    if (!activeFast) return null;

    return (
      <View style={styles.activeFastSection}>
        <Text style={styles.sectionTitle}>Active Fast</Text>
        <View style={styles.activeFastCard}>
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={handleViewActiveFast}
            testID="view-active-fast-button"
          >
          <View style={styles.activeFastHeader}>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>In Progress</Text>
            </View>
            <View style={styles.fastingChipsRow}>
              {getFastingFromDisplay(activeFast).map((type, index) => (
                <View key={index} style={styles.typeBadge}>
                  <Text style={styles.typeText}>{type}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.countdownContainer}>
            <Text style={styles.countdownLabel}>Time Remaining</Text>
            <Text style={styles.countdownValue}>{activeTimeRemaining}</Text>
          </View>

          <View style={styles.activeFastDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Started</Text>
              <Text style={styles.detailValue}>{formatDateTime(activeFast.startTime)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ends</Text>
              <Text style={styles.detailValue}>{formatDateTime(activeFast.endTime)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reminder</Text>
              <Text style={[styles.detailValue, { color: activeFast.reminderSet ? colors.success : colors.textMuted }]}>
                {activeFast.reminderSet ? 'On' : 'Off'}
              </Text>
            </View>
          </View>
          <Text style={styles.tapToViewText}>Tap to view details</Text>
          </TouchableOpacity>

          <View style={styles.activeFastActions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.shareActionButton]}
              onPress={() => handleShareFast(activeFast, true)}
              testID="share-active-fast-button"
            >
              <Share2 size={18} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelActionButton]}
              onPress={handleCancelFast}
              testID="cancel-fast-button"
            >
              <X size={18} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>Cancel Fast</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.startNewButton}
            onPress={handleStartNewFast}
            testID="start-new-fast-button"
          >
            <Play size={18} color={colors.white} />
            <Text style={styles.startNewButtonText}>Start New Fast</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [activeFast, activeTimeRemaining, colors, styles, formatDateTime, getFastingFromDisplay, handleCancelFast, handleStartNewFast, handleViewActiveFast, handleShareFast]);

  const renderItem = useCallback(({ item }: { item: FastingRecord }) => {
    const statusBadge = getStatusBadge(item);
    
    return (
      <View 
        style={styles.historyItem} 
        testID={`history-item-${item.id}`}
      >
        <View style={styles.itemHeader}>
          <View style={styles.durationBadge}>
            <Timer size={14} color={colors.primary} />
            <Text style={styles.durationText}>{formatDuration(item.durationMinutes)}</Text>
          </View>
          {getFastingFromDisplay(item).slice(0, 2).map((type, index) => (
            <View key={index} style={styles.typeBadge}>
              <Text style={styles.typeText}>{type}</Text>
            </View>
          ))}
          {getFastingFromDisplay(item).length > 2 && (
            <View style={styles.typeBadgeMore}>
              <Text style={styles.typeTextMore}>+{getFastingFromDisplay(item).length - 2}</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusBadge.color }]}>{statusBadge.label}</Text>
          </View>
        </View>
        
        <View style={styles.timeRow}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Started</Text>
            <View style={styles.timeValueRow}>
              <Calendar size={14} color={colors.textMuted} />
              <Text style={styles.dateText}>{formatDate(item.startTime)}</Text>
            </View>
            <View style={styles.timeValueRow}>
              <Clock size={14} color={colors.textMuted} />
              <Text style={styles.timeText}>{formatTime(item.startTime)}</Text>
            </View>
          </View>
          
          <View style={styles.arrow}>
            <Text style={styles.arrowText}>→</Text>
          </View>
          
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Ended</Text>
            <View style={styles.timeValueRow}>
              <Calendar size={14} color={colors.textMuted} />
              <Text style={styles.dateText}>{formatDate(item.endTime)}</Text>
            </View>
            <View style={styles.timeValueRow}>
              <Clock size={14} color={colors.textMuted} />
              <Text style={styles.timeText}>{formatTime(item.endTime)}</Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.shareHistoryButton}
          onPress={() => handleShareFast(item, false)}
          testID={`share-fast-${item.id}`}
        >
          <Share2 size={16} color={colors.primary} />
          <Text style={styles.shareHistoryButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
    );
  }, [formatDate, formatTime, formatDuration, getFastingFromDisplay, getStatusBadge, colors, styles, handleShareFast]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Clock size={48} color={colors.disabled} />
      </View>
      <Text style={styles.emptyTitle}>No Past Fasts</Text>
      <Text style={styles.emptyText}>
        Your completed fasts will appear here. Start tracking your first fast from the Fasting tab.
      </Text>
      <TouchableOpacity 
        style={styles.emptyStartButton}
        onPress={() => {
          void (async () => {
            await onStartNewFastFromFastingScreen();
            router.push('/(tabs)');
          })();
        }}
      >
        <Play size={18} color={colors.white} />
        <Text style={styles.emptyStartButtonText}>Start a Fast</Text>
      </TouchableOpacity>
    </View>
  ), [colors, styles, router]);

  const renderListHeader = useCallback(() => (
    <>
      {renderActiveFastSection()}
      {pastFasts.length > 0 && (
        <View style={styles.pastFastsHeader}>
          <Text style={styles.sectionTitle}>Past Fasts</Text>
          <View style={styles.headerRight}>
            <Text style={styles.recordCount}>{pastFasts.length} record{pastFasts.length !== 1 ? 's' : ''}</Text>
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={handleClearHistory}
              testID="clear-history-button"
            >
              <Trash2 size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  ), [renderActiveFastSection, pastFasts.length, styles, handleClearHistory, colors]);

  const renderListFooter = useCallback(
    () => (
      <View
        style={[
          styles.bannerFooter,
          { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        <BannerAdComponent />
      </View>
    ),
    [colors.border, insets.bottom, styles],
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={pastFasts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 12 },
          pastFasts.length === 0 && !activeFast && styles.emptyListContent,
        ]}
        ListEmptyComponent={!activeFast ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        transparent
        animationType="fade"
        visible={showStartNewModal}
        onRequestClose={() => setShowStartNewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start a new fast?</Text>
            <Text style={styles.modalMessage}>
              This will end your current active fast and start a new one.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowStartNewModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={confirmStartNewFast}
              >
                <Text style={styles.modalConfirmText}>Start New</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof import('@/contexts/ThemeContext').useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  listContent: {
    padding: 20,
    gap: 12,
  },
  bannerFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginTop: 8,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 12,
  },
  activeFastSection: {
    marginBottom: 16,
  },
  activeFastCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  activeFastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  countdownContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    marginBottom: 16,
  },
  countdownLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  countdownValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  activeFastDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  },
  tapToViewText: {
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center' as const,
    marginTop: 12,
    marginBottom: 4,
  },
  activeFastActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelActionButton: {
    backgroundColor: colors.errorBackground,
  },
  shareActionButton: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  startNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startNewButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
  pastFastsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.errorBackground,
  },
  historyItem: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  fastingChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeBadgeMore: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
  },
  typeTextMore: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  arrow: {
    paddingHorizontal: 12,
  },
  arrowText: {
    fontSize: 20,
    color: colors.textMuted,
  },
  shareHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  shareHistoryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyStartButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
  });
