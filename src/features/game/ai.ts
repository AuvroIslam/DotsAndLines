import { Board } from '@/gameEngine';
import type { Box, GameState, Line, PlayerId } from '@/types';
import { lineToKey } from '@/utils/lineKey';

/**
 * Pure heuristic AI for the local hotseat mode. No React, no engine
 * mutation — every helper operates on snapshots, matching `gameEngine`
 * conventions so this stays unit-testable in isolation.
 */
export type AIDifficulty = 'easy' | 'medium' | 'hard';

type MoveClass = 'completing' | 'safe' | 'unsafe';

function pickRandom<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)]!;
}

function availableLines(state: GameState): Line[] {
  return Board.getAllLines(state.board.size).filter((l) => !Board.isLineDrawn(state.board, l));
}

/** Board state with `line` drawn, without assigning any completed box. */
function withLineDrawn(state: GameState, line: Line): GameState['board'] {
  return { ...state.board, lines: { ...state.board.lines, [lineToKey(line)]: '_probe' } };
}

/** Classify a candidate move by its immediate consequence. */
function classify(state: GameState, line: Line): MoveClass {
  const { completedBoxes } = Board.applyLine(state.board, line, '_probe');
  if (completedBoxes.length > 0) return 'completing';

  const probeBoard = withLineDrawn(state, line);
  const adjacent = Board.getAdjacentBoxes(line, state.board.size);
  for (const box of adjacent) {
    const drawnEdges = Board.getBoxEdges(box).filter((e) => Board.isLineDrawn(probeBoard, e));
    if (drawnEdges.length === 3) return 'unsafe';
  }
  return 'safe';
}

/**
 * Number of boxes captured by a greedy chain reaction if `line` is drawn:
 * simulates repeatedly closing every box left at 3 drawn edges. Used to rank
 * sacrifices — lower is better for the player forced to give a box away.
 */
function cascadeSize(state: GameState, line: Line): number {
  let board = withLineDrawn(state, line);
  let captured = 0;
  let progressed = true;

  while (progressed) {
    progressed = false;
    for (let row = 0; row < state.board.size; row += 1) {
      for (let col = 0; col < state.board.size; col += 1) {
        const box: Box = { row, col };
        if (Board.isBoxOwned(board, box)) continue;
        const edges = Board.getBoxEdges(box);
        const undrawn = edges.filter((e) => !Board.isLineDrawn(board, e));
        if (undrawn.length === 1) {
          board = Board.applyLine(board, undrawn[0]!, '_probe').board;
          captured += 1;
          progressed = true;
        }
      }
    }
  }

  return captured;
}

function chooseEasy(lines: Line[], rng: () => number): Line {
  return pickRandom(lines, rng);
}

function chooseMediumOrHard(
  state: GameState,
  lines: Line[],
  difficulty: 'medium' | 'hard',
  rng: () => number,
): Line {
  const byClass: Record<MoveClass, Line[]> = { completing: [], safe: [], unsafe: [] };
  for (const line of lines) byClass[classify(state, line)].push(line);

  if (byClass.completing.length > 0) return pickRandom(byClass.completing, rng);
  if (byClass.safe.length > 0) return pickRandom(byClass.safe, rng);

  // Forced sacrifice.
  if (difficulty === 'medium') return pickRandom(byClass.unsafe, rng);

  let best: Line[] = [];
  let bestSize = Infinity;
  for (const line of byClass.unsafe) {
    const size = cascadeSize(state, line);
    if (size < bestSize) {
      bestSize = size;
      best = [line];
    } else if (size === bestSize) {
      best.push(line);
    }
  }
  return pickRandom(best, rng);
}

export function chooseMoveAI(
  state: GameState,
  playerId: PlayerId,
  difficulty: AIDifficulty,
  rng: () => number = Math.random,
): Line | null {
  const lines = availableLines(state);
  if (lines.length === 0) return null;

  if (difficulty === 'easy') return chooseEasy(lines, rng);
  return chooseMediumOrHard(state, lines, difficulty, rng);
}
