import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useFasting } from '@/contexts/FastingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FastingRecord } from '@/types/fasting';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface DayFasts {
  date: string;
  fasts: FastingRecord[];
}

export default function CalendarScreen() {
  const { history, settings } = useFasting();
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayFasts | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const fastsByDate = useMemo(() => {
    const map: Record<string, FastingRecord[]> = {};
    history.forEach((record) => {
      const date = new Date(record.startTime);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(record);
    });
    return map;
  }, [history]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const days: (number | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    const remainingSlots = 7 - (days.length % 7);
    if (remainingSlots < 7) {
      for (let i = 0; i < remainingSlots; i++) {
        days.push(null);
      }
    }

    return days;
  }, [currentMonth, currentYear]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  }, [currentYear, currentMonth]);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  }, [currentYear, currentMonth]);

  const getDateKey = useCallback((day: number) => {
    return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }, [currentYear, currentMonth]);

  const handleDayPress = useCallback((day: number) => {
    const dateKey = getDateKey(day);
    const fasts = fastsByDate[dateKey];
    if (fasts && fasts.length > 0) {
      setSelectedDay({ date: dateKey, fasts });
      setModalVisible(true);
    }
  }, [fastsByDate, getDateKey]);

  const formatTime = useCallback((isoString: string) => {
    const date = new Date(isoString);
    if (settings.use24HourFormat) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [settings.use24HourFormat]);

  const formatDuration = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  }, []);

  const formatFullDate = useCallback((dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, []);

  const getFastingTypeLabel = useCallback((record: FastingRecord) => {
    if (record.fastingType === 'Other' && record.customFastingType) {
      return record.customFastingType;
    }
    return record.fastingType;
  }, []);

  const isToday = useCallback((day: number) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === currentMonth && 
           today.getFullYear() === currentYear;
  }, [currentMonth, currentYear]);

  const isFastActive = useCallback((fast: FastingRecord) => {
    const endTime = new Date(fast.endTime).getTime();
    const now = Date.now();
    return endTime > now;
  }, []);

  const getFastStatus = useCallback((fasts: FastingRecord[]) => {
    const hasActive = fasts.some(fast => isFastActive(fast));
    const hasCompleted = fasts.some(fast => !isFastActive(fast));
    return { hasActive, hasCompleted };
  }, [isFastActive]);

  const renderDay = useCallback((day: number | null, index: number) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const dateKey = getDateKey(day);
    const fasts = fastsByDate[dateKey];
    const hasFasts = fasts && fasts.length > 0;
    const todayStyle = isToday(day);
    const fastStatus = hasFasts ? getFastStatus(fasts) : { hasActive: false, hasCompleted: false };

    let label = '';
    if (hasFasts) {
      if (fasts.length === 1) {
        label = formatDuration(fasts[0].durationMinutes);
      } else {
        label = `${fasts.length} fasts`;
      }
    }

    const dotColor = fastStatus.hasActive ? '#4CAF50' : colors.primary;
    const labelColor = fastStatus.hasActive ? '#4CAF50' : colors.primary;

    return (
      <TouchableOpacity
        key={`day-${day}`}
        style={[styles.dayCell, todayStyle && styles.todayCell]}
        onPress={() => handleDayPress(day)}
        disabled={!hasFasts}
        activeOpacity={hasFasts ? 0.7 : 1}
        testID={`calendar-day-${day}`}
      >
        <Text style={[styles.dayNumber, todayStyle && styles.todayText]}>
          {day}
        </Text>
        {hasFasts && (
          <View style={styles.fastIndicator}>
            <View style={[styles.fastDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.fastLabel, { color: labelColor }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [getDateKey, fastsByDate, isToday, formatDuration, handleDayPress, styles, getFastStatus, colors.primary]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goToPreviousMonth}
          style={styles.navButton}
          testID="prev-month-button"
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTHS[currentMonth]} {currentYear}
        </Text>
        <TouchableOpacity
          onPress={goToNextMonth}
          style={styles.navButton}
          testID="next-month-button"
        >
          <ChevronRight size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdaysRow}>
        {WEEKDAYS.map((day) => (
          <View key={day} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => renderDay(day, index))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendDotActive} />
          <Text style={styles.legendText}>Active fast</Text>
        </View>
        <View style={[styles.legendItem, { marginLeft: 20 }]}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Completed fast</Text>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedDay ? formatFullDate(selectedDay.date) : ''}
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
              testID="close-modal-button"
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedDay?.fasts.map((fast) => (
              <View key={fast.id} style={styles.fastCard}>
                <View style={styles.fastCardHeader}>
                  <Text style={styles.fastType}>{getFastingTypeLabel(fast)}</Text>
                  <Text style={styles.fastDuration}>{formatDuration(fast.durationMinutes)}</Text>
                </View>
                <View style={styles.fastDetails}>
                  <View style={styles.fastDetailRow}>
                    <Text style={styles.fastDetailLabel}>Start</Text>
                    <Text style={styles.fastDetailValue}>{formatTime(fast.startTime)}</Text>
                  </View>
                  <View style={styles.fastDetailRow}>
                    <Text style={styles.fastDetailLabel}>End</Text>
                    <Text style={styles.fastDetailValue}>{formatTime(fast.endTime)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  weekdaysRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
  },
  todayCell: {
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  dayNumber: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500' as const,
  },
  todayText: {
    color: colors.primary,
    fontWeight: '700' as const,
  },
  fastIndicator: {
    alignItems: 'center',
    marginTop: 2,
  },
  fastDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  fastLabel: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: '600' as const,
    marginTop: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 'auto',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  legendDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  legendText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  fastCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  fastCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fastType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  fastDuration: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  fastDetails: {
    gap: 8,
  },
  fastDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fastDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  fastDetailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500' as const,
  },
});
