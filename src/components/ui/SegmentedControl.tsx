import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

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
            <Typography variant="body" color={active ? theme.colors.text : theme.colors.textMuted}>
              {opt.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.radius.sm,
  },
  active: { backgroundColor: theme.colors.primary },
});
