import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors, type AppColors } from '@/theme/useTheme';

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);

  return (
    <View accessibilityLabel="Dots and Boxes" style={styles.wrap}>
      <View style={styles.wordRow}>
        <Text style={[styles.letter, { color: colors.warning }]}>DOTS</Text>
        <View style={styles.spark}>
          <View style={[styles.sparkLine, { backgroundColor: colors.primary }]} />
          <View style={[styles.sparkDot, styles.sparkStart, { backgroundColor: colors.primary }]} />
          <View style={[styles.sparkDot, styles.sparkEnd, { backgroundColor: colors.accent }]} />
        </View>
      </View>
      <View style={styles.wordRow}>
        <Text style={[styles.ampersand, { color: colors.accent }]}>&</Text>
        <Text style={[styles.letter, { color: colors.purple }]}>BOXES</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors, compact: boolean) => {
  const fontSize = compact ? 27 : 48;
  const lineHeight = compact ? 29 : 48;
  return StyleSheet.create({
    wrap: { alignItems: 'center' },
    wordRow: { flexDirection: 'row', alignItems: 'center', height: lineHeight },
    letter: {
      fontFamily: 'Fredoka_700Bold',
      fontSize,
      lineHeight,
      letterSpacing: compact ? 1 : 2,
      textShadowColor: colors.shadow,
      textShadowOffset: { width: 0, height: compact ? 2 : 3 },
      textShadowRadius: 0,
    },
    ampersand: {
      fontFamily: 'Fredoka_600SemiBold',
      fontSize: compact ? 18 : 28,
      lineHeight,
      marginRight: compact ? 5 : 8,
      transform: [{ rotate: '-8deg' }],
    },
    spark: { width: compact ? 22 : 34, height: lineHeight, marginLeft: compact ? 5 : 8 },
    sparkLine: {
      position: 'absolute',
      width: compact ? 22 : 34,
      height: compact ? 5 : 7,
      top: compact ? 12 : 20,
      borderRadius: 8,
      transform: [{ rotate: '-12deg' }],
      borderWidth: 1.5,
      borderColor: colors.ink,
    },
    sparkDot: {
      position: 'absolute',
      width: compact ? 9 : 13,
      height: compact ? 9 : 13,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.ink,
    },
    sparkStart: { left: -2, top: compact ? 13 : 21 },
    sparkEnd: { right: -2, top: compact ? 6 : 11 },
  });
};
