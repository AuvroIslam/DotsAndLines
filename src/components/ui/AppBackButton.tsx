import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { spacing, typography } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { FrameDots } from './FrameDots';

interface AppBackButtonProps {
  onPress: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function AppBackButton({ onPress, label = 'Back', style }: AppBackButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <FrameDots color={colors.surfaceAlt} size={8} />
      <Ionicons name="arrow-back" size={18} color={colors.primary} />
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    button: {
      minWidth: 76,
      height: 40,
      position: 'relative',
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 3,
      borderWidth: 2,
      borderColor: colors.surfaceAlt,
      backgroundColor: colors.surfaceAlt,
    },
    pressed: { transform: [{ scale: 0.98 }] },
    label: {
      ...typography.caption,
      textAlign: 'center',
      includeFontPadding: false,
    },
  });
