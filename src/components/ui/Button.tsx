import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { theme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const VARIANT_BG: Record<Variant, string> = {
  primary: theme.colors.primary,
  secondary: theme.colors.surfaceAlt,
  danger: theme.colors.danger,
  ghost: 'transparent',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: VARIANT_BG[variant] },
        variant === 'ghost' && styles.ghost,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  ghost: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
  label: { ...theme.typography.h3, color: theme.colors.text },
  ghostLabel: { color: theme.colors.textMuted },
});
