import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import type { IconName } from './IconBubble';
import { FrameDots } from './FrameDots';
import { Typography } from './Typography';

interface MenuCardProps {
  title: string;
  subtitle: string;
  icon: IconName;
  accent?: string;
  onPress: () => void;
  compact?: boolean;
  badge?: number;
  style?: ViewStyle;
}

export function MenuCard({
  title,
  subtitle,
  icon,
  accent,
  onPress,
  compact = false,
  badge = 0,
  style,
}: MenuCardProps) {
  const colors = useThemeColors();
  const tint = accent ?? colors.primary;
  const styles = useMemo(() => createStyles(colors, tint, compact), [colors, tint, compact]);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      <FrameDots color={tint} />
      <View style={styles.content}>
        <Ionicons name={icon} color={colors.ink} size={compact ? 24 : 28} />
        <View style={styles.copy}>
          <Typography variant={compact ? 'body' : 'h3'} color={colors.ink} center>
            {title}
          </Typography>
          <Typography
            variant="caption"
            color={colors.ink}
            center
            numberOfLines={compact ? 1 : 2}
            style={styles.subtitle}
          >
            {subtitle}
          </Typography>
        </View>
      </View>
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Typography variant="caption" color="#FFFFFF" style={styles.badgeText}>
            {badge > 9 ? '9+' : badge}
          </Typography>
        </View>
      ) : null}
    </Pressable>
  );
}

const createStyles = (colors: AppColors, accent: string, compact: boolean) =>
  StyleSheet.create({
    card: {
      minHeight: compact ? 110 : 122,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      padding: compact ? spacing.md : spacing.lg,
      borderRadius: 3,
      backgroundColor: accent,
      borderWidth: 2,
      borderColor: accent,
    },
    pressed: { transform: [{ scale: 0.985 }] },
    content: { maxWidth: '100%', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    copy: { maxWidth: '100%', alignItems: 'center', gap: 1 },
    subtitle: { opacity: 0.72 },
    badge: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      minWidth: 26,
      height: 26,
      paddingHorizontal: spacing.xs,
      borderRadius: 3,
      borderWidth: 2,
      borderColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { lineHeight: 16 },
  });
