import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Loader, Typography } from '@/components/ui';
import {
  ConnectionBanner,
  GameBoard,
  GameOverlay,
  Scoreboard,
  TurnTimerBar,
  useConnectionMonitor,
  useLiveGame,
  useMatchRecorder,
  useTurnTimer,
} from '@/features/game';
import { Routes } from '@/navigation/routes';
import { haptics, sound } from '@/services/feedback';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';

export default function GameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.uid ?? null);

  const live = useLiveGame(gameId);
  const { game, isMyTurn, currentPlayer, connection, pendingLines, makeMove, myPlayerId } = live;
  const { fraction } = useTurnTimer(game, isMyTurn);
  useConnectionMonitor(!!game);
  useMatchRecorder(game, uid, myPlayerId);

  // Feedback driven by authoritative board deltas, so every player feels moves.
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
    if (game?.phase === 'finished') {
      const iWon = !!myPlayerId && game.result?.winners.includes(myPlayerId);
      if (iWon) haptics.success();
      else haptics.error();
    }
  }, [game?.phase, game?.result, myPlayerId]);

  if (!game) return <Loader message="Joining game…" />;

  const turnLabel =
    game.phase === 'finished'
      ? 'Game over'
      : isMyTurn
        ? 'Your turn'
        : `${currentPlayer?.displayName ?? 'Opponent'}'s turn`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Button label="Leave" variant="ghost" onPress={() => router.replace(Routes.home)} />
        <ConnectionBanner status={connection} />
        <View style={styles.spacer} />
      </View>

      <Scoreboard game={game} myPlayerId={myPlayerId} />

      <View style={styles.turnRow}>
        <Typography variant="h3" color={currentPlayer?.color}>
          {turnLabel}
        </Typography>
      </View>
      <View style={styles.timer}>
        <TurnTimerBar fraction={fraction} color={currentPlayer?.color ?? theme.colors.primary} />
      </View>

      <View style={styles.boardArea}>
        <GameBoard
          game={game}
          pendingLines={pendingLines}
          interactive={isMyTurn}
          onDraw={(line) => {
            haptics.selection();
            makeMove(line);
          }}
        />
      </View>

      {game.phase === 'finished' ? (
        <GameOverlay
          game={game}
          myPlayerId={myPlayerId}
          onExit={() => router.replace(Routes.home)}
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
  timer: { paddingHorizontal: theme.spacing.xl },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
