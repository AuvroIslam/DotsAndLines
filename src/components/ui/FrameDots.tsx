import { StyleSheet, View } from 'react-native';

interface FrameDotsProps {
  color: string;
  size?: number;
}

/** Four game-board nodes that sit directly on a rectangular control's corners. */
export function FrameDots({ color, size = 10 }: FrameDotsProps) {
  const offset = -(size / 2);
  const dot = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
  };
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <View style={[styles.dot, dot, { top: offset, left: offset }]} />
      <View style={[styles.dot, dot, { top: offset, right: offset }]} />
      <View style={[styles.dot, dot, { bottom: offset, left: offset }]} />
      <View style={[styles.dot, dot, { right: offset, bottom: offset }]} />
    </View>
  );
}

const styles = StyleSheet.create({ dot: { position: 'absolute', zIndex: 4 } });
