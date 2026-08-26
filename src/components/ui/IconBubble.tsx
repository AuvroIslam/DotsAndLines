import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, type ComponentProps } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { FrameDots } from './FrameDots';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconBubbleProps {
  name: IconName;
  color?: string;
  size?: number;
  style?: ViewStyle;
}

export function IconBubble({ name, color, size = 44, style }: IconBubbleProps) {
  const colors = useThemeColors();
  const accent = color ?? colors.primary;
  const styles = useMemo(() => createStyles(colors, accent, size), [accent, colors, size]);
  return (
    <View style={[styles.bubble, style]}>
      <FrameDots color={colors.surfaceAlt} size={7} />
      <Ionicons name={name} size={size * 0.46} color={accent} />
    </View>
  );
}

const createStyles = (colors: AppColors, accent: string, size: number) =>
  StyleSheet.create({
    bubble: {
      width: size,
      height: size,
      position: 'relative',
      borderRadius: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 2,
      borderColor: colors.surfaceAlt,
    },
  });
