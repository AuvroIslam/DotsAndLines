import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { PresenceChecker } from '@/gameEngine';
import { Routes } from '@/navigation/routes';
import { haptics, sound } from '@/services/feedback';
import { gameFunctions, serverNow } from '@/services/firebase';
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

  // Once a rematch has actually been created, the active-game watcher (mounted in
  // the app layout) routes everyone into it — the new game lands in their
  // userActiveGames index atomically with its creation, so there's no separate
  // navigation to wire here. All we do is stop the unmount cleanup below from
  // retracting the offer that just made it (see `requestedRematch`).
  const rematchGameId = game?.rematchGameId ?? null;
  const iOfferedRematch = !!uid && !!game?.rematchOffers?.[uid];
  const requestedRematch = useRef(false);
  useEffect(() => {
    if (rematchGameId && iOfferedRematch) requestedRematch.current = false;
  }, [rematchGameId, iOfferedRematch]);

  // Retract a standing rematch offer whenever we leave the game, *however* we
  // leave — the on-screen button, the header, a swipe, or the Android back key,
  // which bypasses every on-press handler. Without this a player who offered and
  // then backed out stayed on the roster, and an opponent accepting a moment
  // later pulled them into a live game to lose by timeout. `requestedRematch` is
  // set the instant we tap and cleared once the rematch is consummated (the
  // effect above) or explicitly cancelled — so if it's still set at unmount, the
  // offer is genuinely standing and should be pulled.
  useEffect(
    () => () => {
      if (requestedRematch.current) void gameFunctions.cancelRematch(gameId);
    },
    [gameId],
  );

  // A rematch needs everyone to agree, so a lone waiter whose opponent has left
  // would otherwise sit on "Waiting…" forever. Detect it: I've offered, but a
  // player who still needs to agree is away (they hit Back to Home, or dropped).
  // Ticks so a silent drop (stale heartbeat) is caught too, not just a graceful
  // leave. Cosmetic — the offer/accept flow still decides; this only tells the
  // truth on screen instead of spinning.
  const [rematchStalled, setRematchStalled] = useState(false);
  useEffect(() => {
    if (!game || !iOfferedRematch) {
      setRematchStalled(false);
      return;
    }
    const check = () =>
      setRematchStalled(
        game.turnOrder.some((pid) => {
          const p = game.players[pid];
          if (!p || p.uid === uid) return false; // not me
          if (game.rematchOffers?.[p.uid]) return false; // they've already agreed
          return PresenceChecker.isAway(presence[pid], serverNow()); // gone
        }),
      );
    check();
    const id = setInterval(check, 1_000);
    return () => clearInterval(id);
  }, [game, presence, uid, iOfferedRematch]);

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

  const iAmEliminated = !!myPlayerId && game.players[myPlayerId]?.isEliminated;

  const handleLeave = () => {
    // Nothing to concede — the game's over, you're already out, or you're not a
    // player. Just leave.
    if (!myPlayerId || game.phase !== 'playing' || iAmEliminated) {
      router.replace(Routes.home);
      return;
    }
    Alert.alert('Forfeit game?', "You'll concede this game — then you can offer a rematch.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forfeit',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            // On success the game becomes finished and the result overlay appears
            // right here — where you can offer a rematch or go home. Only bail to
            // home if the request FAILED, so you're not stranded on a live board
            // with a button that silently did nothing.
            const accepted = await forfeit();
            if (!accepted) router.replace(Routes.home);
          })();
        },
      },
    ]);
  };

  const handleRematch = () => {
    void (async () => {
      const res = await gameFunctions.startRematch(gameId);
      if (res.ok && res.data.gameId) {
        // Everyone agreed — go straight to the new game.
        router.replace(Routes.game(res.data.gameId));
      } else if (res.ok) {
        // Offer recorded, waiting on the others. Remember that we asked so we can
        // retract it on the way out (below) — tracked here rather than from the
        // snapshot flag, which lags a round-trip behind the tap.
        requestedRematch.current = true;
      }
    })();
  };

  // Retract a standing rematch offer, and stop tracking it, without leaving.
  const handleCancelRematch = () => {
    requestedRematch.current = false;
    void gameFunctions.cancelRematch(gameId);
  };

  const handleExitFinished = () => router.replace(Routes.home);

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
        {/* Concede an in-progress game (then you can rematch); an eliminated
            spectator or a finished game just leaves. */}
        <Button
          label={iAmEliminated || game.phase !== 'playing' ? 'Leave' : 'Forfeit'}
          variant="ghost"
          onPress={handleLeave}
        />
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
          rematchStalled={rematchStalled}
          onRematch={handleRematch}
          onCancelRematch={handleCancelRematch}
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
