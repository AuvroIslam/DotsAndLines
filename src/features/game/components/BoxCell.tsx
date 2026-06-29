import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { theme } from '@/theme';

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
          backgroundColor: color + '33', // translucent fill
          borderColor: color,
        },
      ]}
    >
      {label ? (
        <Animated.View entering={FadeIn.delay(80)}>
          <Text style={[styles.label, { color }]}>{label}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '800', fontSize: 16 },
});

export const BoxCell = memo(BoxCellBase);
