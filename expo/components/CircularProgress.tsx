import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  timeRemaining?: string;
}

const getProgressColor = (progress: number, isDark: boolean): string => {
  if (progress >= 0.75) {
    return isDark ? '#34D399' : '#10B981';
  }
  if (progress >= 0.5) {
    return isDark ? '#60A5FA' : '#3B82F6';
  }
  if (progress >= 0.25) {
    return isDark ? '#FBBF24' : '#F59E0B';
  }
  return isDark ? '#FF8C2A' : '#F5760C';
};

export default function CircularProgress({
  progress,
  size = 180,
  strokeWidth = 12,
  showPercentage = true,
  timeRemaining,
}: CircularProgressProps) {
  const { colors, isDark } = useTheme();
  const animatedProgress = useRef(new Animated.Value(0)).current;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedProgress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const progressColor = useMemo(() => getProgressColor(progress, isDark), [progress, isDark]);
  const percentageValue = Math.round(progress * 100);

  const styles = useMemo(() => createStyles(colors, size), [colors, size]);

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          stroke={colors.border}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        <AnimatedCircle
          stroke={progressColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.centerContent}>
        {showPercentage && (
          <Text style={[styles.percentage, { color: progressColor }]}>
            {percentageValue}%
          </Text>
        )}
        {timeRemaining && (
          <Text style={styles.timeRemaining}>{timeRemaining}</Text>
        )}
      </View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const createStyles = (colors: ReturnType<typeof import('@/contexts/ThemeContext').useTheme>['colors'], size: number) =>
  StyleSheet.create({
    container: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
    svg: {
      position: 'absolute',
    },
    centerContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    percentage: {
      fontSize: 36,
      fontWeight: '700' as const,
    },
    timeRemaining: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });
