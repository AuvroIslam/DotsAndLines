import { useCallback, useEffect, useRef, useState } from 'react';

import { Board, GameManager } from '@/gameEngine';
import type { BoardSize, GameState, Line, PlayerId, PlayerIndex } from '@/types';
import { AI_MOVE_MAX_DELAY_MS, AI_MOVE_MIN_DELAY_MS } from '@/utils/constants';

import { chooseMoveAI, type AIDifficulty } from '../ai';

export interface LocalPlayer {
  id: string;
  displayName: string;
  color: string;
  isAI?: boolean;
  aiDifficulty?: AIDifficulty;
}

export interface UseLocalGameReturn {
  game: GameState | null;
  aiThinking: boolean;
  makeMove: (line: Line) => void;
  skipTurn: () => void;
  reset: () => void;
  startGame: (size: BoardSize, players: [LocalPlayer, LocalPlayer]) => void;
}

export function useLocalGame(): UseLocalGameReturn {
  const [game, setGame] = useState<GameState | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const aiPlayersRef = useRef<Record<PlayerId, LocalPlayer>>({});
  const scheduledTurnRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledMove = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setAiThinking(false);
  }, []);

  const startGame = useCallback((size: BoardSize, players: [LocalPlayer, LocalPlayer]) => {
    aiPlayersRef.current = Object.fromEntries(players.map((p) => [p.id, p]));
    scheduledTurnRef.current = null;
    const state = GameManager.create({
      id: `local-${Date.now()}`,
      mode: 'friend',
      size,
      players: players.map((p, i) => ({
        id: p.id,
        uid: p.id,
        index: i as PlayerIndex,
        displayName: p.displayName,
        color: p.color,
        isConnected: true,
        score: 0,
      })),
    });
    setGame(state);
  }, []);

  const makeMove = useCallback((line: Line) => {
    setGame((prev) => {
      if (!prev) return prev;
      const outcome = GameManager.applyMove(prev, line, prev.currentTurn);
      return outcome.ok ? outcome.state : prev;
    });
  }, []);

  const skipTurn = useCallback(() => {
    setGame((prev) => (prev ? GameManager.skipTurn(prev) : prev));
  }, []);

  const reset = useCallback(() => {
    clearScheduledMove();
    aiPlayersRef.current = {};
    scheduledTurnRef.current = null;
    setGame(null);
  }, [clearScheduledMove]);

  // Schedule the AI's move whenever it becomes its turn.
  useEffect(() => {
    if (!game || game.phase !== 'playing') return;
    const aiPlayer = aiPlayersRef.current[game.currentTurn];
    if (!aiPlayer?.isAI) return;

    const turnKey = `${game.currentTurn}:${game.turnStartedAt}:${Board.drawnLineCount(game.board)}`;
    if (scheduledTurnRef.current === turnKey) return;
    scheduledTurnRef.current = turnKey;

    setAiThinking(true);
    const delay =
      AI_MOVE_MIN_DELAY_MS + Math.random() * (AI_MOVE_MAX_DELAY_MS - AI_MOVE_MIN_DELAY_MS);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setAiThinking(false);
      const line = chooseMoveAI(game, game.currentTurn, aiPlayer.aiDifficulty ?? 'medium');
      if (line) makeMove(line);
    }, delay);

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [game, makeMove]);

  return { game, aiThinking, makeMove, skipTurn, reset, startGame };
}
