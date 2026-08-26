import { useMemo } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useThemeColors, type AppColors } from '@/theme/useTheme';

const GRID_STEPS = Array.from({ length: 9 }, (_, index) => `${index * 12.5}%` as `${number}%`);
const BOARD_POINTS = Array.from({ length: 9 }, (_, index) => ({
  row: Math.floor(index / 3),
  col: index % 3,
}));

function BoardConstellation({ colors, style }: { colors: AppColors; style: StyleProp<ViewStyle> }) {
  return (
    <View style={[motifStyles.board, style]}>
      <View style={[motifStyles.cell, motifStyles.cellOne, { backgroundColor: colors.primary }]} />
      <View style={[motifStyles.cell, motifStyles.cellTwo, { backgroundColor: colors.purple }]} />
      <View style={[motifStyles.cell, motifStyles.cellThree, { backgroundColor: colors.accent }]} />
      {[8, 62, 116].map((position) => (
        <View
          key={`h-${position}`}
          style={[motifStyles.boardHorizontal, { top: position, backgroundColor: colors.primary }]}
        />
      ))}
      {[8, 62, 116].map((position) => (
        <View
          key={`v-${position}`}
          style={[motifStyles.boardVertical, { left: position, backgroundColor: colors.primary }]}
        />
      ))}
      {BOARD_POINTS.map(({ row, col }) => (
        <View
          key={`${row}-${col}`}
          style={[
            motifStyles.boardDot,
            {
              left: 3 + col * 54,
              top: 3 + row * 54,
              backgroundColor: row === 2 ? colors.warning : colors.primary,
            },
          ]}
        />
      ))}
    </View>
  );
}

function MoveRibbon({ colors, style }: { colors: AppColors; style: StyleProp<ViewStyle> }) {
  return (
    <View style={[motifStyles.ribbon, style]}>
      <View
        style={[motifStyles.ribbonLine, motifStyles.ribbonTop, { backgroundColor: colors.warning }]}
      />
      <View
        style={[
          motifStyles.ribbonLine,
          motifStyles.ribbonDrop,
          { backgroundColor: colors.warning },
        ]}
      />
      <View
        style={[
          motifStyles.ribbonLine,
          motifStyles.ribbonBottom,
          { backgroundColor: colors.purple },
        ]}
      />
      <View
        style={[motifStyles.ribbonLine, motifStyles.ribbonRise, { backgroundColor: colors.purple }]}
      />
      {[
        { left: 6, top: 13, color: colors.warning },
        { left: 68, top: 13, color: colors.warning },
        { left: 68, top: 65, color: colors.purple },
        { left: 134, top: 65, color: colors.purple },
        { left: 134, top: 27, color: colors.accent },
      ].map((node, index) => (
        <View
          key={index}
          style={[
            motifStyles.ribbonDot,
            { left: node.left, top: node.top, backgroundColor: node.color },
          ]}
        />
      ))}
    </View>
  );
}

/** Quiet visual texture shared by every route. It never receives touches. */
export function PlayfulBackground({ quiet = false }: { quiet?: boolean }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const scale = Math.min(1.35, Math.max(0.85, width / 390));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, quiet && styles.quiet]}>
      <View style={styles.diamondOne} />
      <View style={styles.diamondTwo} />
      {GRID_STEPS.map((position) => (
        <View key={`v-${position}`} style={[styles.vertical, { left: position }]} />
      ))}
      {GRID_STEPS.map((position) => (
        <View key={`h-${position}`} style={[styles.horizontal, { top: position }]} />
      ))}
      <BoardConstellation
        colors={colors}
        style={[styles.boardOne, { transform: [{ rotate: '13deg' }, { scale }] }]}
      />
      <BoardConstellation
        colors={colors}
        style={[styles.boardTwo, { transform: [{ rotate: '-16deg' }, { scale }] }]}
      />
      <MoveRibbon
        colors={colors}
        style={[styles.moveRibbon, { transform: [{ rotate: '-18deg' }, { scale }] }]}
      />
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    quiet: { opacity: 0.55 },
    vertical: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: colors.grid,
      opacity: 0.34,
    },
    horizontal: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: colors.grid,
      opacity: 0.34,
    },
    diamondOne: {
      position: 'absolute',
      width: 230,
      height: 230,
      top: -150,
      right: -115,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.primary,
      opacity: 0.08,
      transform: [{ rotate: '35deg' }],
    },
    diamondTwo: {
      position: 'absolute',
      width: 190,
      height: 190,
      bottom: -125,
      left: -105,
      backgroundColor: colors.accent,
      borderWidth: 3,
      borderColor: colors.accent,
      opacity: 0.07,
      transform: [{ rotate: '28deg' }],
    },
    boardOne: { position: 'absolute', top: '8%', right: -56, opacity: 0.18 },
    boardTwo: { position: 'absolute', bottom: '5%', left: -64, opacity: 0.14 },
    moveRibbon: { position: 'absolute', top: '55%', right: -44, opacity: 0.22 },
  });

const motifStyles = StyleSheet.create({
  board: { width: 124, height: 124 },
  cell: { position: 'absolute', width: 50, height: 50, opacity: 0.42 },
  cellOne: { left: 10, top: 10 },
  cellTwo: { left: 64, top: 10 },
  cellThree: { left: 64, top: 64 },
  boardHorizontal: { position: 'absolute', left: 8, width: 108, height: 3 },
  boardVertical: { position: 'absolute', top: 8, width: 3, height: 108 },
  boardDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  ribbon: { width: 150, height: 82 },
  ribbonLine: { position: 'absolute', height: 4 },
  ribbonTop: { left: 11, top: 17, width: 62 },
  ribbonDrop: { left: 70, top: 17, width: 52, transform: [{ rotate: '90deg' }] },
  ribbonBottom: { left: 73, top: 69, width: 66 },
  ribbonRise: { left: 116, top: 50, width: 38, transform: [{ rotate: '90deg' }] },
  ribbonDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
});
