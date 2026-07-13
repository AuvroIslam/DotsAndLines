import type { GameResult, GameState, MatchOutcome, PlayerId, UserStatistics } from '@/types';

/**
 * Pure derivation of what a finished game means for one player.
 *
 * This lives in the engine because the *server* now records match history and
 * statistics (clients cannot write their own win record — that made the
 * leaderboard free money), while the client still needs the same answers to
 * render the result screen. Keeping the arithmetic in one place is what stops
 * the two from quietly disagreeing about who won or what a streak is.
 */

export const emptyStatistics = (uid: string): UserStatistics => ({
  uid,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  totalBoxesWon: 0,
  winStreak: 0,
  bestWinStreak: 0,
});

/**
 * A player's outcome. An empty `winners` list is a no-contest — everyone stopped
 * playing — which counts as a draw rather than a loss for the people in it.
 */
export function outcomeFor(result: GameResult, playerId: PlayerId): MatchOutcome {
  if (result.winners.length === 0) return 'draw';
  if (result.isDraw) return result.winners.includes(playerId) ? 'draw' : 'loss';
  return result.winners.includes(playerId) ? 'win' : 'loss';
}

/** Fold one finished game into a player's running statistics. */
export function applyOutcome(
  prev: UserStatistics,
  outcome: MatchOutcome,
  boxesWon: number,
): UserStatistics {
  const winStreak = outcome === 'win' ? prev.winStreak + 1 : 0;
  return {
    uid: prev.uid,
    gamesPlayed: prev.gamesPlayed + 1,
    wins: prev.wins + (outcome === 'win' ? 1 : 0),
    losses: prev.losses + (outcome === 'loss' ? 1 : 0),
    draws: prev.draws + (outcome === 'draw' ? 1 : 0),
    totalBoxesWon: prev.totalBoxesWon + boxesWon,
    winStreak,
    bestWinStreak: Math.max(prev.bestWinStreak, winStreak),
  };
}

/** The opponents of `playerId`, as recorded on a match-history entry. */
export function opponentsOf(game: GameState, playerId: PlayerId) {
  return game.turnOrder
    .filter((id) => id !== playerId)
    .map((id) => {
      const p = game.players[id]!;
      return { uid: p.uid, displayName: p.displayName, score: p.score };
    });
}
