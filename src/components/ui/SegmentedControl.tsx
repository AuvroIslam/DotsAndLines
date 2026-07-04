import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { Typography } from './Typography';

interface SegmentedControlProps<T extends string | number> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.active]}
          >
            <Typography variant="body" color={active ? colors.text : colors.textMuted}>
              {opt.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.xs,
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: radius.sm,
    },
    active: { backgroundColor: colors.primary },
  });
