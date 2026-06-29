import { Image, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

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

export function Avatar({ name, uri, size = 44, color = theme.colors.primary }: AvatarProps) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[dim, styles.image]} />;
  }
  return (
    <View style={[dim, styles.fallback, { backgroundColor: color }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: theme.colors.surfaceAlt },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { color: theme.colors.text, fontWeight: '700' },
});
