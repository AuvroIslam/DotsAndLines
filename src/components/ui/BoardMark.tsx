import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/theme/useTheme';

interface BoardMarkProps {
  size?: number;
  color?: string;
}

/** A code-native dots-and-lines mark; intentionally not an emoji or stock sticker. */
export function BoardMark({ size = 58, color }: BoardMarkProps) {
  const colors = useThemeColors();
  const accent = color ?? colors.primary;
  const geometry = useMemo(() => {
    const dot = Math.max(8, Math.round(size * 0.18));
    const stroke = Math.max(3, Math.round(size * 0.055));
    const inset = dot / 2;
    return { dot, stroke, inset, span: size - dot };
  }, [size]);

  const dotStyle = {
    width: geometry.dot,
    height: geometry.dot,
    borderRadius: geometry.dot / 2,
    backgroundColor: colors.bg,
    borderColor: accent,
  };

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <View
        style={[
          styles.line,
          {
            left: geometry.inset,
            top: geometry.inset - geometry.stroke / 2,
            width: geometry.span,
            height: geometry.stroke,
            backgroundColor: accent,
          },
        ]}
      />
      <View
        style={[
          styles.line,
          {
            left: size - geometry.inset - geometry.stroke / 2,
            top: geometry.inset,
            width: geometry.stroke,
            height: geometry.span,
            backgroundColor: accent,
          },
        ]}
      />
      <View
        style={[
          styles.line,
          {
            left: geometry.inset,
            top: size - geometry.inset - geometry.stroke / 2,
            width: geometry.span,
            height: geometry.stroke,
            backgroundColor: colors.warning,
          },
        ]}
      />
      <View style={[styles.dot, dotStyle, { left: 0, top: 0 }]} />
      <View style={[styles.dot, dotStyle, { right: 0, top: 0 }]} />
      <View style={[styles.dot, dotStyle, { left: 0, bottom: 0, borderColor: colors.warning }]} />
      <View style={[styles.dot, dotStyle, { right: 0, bottom: 0, borderColor: colors.warning }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', borderRadius: 99 },
  dot: { position: 'absolute', borderWidth: 2 },
});
