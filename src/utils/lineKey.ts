import type { Line, LineKey, Box } from '@/types';

/** Encode a line into a stable string key: "h:r:c" or "v:r:c". */
export function lineToKey(line: Line): LineKey {
  const o = line.orientation === 'horizontal' ? 'h' : 'v';
  return `${o}:${line.row}:${line.col}`;
}

/** Decode a LineKey back into a Line. */
export function keyToLine(key: LineKey): Line {
  const [o, row, col] = key.split(':');
  return {
    orientation: o === 'h' ? 'horizontal' : 'vertical',
    row: Number(row),
    col: Number(col),
  };
}

/** Encode a box (by its top-left dot) into a stable key: "b:r:c". */
export function boxToKey(box: Box): LineKey {
  return `b:${box.row}:${box.col}`;
}
