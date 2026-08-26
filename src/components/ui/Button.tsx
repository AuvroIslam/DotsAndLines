import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { spacing, typography } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import type { IconName } from './IconBubble';
import { FrameDots } from './FrameDots';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  icon?: IconName;
  accessibilityLabel?: string;
  /** Overrides the solid fill, matching border, and four corner nodes. */
  frameColor?: string;
  foregroundColor?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
  icon,
  accessibilityLabel,
  frameColor,
  foregroundColor,
}: ButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const variantFill: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    danger: colors.danger,
    ghost: colors.surface,
  };
  const isDisabled = disabled || loading;
  const fill = frameColor ?? variantFill[variant];
  const foreground =
    foregroundColor ?? (variant === 'primary' || variant === 'danger' ? colors.ink : colors.text);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: fill, borderColor: fill },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <FrameDots color={fill} />
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={foreground} /> : null}
          {label ? <Text style={[styles.label, { color: foreground }]}>{label}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    base: {
      minHeight: 54,
      position: 'relative',
      flexDirection: 'row',
      gap: spacing.sm,
      borderRadius: 3,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      borderWidth: 2,
    },
    pressed: { transform: [{ scale: 0.985 }] },
    disabled: { opacity: 1 },
    label: {
      ...typography.h3,
      flexShrink: 1,
      textAlign: 'center',
      includeFontPadding: false,
    },
  });
