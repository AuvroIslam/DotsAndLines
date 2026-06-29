import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { theme } from '@/theme';
import type { GameState, Line } from '@/types';
import { boxToKey, lineToKey } from '@/utils';

import { BoxCell } from './BoxCell';
import { LineSegment } from './LineSegment';

interface GameBoardProps {
  game: GameState;
  pendingLines: Set<string>;
  interactive: boolean;
  onDraw: (line: Line) => void;
}

const DOT = 10;
const LINE_THICKNESS = 7;
const MAX_BOARD = 420;
const MARGIN = theme.spacing.lg;

/**
 * Renders the playfield purely from engine state: computes pixel geometry for an
 * N×N grid and maps every line/box/dot to an animated child. Holds no game rules.
 */
export function GameBoard({ game, pendingLines, interactive, onDraw }: GameBoardProps) {
  const { width } = useWindowDimensions();
  const n = game.board.size;

  const { boardPx, pad, spacing } = useMemo(() => {
    const boardPxLocal = Math.min(width - MARGIN * 2, MAX_BOARD);
    const padLocal = DOT;
    const spacingLocal = (boardPxLocal - padLocal * 2) / n;
    return { boardPx: boardPxLocal, pad: padLocal, spacing: spacingLocal };
  }, [width, n]);

  const dotAt = (row: number, col: number) => ({
    x: pad + col * spacing,
    y: pad + row * spacing,
  });

  const colorOf = (playerId: string | undefined): string =>
    playerId ? (game.players[playerId]?.color ?? theme.colors.primary) : theme.colors.primary;

  const labelOf = (playerId: string | undefined): string | null => {
    if (!playerId) return null;
    const idx = game.players[playerId]?.index;
    return idx === undefined ? null : `P${idx + 1}`;
  };

  const horizontals: Line[] = [];
  for (let row = 0; row <= n; row += 1) {
    for (let col = 0; col < n; col += 1) horizontals.push({ orientation: 'horizontal', row, col });
  }
  const verticals: Line[] = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col <= n; col += 1) verticals.push({ orientation: 'vertical', row, col });
  }

  return (
    <View style={[styles.board, { width: boardPx, height: boardPx }]}>
      {/* Completed boxes (drawn under the lines) */}
      {Array.from({ length: n * n }, (_, i) => {
        const row = Math.floor(i / n);
        const col = i % n;
        const owner = game.board.boxes[boxToKey({ row, col })];
        const { x, y } = dotAt(row, col);
        return (
          <BoxCell
            key={`box-${row}-${col}`}
            x={x}
            y={y}
            size={spacing}
            owner={owner ?? null}
            color={owner ? colorOf(owner) : null}
            label={owner ? labelOf(owner) : null}
          />
        );
      })}

      {/* Edges */}
      {horizontals.map((line) => {
        const key = lineToKey(line);
        const owner = game.board.lines[key];
        const { x, y } = dotAt(line.row, line.col);
        return (
          <LineSegment
            key={key}
            x={x}
            y={y}
            length={spacing}
            thickness={LINE_THICKNESS}
            horizontal
            drawn={owner !== undefined}
            pending={pendingLines.has(key)}
            color={colorOf(owner)}
            interactive={interactive}
            onPress={() => onDraw(line)}
          />
        );
      })}
      {verticals.map((line) => {
        const key = lineToKey(line);
        const owner = game.board.lines[key];
        const { x, y } = dotAt(line.row, line.col);
        return (
          <LineSegment
            key={key}
            x={x}
            y={y}
            length={spacing}
            thickness={LINE_THICKNESS}
            horizontal={false}
            drawn={owner !== undefined}
            pending={pendingLines.has(key)}
            color={colorOf(owner)}
            interactive={interactive}
            onPress={() => onDraw(line)}
          />
        );
      })}

      {/* Dots on top */}
      {Array.from({ length: (n + 1) * (n + 1) }, (_, i) => {
        const row = Math.floor(i / (n + 1));
        const col = i % (n + 1);
        const { x, y } = dotAt(row, col);
        return (
          <View
            key={`dot-${row}-${col}`}
            style={[styles.dot, { left: x - DOT / 2, top: y - DOT / 2 }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { alignSelf: 'center', position: 'relative' },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: theme.colors.text,
  },
});
