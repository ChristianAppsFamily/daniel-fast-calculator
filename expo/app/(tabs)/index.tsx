import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  InputAccessoryView,
  Animated,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Calendar, Timer, ChevronDown, BookOpen, Check, X, Share2 } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { playStartSound, playCompletionSound } from '@/utils/sounds';
import CircularProgress from '@/components/CircularProgress';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFasting } from '@/contexts/FastingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FAST_PRESETS, FASTING_TYPES, FastingType } from '@/types/fasting';
import { getDailyVerse } from '@/constants/bibleVerses';
import { BannerAdComponent } from '@/components/AdManager';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const INPUT_ACCESSORY_ID = 'durationInputAccessory';

export default function CalculatorScreen() {
  const insets = useSafeAreaInsets();
  const { settings, addFastingRecord, activeFast, cancelFast, setReminderForFast, cancelReminderForFast } = useFasting();
  const { colors } = useTheme();
  
  const [startTime, setStartTime] = useState(new Date());
  const [hours, setHours] = useState('16');
  const [minutes, setMinutes] = useState('0');
  const [selectedPreset, setSelectedPreset] = useState<string | null>('16h');
  const [calculatedEnd, setCalculatedEnd] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentFastId, setCurrentFastId] = useState<string | null>(null);
  const [reminderSet, setReminderSet] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [selectedFastingTypes, setSelectedFastingTypes] = useState<FastingType[]>(['Food']);
  const [customFastingTypes, setCustomFastingTypes] = useState<string[]>([]);
  const [customTypeInput, setCustomTypeInput] = useState('');
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [fastProgress, setFastProgress] = useState(0);
  const [fastCompleted, setFastCompleted] = useState(false);
  const completionGlow = useRef(new Animated.Value(0)).current;


  const styles = useMemo(() => createStyles(colors), [colors]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  }, [toastOpacity]);

  const formatTime = useCallback((date: Date) => {
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

  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }, []);

  const formatDateTime = useCallback((date: Date) => {
    return `${formatDate(date)} at ${formatTime(date)}`;
  }, [formatDate, formatTime]);

  const handlePresetSelect = useCallback((preset: typeof FAST_PRESETS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPreset(preset.label);
    setHours(preset.hours.toString());
    setMinutes(preset.minutes.toString());
    setCalculatedEnd(null);
    setIsActive(false);
    setCurrentFastId(null);
    setReminderSet(false);
  }, []);

  const handleHoursChange = useCallback((text: string) => {
    const num = text.replace(/[^0-9]/g, '');
    setHours(num);
    setSelectedPreset(null);
    setCalculatedEnd(null);
    setIsActive(false);
    setCurrentFastId(null);
    setReminderSet(false);
  }, []);

  const handleMinutesChange = useCallback((text: string) => {
    const num = text.replace(/[^0-9]/g, '');
    const clamped = Math.min(parseInt(num) || 0, 59).toString();
    setMinutes(num ? clamped : '');
    setSelectedPreset(null);
    setCalculatedEnd(null);
    setIsActive(false);
    setCurrentFastId(null);
    setReminderSet(false);
  }, []);

  const createNewFast = useCallback(async () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    
    if (h === 0 && m === 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid fasting duration.');
      return;
    }

    if (selectedFastingTypes.length === 0) {
      Alert.alert('Missing Type', 'Please select at least one fasting type.');
      return;
    }

    if (selectedFastingTypes.includes('Other') && customFastingTypes.length === 0) {
      Alert.alert('Missing Custom Type', 'Please add at least one custom fasting type.');
      return;
    }

    const endDate = new Date(startTime.getTime() + (h * 60 + m) * 60 * 1000);
    setCalculatedEnd(endDate);
    setIsActive(true);
    setFastCompleted(false);
    setFastProgress(0);

    // Play soft start sound and light haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playStartSound();

    const durationMinutes = h * 60 + m;
    const fastingFrom = selectedFastingTypes.includes('Other')
      ? [...selectedFastingTypes.filter(t => t !== 'Other'), ...customFastingTypes.map(ct => `Other: ${ct}`)]
      : [...selectedFastingTypes];
    
    const newRecord = addFastingRecord({
      startTime: startTime.toISOString(),
      durationMinutes,
      endTime: endDate.toISOString(),
      fastingFrom,
      customFastingTypes: selectedFastingTypes.includes('Other') ? customFastingTypes : undefined,
      status: 'active',
      reminderSet: false,
    });

    setCurrentFastId(newRecord.id);
    setReminderSet(false);
    showToast('Fast started!');
    console.log('Calculated fast end time:', endDate);
  }, [hours, minutes, startTime, addFastingRecord, selectedFastingTypes, customFastingTypes, showToast]);

  const calculateEndTime = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (activeFast && !currentFastId) {
      setShowReplaceModal(true);
      return;
    }

    createNewFast();
  }, [activeFast, currentFastId, createNewFast]);

  const confirmReplaceFast = useCallback(async () => {
    if (activeFast) {
      await cancelFast(activeFast.id);
    }
    setShowReplaceModal(false);
    createNewFast();
  }, [activeFast, cancelFast, createNewFast]);

  const updateTimeRemaining = useCallback(() => {
    if (!calculatedEnd) return;

    const now = new Date();
    const diff = calculatedEnd.getTime() - now.getTime();
    const totalDurationMs = calculatedEnd.getTime() - startTime.getTime();
    const elapsed = totalDurationMs - diff;
    const progress = Math.min(Math.max(elapsed / totalDurationMs, 0), 1);
    setFastProgress(progress);

    if (diff <= 0) {
      setTimeRemaining('Fast Complete!');
      setIsActive(false);
      setFastProgress(1);
      
      if (!fastCompleted) {
        setFastCompleted(true);
        // Play completion sound and haptic
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        playCompletionSound();
        
        // Trigger glow animation
        Animated.sequence([
          Animated.timing(completionGlow, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(completionGlow, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start();
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let remaining = '';
    if (days > 0) remaining += `${days}d `;
    if (hrs > 0 || days > 0) remaining += `${hrs}h `;
    remaining += `${mins}m`;

    setTimeRemaining(remaining.trim());
  }, [calculatedEnd, startTime, fastCompleted, completionGlow]);

  useEffect(() => {
    if (isActive && calculatedEnd) {
      updateTimeRemaining();
      intervalRef.current = setInterval(updateTimeRemaining, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, calculatedEnd, updateTimeRemaining]);

  // Sync with existing active fast on mount
  useEffect(() => {
    if (activeFast && !currentFastId) {
      const endDate = new Date(activeFast.endTime);
      const now = new Date();
      if (endDate > now) {
        setCalculatedEnd(endDate);
        setIsActive(true);
        setCurrentFastId(activeFast.id);
        setReminderSet(activeFast.reminderSet || false);

        
        // Restore fasting types
        const types = activeFast.fastingFrom || ['Food'];
        const standardTypes = types.filter(t => !t.startsWith('Other: ')) as FastingType[];
        const customTypes = types.filter(t => t.startsWith('Other: ')).map(t => t.replace('Other: ', ''));
        
        if (customTypes.length > 0 && !standardTypes.includes('Other')) {
          setSelectedFastingTypes([...standardTypes, 'Other']);
        } else {
          setSelectedFastingTypes(standardTypes.length > 0 ? standardTypes : ['Food']);
        }
        setCustomFastingTypes(customTypes);
        
        // Restore duration
        const durationMs = endDate.getTime() - new Date(activeFast.startTime).getTime();
        const totalMins = Math.round(durationMs / 60000);
        setHours(Math.floor(totalMins / 60).toString());
        setMinutes((totalMins % 60).toString());
        setStartTime(new Date(activeFast.startTime));
        
        console.log('Synced with existing active fast:', activeFast.id);
      }
    }
  }, [activeFast, currentFastId]);

  const handleReminderPress = useCallback(async () => {
    const fastId = currentFastId || activeFast?.id;
    if (!calculatedEnd || !fastId) {
      console.log('Cannot set reminder - no calculated end or fast ID');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (reminderSet) {
      Alert.alert(
        'Reminder already set',
        'Do you want to cancel it?',
        [
          { text: 'Keep', style: 'cancel' },
          { 
            text: 'Cancel Reminder', 
            style: 'destructive',
            onPress: async () => {
              await cancelReminderForFast(fastId);
              setReminderSet(false);
              showToast('Reminder cancelled');
            }
          },
        ]
      );
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please enable notifications to set reminders.');
      return;
    }

    const trigger = calculatedEnd.getTime() - Date.now();
    if (trigger <= 0) {
      Alert.alert('Invalid Time', 'The fast end time has already passed.');
      return;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Fast Complete! 🎉',
          body: 'Congratulations! Your fasting period has ended.',
          sound: settings.reminderSoundEnabled ? 'default' : undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.floor(trigger / 1000),
        },
      });

      setReminderForFast(fastId, notificationId);
      setReminderSet(true);
      showToast(`Reminder set for ${formatTime(calculatedEnd)}`);
      console.log('Reminder scheduled for:', calculatedEnd, 'Fast ID:', fastId);
    } catch (error) {
      console.error('Error scheduling notification:', error);
      Alert.alert('Error', 'Failed to set reminder. Please try again.');
    }
  }, [calculatedEnd, currentFastId, activeFast, reminderSet, settings.reminderSoundEnabled, setReminderForFast, cancelReminderForFast, formatTime, showToast]);

  const adjustStartTime = useCallback((offsetMinutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStartTime(prev => new Date(prev.getTime() + offsetMinutes * 60 * 1000));
    setCalculatedEnd(null);
    setIsActive(false);
    setCurrentFastId(null);
    setReminderSet(false);
  }, []);

  const resetToNow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStartTime(new Date());
    setCalculatedEnd(null);
    setIsActive(false);
    setCurrentFastId(null);
    setReminderSet(false);
  }, []);

  const openDateTimePicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempDate(startTime);
    if (Platform.OS === 'ios') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(true);
    }
  }, [startTime]);

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && selectedDate) {
        setTempDate(selectedDate);
        setShowTimePicker(true);
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  }, []);

  const handleTimeChange = useCallback((event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (event.type === 'set' && selectedDate) {
        setStartTime(selectedDate);
        setCalculatedEnd(null);
        setIsActive(false);
        setCurrentFastId(null);
        setReminderSet(false);
      }
    }
  }, []);

  const confirmDateTime = useCallback(() => {
    setStartTime(tempDate);
    setShowDatePicker(false);
    setCalculatedEnd(null);
    setIsActive(false);
    setCurrentFastId(null);
    setReminderSet(false);
  }, [tempDate]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const totalDuration = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

  const getFastingFromDisplay = useCallback(() => {
    const types = selectedFastingTypes.includes('Other')
      ? [...selectedFastingTypes.filter(t => t !== 'Other'), ...customFastingTypes]
      : [...selectedFastingTypes];
    return types;
  }, [selectedFastingTypes, customFastingTypes]);

  const toggleFastingType = useCallback((type: FastingType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFastingTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
    setCalculatedEnd(null);
    setIsActive(false);
    setCurrentFastId(null);
    setReminderSet(false);
  }, []);

  const addCustomType = useCallback(() => {
    const trimmed = customTypeInput.trim();
    if (trimmed && !customFastingTypes.includes(trimmed)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCustomFastingTypes(prev => [...prev, trimmed]);
      setCustomTypeInput('');
    }
  }, [customTypeInput, customFastingTypes]);

  const removeCustomType = useCallback((type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomFastingTypes(prev => prev.filter(t => t !== type));
  }, []);

  const dailyVerse = getDailyVerse();

  const handleShareFast = useCallback(async () => {
    if (!calculatedEnd) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const fastTypes = getFastingFromDisplay().join(', ');
    const durationText = `${parseInt(hours) || 0}h ${parseInt(minutes) || 0}m`;
    const statusText = fastCompleted ? '✅ Completed!' : `⏱️ ${timeRemaining} remaining`;
    
    const message = `🙏 My Fasting Journey\n\n` +
      `📋 Fasting from: ${fastTypes}\n` +
      `⏰ Duration: ${durationText}\n` +
      `🕐 Started: ${formatDateTime(startTime)}\n` +
      `🏁 Ends: ${formatDateTime(calculatedEnd)}\n` +
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
  }, [calculatedEnd, hours, minutes, fastCompleted, timeRemaining, getFastingFromDisplay, formatDateTime, startTime]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.verseCard}>
            <View style={styles.verseHeader}>
              <BookOpen size={20} color={colors.primary} />
              <Text style={styles.verseHeaderText}>Today&apos;s Verse</Text>
            </View>
            <Text style={styles.verseText}>{dailyVerse.text}</Text>
            <Text style={styles.verseReference}>{dailyVerse.reference}</Text>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Start Time</Text>
            </View>
            <TouchableOpacity style={styles.timeCard} onPress={openDateTimePicker} activeOpacity={0.7}>
              <Text style={styles.timeDisplay}>{formatTime(startTime)}</Text>
              <Text style={styles.dateDisplay}>{formatDate(startTime)}</Text>
              <Text style={styles.tapToEdit}>Tap to edit date & time</Text>
            </TouchableOpacity>
            <View style={styles.timeAdjustRow}>
              <TouchableOpacity 
                style={styles.adjustButton} 
                onPress={() => adjustStartTime(-30)}
                testID="adjust-minus-30"
              >
                <Text style={styles.adjustButtonText}>-30m</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.adjustButton} 
                onPress={() => adjustStartTime(-60)}
                testID="adjust-minus-60"
              >
                <Text style={styles.adjustButtonText}>-1h</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.nowButton} 
                onPress={resetToNow}
                testID="reset-now"
              >
                <Text style={styles.nowButtonText}>Now</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.adjustButton} 
                onPress={() => adjustStartTime(60)}
                testID="adjust-plus-60"
              >
                <Text style={styles.adjustButtonText}>+1h</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.adjustButton} 
                onPress={() => adjustStartTime(30)}
                testID="adjust-plus-30"
              >
                <Text style={styles.adjustButtonText}>+30m</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <ChevronDown size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Fasting From</Text>
              <Text style={styles.multiSelectHint}>(select multiple)</Text>
            </View>
            <View style={styles.fastingTypeContainer}>
              {FASTING_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.fastingTypeButton,
                    selectedFastingTypes.includes(type) && styles.fastingTypeButtonActive,
                  ]}
                  onPress={() => toggleFastingType(type)}
                  testID={`fasting-type-${type}`}
                >
                  {selectedFastingTypes.includes(type) && (
                    <Check size={14} color={colors.primary} style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.fastingTypeText,
                      selectedFastingTypes.includes(type) && styles.fastingTypeTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedFastingTypes.includes('Other') && (
              <View style={styles.customTypeContainer}>
                {customFastingTypes.length > 0 && (
                  <View style={styles.customChipsContainer}>
                    {customFastingTypes.map((type) => (
                      <View key={type} style={styles.customChip}>
                        <Text style={styles.customChipText}>{type}</Text>
                        <TouchableOpacity onPress={() => removeCustomType(type)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <X size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.customInputRow}>
                  <TextInput
                    style={styles.customTypeInput}
                    placeholder="Add custom type..."
                    placeholderTextColor={colors.disabled}
                    value={customTypeInput}
                    onChangeText={setCustomTypeInput}
                    maxLength={30}
                    onSubmitEditing={addCustomType}
                    returnKeyType="done"
                    testID="custom-type-input"
                  />
                  <TouchableOpacity 
                    style={[styles.addCustomButton, !customTypeInput.trim() && styles.addCustomButtonDisabled]}
                    onPress={addCustomType}
                    disabled={!customTypeInput.trim()}
                  >
                    <Text style={styles.addCustomButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Timer size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Duration</Text>
            </View>
            <View style={styles.presetGrid}>
              {FAST_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.presetButton,
                    selectedPreset === preset.label && styles.presetButtonActive,
                  ]}
                  onPress={() => handlePresetSelect(preset)}
                  testID={`preset-${preset.label}`}
                >
                  <Text
                    style={[
                      styles.presetButtonText,
                      selectedPreset === preset.label && styles.presetButtonTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.customDuration}>
              <View style={styles.durationInputGroup}>
                <TextInput
                  style={styles.durationInput}
                  value={hours}
                  onChangeText={handleHoursChange}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="0"
                  placeholderTextColor={colors.disabled}
                  testID="hours-input"
                  inputAccessoryViewID={Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined}
                />
                <Text style={styles.durationLabel}>hours</Text>
              </View>
              <View style={styles.durationInputGroup}>
                <TextInput
                  style={styles.durationInput}
                  value={minutes}
                  onChangeText={handleMinutesChange}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="0"
                  placeholderTextColor={colors.disabled}
                  testID="minutes-input"
                  inputAccessoryViewID={Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined}
                />
                <Text style={styles.durationLabel}>min</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.calculateButton, totalDuration === 0 && styles.calculateButtonDisabled]}
            onPress={calculateEndTime}
            disabled={totalDuration === 0}
            testID="calculate-button"
          >
            <Text style={styles.calculateButtonText}>
              {activeFast && !currentFastId ? 'Start New Fast' : 'Calculate End Time'}
            </Text>
          </TouchableOpacity>

          {calculatedEnd && (
            <Animated.View style={[
              styles.resultsCard,
              {
                shadowOpacity: completionGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
                }),
                shadowRadius: completionGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20],
                }),
                shadowColor: colors.success,
              },
            ]}>
              <View style={styles.resultRowVertical}>
                <Text style={styles.resultLabel}>Fasting From</Text>
                <View style={styles.resultChipsContainer}>
                  {getFastingFromDisplay().map((type, index) => (
                    <View key={index} style={styles.resultChip}>
                      <Text style={styles.resultChipText}>{type}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>End Time</Text>
                <Text style={styles.resultValue}>{formatDateTime(calculatedEnd)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.progressSection}>
                <CircularProgress
                  progress={fastProgress}
                  size={160}
                  strokeWidth={10}
                  timeRemaining={timeRemaining || undefined}
                />
                {fastCompleted && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedText}>Fast completed</Text>
                  </View>
                )}
              </View>
              <View style={styles.divider} />
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Total Duration</Text>
                <Text style={styles.resultValue}>
                  {parseInt(hours) || 0}h {parseInt(minutes) || 0}m
                </Text>
              </View>
              
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShareFast}
                  testID="share-button"
                >
                  <Share2 size={20} color={colors.primary} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
                
                {!reminderSet ? (
                  <TouchableOpacity
                    style={styles.reminderButtonFlex}
                    onPress={handleReminderPress}
                    testID="reminder-button"
                  >
                    <Bell size={20} color={colors.white} />
                    <Text style={styles.reminderButtonText}>Set Reminder</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.reminderSetContainerFlex}>
                    <View style={styles.reminderActiveIndicator}>
                      <Check size={16} color={colors.success} />
                      <Text style={styles.reminderActiveText}>
                        Reminder set for {formatTime(calculatedEnd)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cancelReminderButtonSmall}
                      onPress={handleReminderPress}
                      testID="cancel-reminder-button"
                    >
                      <Bell size={16} color={colors.primary} />
                      <Text style={styles.cancelReminderButtonTextSmall}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Animated.View>
          )}
          
        </ScrollView>
      </TouchableWithoutFeedback>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          <View style={styles.inputAccessory}>
            <TouchableOpacity onPress={dismissKeyboard} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      {Platform.OS === 'ios' && showDatePicker && (
        <Modal
          transparent
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerHeader}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.pickerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.pickerTitle}>Select Date & Time</Text>
                    <TouchableOpacity onPress={confirmDateTime}>
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={tempDate}
                    mode="datetime"
                    display="spinner"
                    onChange={(_event: unknown, date?: Date) => {
                      if (date) setTempDate(date);
                    }}
                    style={styles.picker}
                    textColor={colors.text}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      <Modal
        transparent
        animationType="fade"
        visible={showReplaceModal}
        onRequestClose={() => setShowReplaceModal(false)}
      >
        <View style={styles.replaceModalOverlay}>
          <View style={styles.replaceModalContent}>
            <Text style={styles.replaceModalTitle}>Start a new fast?</Text>
            <Text style={styles.replaceModalMessage}>
              This will end your current active fast and start a new one.
            </Text>
            <View style={styles.replaceModalButtons}>
              <TouchableOpacity 
                style={styles.replaceModalCancelButton}
                onPress={() => setShowReplaceModal(false)}
              >
                <Text style={styles.replaceModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.replaceModalConfirmButton}
                onPress={confirmReplaceFast}
              >
                <Text style={styles.replaceModalConfirmText}>Start New</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Check size={18} color={colors.white} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>

      <View
        style={[
          styles.calculatorBannerFooter,
          { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 6) },
        ]}
      >
        <BannerAdComponent />
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof import('@/contexts/ThemeContext').useTheme>['colors']) => StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  calculatorBannerFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 6,
  },
  content: {
    padding: 20,
  },
  sectionCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.4,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  timeCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  timeDisplay: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: -1,
  },
  dateDisplay: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tapToEdit: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 8,
  },
  timeAdjustRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  adjustButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
  },
  adjustButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  nowButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
  },
  nowButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  fastingTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fastingTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fastingTypeButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  fastingTypeText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  fastingTypeTextActive: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
  customTypeContainer: {
    marginTop: 12,
  },
  customTypeInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  presetButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  presetButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  presetButtonTextActive: {
    color: colors.primary,
  },
  customDuration: {
    flexDirection: 'row',
    gap: 16,
  },
  durationInputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  durationInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600' as const,
    color: colors.text,
    paddingVertical: Platform.OS === 'web' ? 12 : 8,
  },
  durationLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  calculateButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  calculateButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  calculateButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.white,
  },
  resultsCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 24,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  countdownValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  reminderButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
  reminderSetContainer: {
    marginTop: 16,
    gap: 12,
  },
  reminderActiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reminderActiveText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.success,
  },
  cancelReminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 180,
  },
  cancelReminderButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flex: 1,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  reminderButtonFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flex: 1,
  },
  reminderSetContainerFlex: {
    flex: 1,
    gap: 8,
  },
  cancelReminderButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelReminderButtonTextSmall: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  inputAccessory: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  pickerCancelText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  picker: {
    height: 200,
  },
  verseCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  verseHeaderText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  verseText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    fontStyle: 'italic' as const,
    marginBottom: 10,
  },
  verseReference: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  replaceModalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  replaceModalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  replaceModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  replaceModalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  replaceModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  replaceModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  replaceModalCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  replaceModalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  replaceModalConfirmText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.white,
  },
  multiSelectHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 4,
  },
  fastingTypeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  customChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.primary,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addCustomButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCustomButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  addCustomButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
  },
  resultRowVertical: {
    paddingVertical: 8,
  },
  resultChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  resultChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  resultChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.primary,
  },
  progressSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  completedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
