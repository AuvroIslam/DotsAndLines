/** Centralized Firestore collection names and Realtime Database path builders. */

export const Collections = {
  users: 'users',
  statistics: 'statistics',
  settings: 'settings',
  friendRequests: 'friendRequests',
  // One shared edge doc per friendship, keyed by the sorted uid pair. Replaces
  // the old two reciprocal `users/{uid}/friends/{friendUid}` docs.
  friendships: 'friendships',
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

  /**
   * Per-user index of live games the player is a member of. Server-written,
   * read-only for the owner. The client's active-game watcher subscribes here to
   * route a player into a match made while they were elsewhere.
   */
  userActiveGames: (uid: string) => `userActiveGames/${uid}`,

  rooms: 'rooms',
  room: (roomId: string) => `rooms/${roomId}`,
  roomMembers: (roomId: string) => `rooms/${roomId}/members`,
  roomMember: (roomId: string, uid: string) => `rooms/${roomId}/members/${uid}`,
  /** Marker of a friend the host invited to this room; lets the sweep clear their invite. */
  roomInvitedUid: (roomId: string, uid: string) => `rooms/${roomId}/invitedUids/${uid}`,
  roomCodeIndex: (code: string) => `roomCodes/${code}`,
  /** Due-index for room cleanup: when the sweep should next consider deleting a room. */
  staleRoom: (roomId: string) => `staleRooms/${roomId}`,
  /** Per-recipient game invitations. The invitee reads their own; the inviter writes one. */
  gameInvites: (uid: string) => `gameInvites/${uid}`,
  gameInvite: (uid: string, roomId: string) => `gameInvites/${uid}/${roomId}`,
  queue: 'matchmaking/queue',
  queueTicket: (uid: string) => `matchmaking/queue/${uid}`,
  presence: (uid: string) => `presence/${uid}`,
} as const;
