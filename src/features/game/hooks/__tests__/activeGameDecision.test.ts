import { decideActiveGame } from '../activeGameDecision';

const none = new Set<string>();

describe('decideActiveGame', () => {
  it('does nothing when there are no active games', () => {
    expect(
      decideActiveGame({
        isFirstSnapshot: true,
        previous: [],
        current: [],
        currentGameId: null,
        alreadyPrompted: none,
      }),
    ).toEqual({ type: 'none' });
  });

  it('prompts to rejoin a game already in progress on the first snapshot', () => {
    expect(
      decideActiveGame({
        isFirstSnapshot: true,
        previous: [],
        current: ['g1'],
        currentGameId: null,
        alreadyPrompted: none,
      }),
    ).toEqual({ type: 'prompt', gameIds: ['g1'] });
  });

  it('navigates straight into a game that appears after we started watching', () => {
    expect(
      decideActiveGame({
        isFirstSnapshot: false,
        previous: [],
        current: ['g2'],
        currentGameId: null,
        alreadyPrompted: none,
      }),
    ).toEqual({ type: 'navigate', gameId: 'g2' });
  });

  it('never acts on the game currently on screen', () => {
    // First snapshot while already viewing it → no rejoin prompt.
    expect(
      decideActiveGame({
        isFirstSnapshot: true,
        previous: [],
        current: ['g1'],
        currentGameId: 'g1',
        alreadyPrompted: none,
      }),
    ).toEqual({ type: 'none' });

    // It "appearing" while we're on it (e.g. a late index write) → no navigate.
    expect(
      decideActiveGame({
        isFirstSnapshot: false,
        previous: [],
        current: ['g1'],
        currentGameId: 'g1',
        alreadyPrompted: none,
      }),
    ).toEqual({ type: 'none' });
  });

  it('does not re-prompt a game it has already prompted for', () => {
    expect(
      decideActiveGame({
        isFirstSnapshot: true,
        previous: [],
        current: ['g1'],
        currentGameId: null,
        alreadyPrompted: new Set(['g1']),
      }),
    ).toEqual({ type: 'none' });
  });

  it('ignores a game that was already present (a match forming is the new one)', () => {
    // g1 was there before; g3 just appeared → open g3, not g1.
    expect(
      decideActiveGame({
        isFirstSnapshot: false,
        previous: ['g1'],
        current: ['g1', 'g3'],
        currentGameId: null,
        alreadyPrompted: none,
      }),
    ).toEqual({ type: 'navigate', gameId: 'g3' });
  });

  it('does nothing when a game leaves the set (it just ended)', () => {
    expect(
      decideActiveGame({
        isFirstSnapshot: false,
        previous: ['g1'],
        current: [],
        currentGameId: null,
        alreadyPrompted: none,
      }),
    ).toEqual({ type: 'none' });
  });

  it('prompts instead of navigating when we are already in a live game', () => {
    // Playing g1 (in the active set) when g2 appears → don't yank out of g1.
    expect(
      decideActiveGame({
        isFirstSnapshot: false,
        previous: ['g1'],
        current: ['g1', 'g2'],
        currentGameId: 'g1',
        alreadyPrompted: none,
      }),
    ).toEqual({ type: 'prompt', gameIds: ['g2'] });
  });

  it('still opens a rematch seamlessly from a FINISHED game screen', () => {
    // The finished game (fin) was removed from the index when it ended, so it is
    // not in `current` — we are on its screen but not "in a live game" — and the
    // new rematch (rm) opens straight away rather than merely prompting.
    expect(
      decideActiveGame({
        isFirstSnapshot: false,
        previous: [],
        current: ['rm'],
        currentGameId: 'fin',
        alreadyPrompted: none,
      }),
    ).toEqual({ type: 'navigate', gameId: 'rm' });
  });

  it('does not re-prompt a second game while in a live game once prompted', () => {
    expect(
      decideActiveGame({
        isFirstSnapshot: false,
        previous: ['g1'],
        current: ['g1', 'g2'],
        currentGameId: 'g1',
        alreadyPrompted: new Set(['g2']),
      }),
    ).toEqual({ type: 'none' });
  });
});
