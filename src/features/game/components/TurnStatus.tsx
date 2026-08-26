import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { FrameDots, Typography } from '@/components/ui';
import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { TurnTimerBar } from './TurnTimerBar';

interface TurnStatusProps {
  label: string;
  fraction: number;
  color: string;
  finished?: boolean;
}

/** A compact game-status HUD that keeps the turn label and clock in one visual unit. */
export function TurnStatus({ label, fraction, color, finished = false }: TurnStatusProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.shell}>
      <View style={[styles.panel, { borderColor: color }]}>
        <FrameDots color={color} size={9} />
        <View style={styles.eyebrowRow}>
          <View style={[styles.node, { backgroundColor: color }]} />
          <Typography variant="caption" color={colors.textMuted} center style={styles.eyebrow}>
            {finished ? 'MATCH STATUS' : 'CURRENT TURN'}
          </Typography>
          <View style={[styles.node, { backgroundColor: color }]} />
        </View>
        <Typography variant="h3" color={color} center numberOfLines={2} style={styles.label}>
          {label}
        </Typography>
        <TurnTimerBar fraction={finished ? 0 : fraction} color={color} />
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    shell: { width: '100%', maxWidth: 380, alignSelf: 'center', paddingHorizontal: spacing.md },
    panel: {
      width: '100%',
      minHeight: 92,
      position: 'relative',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      borderRadius: 4,
      borderWidth: 2,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 0,
      elevation: 2,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    eyebrow: { letterSpacing: 1.4, includeFontPadding: false },
    node: { width: 7, height: 7, borderRadius: 4 },
    label: { width: '100%', includeFontPadding: false },
  });
