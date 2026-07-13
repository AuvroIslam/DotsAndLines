/** Centralized Firestore collection names and Realtime Database path builders. */

export const Collections = {
  users: 'users',
  statistics: 'statistics',
  settings: 'settings',
  friends: 'friends', // subcollection: users/{uid}/friends/{friendUid}
  friendRequests: 'friendRequests',
  matchHistory: 'matchHistory', // subcollection: users/{uid}/matchHistory/{id}
  leaderboard: 'leaderboard',
} as const;

export const RtdbPaths = {
  games: 'games',
  game: (gameId: string) => `games/${gameId}`,
  gameBoard: (gameId: string) => `games/${gameId}/board`,
  gameLine: (gameId: string, lineKey: string) => `games/${gameId}/board/lines/${lineKey}`,
  gamePlayer: (gameId: string, playerId: string) => `games/${gameId}/players/${playerId}`,

  /**
   * Live connection state, kept *out* of the game node. Heartbeats fire every
   * few seconds per player; if they lived in `games/{id}` every one of them
   * would rewrite the game and push a fresh snapshot to every subscriber.
   * Here, the game node only changes when someone actually moves.
   */
  gamePresence: (gameId: string) => `gamePresence/${gameId}`,
  gamePlayerPresence: (gameId: string, playerId: string) => `gamePresence/${gameId}/${playerId}`,

  /**
   * `gameId -> turn deadline (ms)` for every in-progress game — a due-index, so
   * the sweep can ask "what is overdue right now?" instead of downloading every
   * live game every minute. That's the difference between O(active games) and
   * O(overdue games) per sweep, and at a thousand concurrent games it's the
   * difference between pennies and hundreds of dollars of egress.
   *
   * It is only ever a performance hint: no result depends on it. The server
   * re-derives the real deadline from the game itself before acting, so a stale
   * or tampered entry can never cause a wrong verdict — at worst it makes the
   * sweep look at a game that turns out not to be due.
   */
  activeGames: 'activeGames',
  activeGame: (gameId: string) => `activeGames/${gameId}`,
  rooms: 'rooms',
  room: (roomId: string) => `rooms/${roomId}`,
  roomMembers: (roomId: string) => `rooms/${roomId}/members`,
  roomMember: (roomId: string, uid: string) => `rooms/${roomId}/members/${uid}`,
  roomCodeIndex: (code: string) => `roomCodes/${code}`,
  queue: 'matchmaking/queue',
  queueTicket: (uid: string) => `matchmaking/queue/${uid}`,
  presence: (uid: string) => `presence/${uid}`,
} as const;
