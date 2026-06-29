import { memo, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { theme } from '@/theme';

interface LineSegmentProps {
  x: number;
  y: number;
  length: number;
  thickness: number;
  horizontal: boolean;
  drawn: boolean;
  pending: boolean;
  color: string;
  interactive: boolean;
  onPress: () => void;
}

/**
 * A single edge. When undrawn and it's the player's turn it shows a faint, tappable
 * hint; once drawn it animates the stroke growing from its origin in the owner's
 * color. Pure presentation — it never decides legality.
 */
function LineSegmentBase({
  x,
  y,
  length,
  thickness,
  horizontal,
  drawn,
  pending,
  color,
  interactive,
  onPress,
}: LineSegmentProps) {
  const progress = useSharedValue(drawn ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(drawn ? 1 : 0, { duration: 180 });
  }, [drawn, progress]);

  const fillStyle = useAnimatedStyle(() => {
    const grow = progress.value;
    return horizontal
      ? { width: length * grow, opacity: pending ? 0.7 : 1 }
      : { height: length * grow, opacity: pending ? 0.7 : 1 };
  });

  // Expand the touch target around the thin line for comfortable tapping.
  const hitSlop = thickness * 1.5;
  const containerStyle = horizontal
    ? { left: x, top: y - thickness / 2, width: length, height: thickness }
    : { left: x - thickness / 2, top: y, width: thickness, height: length };

  return (
    <Pressable
      onPress={interactive && !drawn ? onPress : undefined}
      disabled={!interactive || drawn}
      hitSlop={hitSlop}
      style={[styles.container, containerStyle]}
    >
      {!drawn && interactive ? (
        <Animated.View
          style={[styles.fill, styles.crossFull, styles.hint, { borderRadius: thickness / 2 }]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.fill,
          horizontal ? styles.crossFullHeight : styles.crossFullWidth,
          { backgroundColor: color, borderRadius: thickness / 2 },
          fillStyle,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute' },
  fill: { position: 'absolute', left: 0, top: 0 },
  crossFull: { width: '100%', height: '100%' },
  crossFullHeight: { height: '100%' },
  crossFullWidth: { width: '100%' },
  hint: { backgroundColor: theme.colors.dotIdle, opacity: 0.4 },
});

export const LineSegment = memo(LineSegmentBase);
