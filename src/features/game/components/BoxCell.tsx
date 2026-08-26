import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { useThemeColors } from '@/theme/useTheme';

interface BoxCellProps {
  x: number;
  y: number;
  size: number;
  owner: string | null;
  color: string | null;
  label: string | null;
}

/**
 * The fill that appears when a box is completed. Animates in with a zoom/fade
 * pop in the owning player's color. Renders nothing until the box is claimed.
 */
function BoxCellBase({ x, y, size, owner, color, label }: BoxCellProps) {
  const colors = useThemeColors();
  if (!owner || !color) return null;
  return (
    <Animated.View
      entering={ZoomIn.duration(220)}
      style={[
        styles.box,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          backgroundColor: color + '45', // translucent fill
          borderColor: color,
        },
      ]}
    >
      {label ? (
        <Animated.View entering={FadeIn.delay(80)}>
          <View style={[styles.labelBadge, { backgroundColor: colors.ink }]}>
            <Text style={[styles.label, { color: colors.paper }]}>{label}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3 },
  label: { fontFamily: 'Fredoka_700Bold', fontSize: 14 },
});

export const BoxCell = memo(BoxCellBase);
