import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Screen, TextField, Typography } from '@/components/ui';
import {
  GameBoard,
  GameOverlay,
  Scoreboard,
  TurnTimerBar,
} from '@/features/game';
import { useLocalGame } from '@/features/game/hooks/useLocalGame';
import { Routes } from '@/navigation/routes';
import { haptics, sound } from '@/services/feedback';
import { theme } from '@/theme';
import type { BoardSize } from '@/types';

const BOARD_SIZES: BoardSize[] = [3, 4, 5];
const PLAYER_COLORS = ['#e74c3c', '#3498db'] as const;

export default function LocalGameScreen() {
  const router = useRouter();
  const { game, makeMove, skipTurn, reset, startGame } = useLocalGame();

  const [boardSize, setBoardSize] = useState<BoardSize>(3);
  const [names, setNames] = useState<[string, string]>(['Player 1', 'Player 2']);

  const currentPlayer = game ? (game.players[game.currentTurn] ?? null) : null;

  const [timerFraction, setTimerFraction] = useState(1);
  const skipFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!game || game.phase !== 'playing') {
      setTimerFraction(1);
      return;
    }
    const deadline = game.turnStartedAt + game.turnDurationMs;
    const turnKey = `${game.currentTurn}:${game.turnStartedAt}`;

    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setTimerFraction(remaining / game.turnDurationMs);
      if (remaining === 0 && skipFiredRef.current !== turnKey) {
        skipFiredRef.current = turnKey;
        skipTurn();
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [game, skipTurn]);

  const prevLines = useRef(0);
  const prevBoxes = useRef(0);
  useEffect(() => {
    if (!game) return;
    const lines = Object.keys(game.board.lines).length;
    const boxes = Object.keys(game.board.boxes).length;
    if (boxes > prevBoxes.current) {
      haptics.success();
      void sound.play('box');
    } else if (lines > prevLines.current) {
      haptics.light();
      void sound.play('line');
    }
    prevLines.current = lines;
    prevBoxes.current = boxes;
  }, [game]);

  useEffect(() => {
    if (game?.phase === 'finished') haptics.success();
  }, [game?.phase]);

  const handleStart = () => {
    startGame(boardSize, [
      { id: 'local-1', displayName: names[0] || 'Player 1', color: PLAYER_COLORS[0] },
      { id: 'local-2', displayName: names[1] || 'Player 2', color: PLAYER_COLORS[1] },
    ]);
    prevLines.current = 0;
    prevBoxes.current = 0;
  };

  if (!game) {
    return (
      <Screen scroll>
        <Typography variant="h2">Local Play</Typography>
        <Typography variant="body" muted>
          Two players, one device. Take turns drawing lines.
        </Typography>

        <Typography variant="h3" style={styles.sectionTop}>
          Board Size
        </Typography>
        <View style={styles.sizeRow}>
          {BOARD_SIZES.map((s) => (
            <Button
              key={s}
              label={`${s}×${s}`}
              variant={boardSize === s ? 'primary' : 'secondary'}
              style={styles.sizeBtn}
              onPress={() => setBoardSize(s)}
            />
          ))}
        </View>

        <Typography variant="h3" style={styles.sectionTop}>
          Players
        </Typography>
        <View style={styles.playerRow}>
          <View style={[styles.colorDot, { backgroundColor: PLAYER_COLORS[0] }]} />
          <TextField
            value={names[0]}
            onChangeText={(v) => setNames([v, names[1]])}
            placeholder="Player 1"
            style={styles.nameField}
          />
        </View>
        <View style={styles.playerRow}>
          <View style={[styles.colorDot, { backgroundColor: PLAYER_COLORS[1] }]} />
          <TextField
            value={names[1]}
            onChangeText={(v) => setNames([names[0], v])}
            placeholder="Player 2"
            style={styles.nameField}
          />
        </View>

        <Button label="Start Game" style={styles.sectionTop} onPress={handleStart} />
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const turnLabel =
    game.phase === 'finished' ? 'Game over' : `${currentPlayer?.displayName ?? '?'}'s turn`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Button
          label="Leave"
          variant="ghost"
          onPress={() => {
            reset();
            router.replace(Routes.home);
          }}
        />
        <View style={styles.spacer} />
      </View>

      <Scoreboard game={game} myPlayerId={null} />

      <View style={styles.turnRow}>
        <Typography variant="h3" color={currentPlayer?.color}>
          {turnLabel}
        </Typography>
      </View>
      <View style={styles.timerRow}>
        <TurnTimerBar
          fraction={timerFraction}
          color={currentPlayer?.color ?? theme.colors.primary}
        />
      </View>

      <View style={styles.boardArea}>
        <GameBoard
          game={game}
          pendingLines={new Set()}
          interactive={game.phase === 'playing'}
          onDraw={(line) => {
            haptics.selection();
            makeMove(line);
          }}
        />
      </View>

      {game.phase === 'finished' ? (
        <GameOverlay
          game={game}
          myPlayerId={null}
          onRematch={() => {
            reset();
            handleStart();
          }}
          onExit={() => {
            reset();
            router.replace(Routes.home);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spacer: { width: 64 },
  turnRow: { alignItems: 'center' },
  timerRow: { paddingHorizontal: theme.spacing.xl },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTop: { marginTop: theme.spacing.md },
  sizeRow: { flexDirection: 'row', gap: theme.spacing.md },
  sizeBtn: { flex: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  colorDot: { width: 20, height: 20, borderRadius: 10 },
  nameField: { flex: 1 },
});
