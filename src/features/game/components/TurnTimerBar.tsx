import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useThemeColors, type AppColors } from '@/theme/useTheme';

interface TurnTimerBarProps {
  fraction: number; // 1 → full time remaining, 0 → expired
  color: string;
}

/** A shrinking progress bar visualizing the current turn's remaining time. */
export function TurnTimerBar({ fraction, color }: TurnTimerBarProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const width = useSharedValue(fraction);

  useEffect(() => {
    width.value = withTiming(fraction, { duration: 250 });
  }, [fraction, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  const danger = fraction < 0.25;

  return (
    <View style={styles.track}>
      <Animated.View
        style={[styles.fill, { backgroundColor: danger ? colors.danger : color }, style]}
      />
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 3 },
  });
