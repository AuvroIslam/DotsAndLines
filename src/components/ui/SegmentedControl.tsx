import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { Typography } from './Typography';
import { FrameDots } from './FrameDots';

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
            <FrameDots color={active ? colors.primary : colors.surfaceAlt} size={8} />
            <Typography
              variant="body"
              center
              color={active ? colors.ink : colors.text}
              style={styles.label}
            >
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
      gap: spacing.md,
    },
    segment: {
      flex: 1,
      position: 'relative',
      minHeight: 44,
      paddingVertical: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 3,
      borderWidth: 2,
      borderColor: colors.surfaceAlt,
      backgroundColor: colors.surfaceAlt,
    },
    label: { flexShrink: 1, width: '100%' },
    active: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });
