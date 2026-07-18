import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, Loader, Typography } from '@/components/ui';
import {
  ConnectionBanner,
  GameBoard,
  GameOverlay,
  PeerDisconnectBanner,
  Scoreboard,
  TurnTimerBar,
  useConnectionMonitor,
  useLiveGame,
  useMatchRecorder,
  usePeerDisconnectStatus,
  useTrackPlayerConnection,
  useTurnTimer,
} from '@/features/game';
import { Routes } from '@/navigation/routes';
import { haptics, sound } from '@/services/feedback';
import { gameFunctions } from '@/services/firebase';
import { useAuthStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

export default function GameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const live = useLiveGame(gameId);
  const {
    game,
    presence,
    isMyTurn,
    currentPlayer,
    connection,
    pendingLines,
    makeMove,
    myPlayerId,
    forfeit,
  } = live;
  const { fraction } = useTurnTimer(game);
  useConnectionMonitor(!!game);
  useMatchRecorder(game, uid);
  useTrackPlayerConnection(gameId, myPlayerId);
  const { awayPeers } = usePeerDisconnectStatus(game, presence, myPlayerId, connection);

  // Distinguishes "still loading" from "gone": once we've seen the game, a null
  // snapshot means it was deleted, not that we're waiting on the first read.
  // Tracked per game id, not as a bare flag: navigating straight into a rematch
  // can reuse this screen, and a flag carried over from the previous game would
  // report the new one as "ended" before its first snapshot had even arrived.
  const everLoaded = useRef<string | null>(null);
  if (game) everLoaded.current = gameId;

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

  // The last player to accept a rematch gets the new id straight back; everyone
  // else learns of it when `rematchGameId` appears on the finished game they are
  // all still subscribed to. Only follow it if we actually asked — otherwise a
  // player who declined would be dragged into the game they just turned down,
  // which is the whole bug the offer/accept flow exists to prevent.
  const rematchGameId = game?.rematchGameId ?? null;
  const iOfferedRematch = !!uid && !!game?.rematchOffers?.[uid];
  useEffect(() => {
    if (rematchGameId && iOfferedRematch) router.replace(Routes.game(rematchGameId));
  }, [rematchGameId, iOfferedRematch, router]);

  // A game we've never seen is still loading; one that has *gone* was deleted
  // (finished games are cleaned up after a day) or never existed at all. Without
  // this the screen sat on "Joining game…" forever.
  if (!game) {
    if (everLoaded.current !== gameId) return <Loader message="Joining game…" />;
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.boardArea}>
          <EmptyState emoji="🏁" title="This game has ended" subtitle="It was finished or removed." />
          <Button label="Back to Home" onPress={() => router.replace(Routes.home)} />
        </View>
      </SafeAreaView>
    );
  }

  const handleLeave = () => {
    if (!myPlayerId || game.phase !== 'playing') {
      router.replace(Routes.home);
      return;
    }
    Alert.alert('Leave game?', 'Your opponent(s) will win.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await forfeit();
            } finally {
              // Leave regardless. If the forfeit request failed we still take the
              // player out of the game they chose to leave — the turn clock will
              // resolve the match for them. Stranding them on a board they've quit,
              // with a button that silently did nothing, is the worse outcome.
              router.replace(Routes.home);
            }
          })();
        },
      },
    ]);
  };

  const handleRematch = () => {
    void (async () => {
      const res = await gameFunctions.startRematch(gameId);
      // `pending` means the offer is recorded but someone hasn't agreed yet, so
      // there is no game to go to. The effect below navigates if they do.
      if (res.ok && res.data.gameId) router.replace(Routes.game(res.data.gameId));
    })();
  };

  // Leaving the game-over screen retracts any rematch offer first, so an opponent
  // accepting a moment later can't pull us into a game we just walked away from.
  // Fire-and-forget: navigation shouldn't wait on it, and the offer's freshness
  // window expires it anyway if the request never lands.
  const handleExitFinished = () => {
    if (iOfferedRematch) void gameFunctions.cancelRematch(gameId);
    router.replace(Routes.home);
  };

  const iAmEliminated = !!myPlayerId && game.players[myPlayerId]?.isEliminated;
  const turnLabel =
    game.phase === 'finished'
      ? 'Game over'
      : iAmEliminated
        ? 'You left — watching'
        : isMyTurn
          ? 'Your turn'
          : `${currentPlayer?.displayName ?? 'Opponent'}'s turn`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Button label="Leave" variant="ghost" onPress={handleLeave} />
        <ConnectionBanner status={connection} />
        <View style={styles.spacer} />
      </View>

      <PeerDisconnectBanner game={game} awayPeers={awayPeers} />

      <Scoreboard game={game} presence={presence} myPlayerId={myPlayerId} />

      <View style={styles.turnRow}>
        <Typography variant="h3" color={currentPlayer?.color}>
          {turnLabel}
        </Typography>
      </View>
      <View style={styles.timer}>
        <TurnTimerBar fraction={fraction} color={currentPlayer?.color ?? colors.primary} />
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
          onExit={handleExitFinished}
          // A rematch needs everyone to agree, so the button reflects who has:
          // once we've asked, we're waiting on the others; once they've asked,
          // we're the one being waited on.
          iOfferedRematch={iOfferedRematch}
          othersOfferedRematch={
            !!uid &&
            Object.keys(game.rematchOffers ?? {}).some((offeredBy) => offeredBy !== uid)
          }
          onRematch={handleRematch}
        />
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    spacer: { width: 64 },
    turnRow: { alignItems: 'center' },
    timer: { paddingHorizontal: spacing.xl },
    boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });
