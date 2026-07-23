export type ActiveGameDecision =
  | { type: 'none' }
  | { type: 'navigate'; gameId: string }
  | { type: 'prompt'; gameIds: string[] };

/**
 * Decide what to do when the set of live games a player belongs to changes.
 *
 * Pure (no Firebase, no navigation) so the policy can be tested in isolation.
 * Two rules, matching the product decision:
 *  - A game that appears *after* we started watching is a match that just formed
 *    (a random pairing, a rematch) — open it straight away.
 *  - A game that's *already* there on the first snapshot is one we reconnected to
 *    (a cold start into a match still in progress) — ask before yanking the
 *    player into it.
 * The game currently on screen is never acted on, and each game is only ever
 * prompted once.
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

  if (isFirstSnapshot) {
    const toPrompt = current.filter((id) => elsewhere(id) && !alreadyPrompted.has(id));
    return toPrompt.length ? { type: 'prompt', gameIds: toPrompt } : { type: 'none' };
  }

  const appeared = current.find((id) => !previous.includes(id) && elsewhere(id));
  return appeared ? { type: 'navigate', gameId: appeared } : { type: 'none' };
}
