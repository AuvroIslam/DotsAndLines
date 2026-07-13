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
  // Read-only from the client: game state is written exclusively by the server.
  game: (gameId: string) => `games/${gameId}`,

  /**
   * Live connection state, kept *out* of the game node. Heartbeats fire every
   * few seconds per player; if they lived in `games/{id}` every one of them
   * would rewrite the game and push a fresh snapshot to every subscriber.
   * Here, the game node only changes when someone actually moves.
   */
  gamePresence: (gameId: string) => `gamePresence/${gameId}`,
  gamePlayerPresence: (gameId: string, playerId: string) => `gamePresence/${gameId}/${playerId}`,

  // The game-lifecycle due-indexes (`activeGames`, `pendingResults`,
  // `finishedGames`) are written and read only by the server — see
  // `lifecyclePaths` in functions/src/authority.ts. Clients never touch them.

  rooms: 'rooms',
  room: (roomId: string) => `rooms/${roomId}`,
  roomMembers: (roomId: string) => `rooms/${roomId}/members`,
  roomMember: (roomId: string, uid: string) => `rooms/${roomId}/members/${uid}`,
  roomCodeIndex: (code: string) => `roomCodes/${code}`,
  queue: 'matchmaking/queue',
  queueTicket: (uid: string) => `matchmaking/queue/${uid}`,
  presence: (uid: string) => `presence/${uid}`,
} as const;
