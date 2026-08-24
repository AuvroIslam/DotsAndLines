export type ActiveGameDecision =
  | { type: 'none' }
  | { type: 'navigate'; gameId: string }
  | { type: 'prompt'; gameIds: string[] };

/**
 * Decide what to do when the set of live games a player belongs to changes.
 *
 * Pure (no Firebase, no navigation) so the policy can be tested in isolation.
 * The product rules:
 *  - A game that appears *after* we started watching is a match that just formed
 *    (a random pairing, a rematch) — open it straight away…
 *  - …unless we're *already in another live game*, in which case we must not yank
 *    the player out of it — ask instead.
 *  - A game that's *already* there on the first snapshot is one we reconnected to
 *    (a cold start into a match still in progress) — ask before entering it.
 * The game currently on screen is never acted on, and each game is only ever
 * prompted once.
 *
 * "Already in a live game" is `currentGameId` being one of the *active* games,
 * not merely being on a game screen: a finished game is dropped from the index
 * the moment it ends, so the rematch offer screen (a finished game) does *not*
 * count — the rematch still opens seamlessly — while an in-progress match does.
 */
export function decideActiveGame(params: {
  isFirstSnapshot: boolean;
  previous: readonly string[];
  current: readonly string[];
  currentGameId: string | null;
  alreadyPrompted: ReadonlySet<string>;
}): ActiveGameDecision {
  const { isFirstSnapshot, previous, current, currentGameId, alreadyPrompted } = params;
  const elsewhere = (id: string) => id !== currentGameId;
  const inLiveGame = currentGameId !== null && current.includes(currentGameId);

  // Ask, don't yank: on a cold start into games already in progress, or whenever
  // pulling the player away would abandon a live game they're in.
  if (isFirstSnapshot || inLiveGame) {
    const fresh = (id: string) => (isFirstSnapshot ? true : !previous.includes(id));
    const toPrompt = current.filter(
      (id) => fresh(id) && elsewhere(id) && !alreadyPrompted.has(id),
    );
    return toPrompt.length ? { type: 'prompt', gameIds: toPrompt } : { type: 'none' };
  }

  // Free to act: a match formed while we were idle — open it.
  const appeared = current.find((id) => !previous.includes(id) && elsewhere(id));
  return appeared ? { type: 'navigate', gameId: appeared } : { type: 'none' };
}
