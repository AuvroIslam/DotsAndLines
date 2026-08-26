import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { FrameDots } from './FrameDots';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, style }: CardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const flattened = StyleSheet.flatten(style);
  const frameColor =
    typeof flattened?.borderColor === 'string' ? flattened.borderColor : colors.border;
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        <FrameDots color={frameColor} />
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, style]}>
      <FrameDots color={frameColor} />
      {children}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      position: 'relative',
      borderRadius: 5,
      borderWidth: 2,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.24,
      shadowRadius: 0,
      elevation: 3,
    },
    pressed: { transform: [{ scale: 0.99 }] },
  });
