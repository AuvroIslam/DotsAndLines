import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useThemeColors, type AppColors } from '@/theme/useTheme';

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  color?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? parts[parts.length - 1]![0] : '';
  return (first + second).toUpperCase();
}

export function Avatar({ name, uri, size = 44, color }: AvatarProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[dim, styles.image]} />;
  }
  return (
    <View style={[dim, styles.fallback, { backgroundColor: color ?? colors.primary }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    image: { backgroundColor: colors.surfaceAlt },
    fallback: { alignItems: 'center', justifyContent: 'center' },
    text: { color: colors.text, fontWeight: '700' },
  });
