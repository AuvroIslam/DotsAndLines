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
  rooms: 'rooms',
  room: (roomId: string) => `rooms/${roomId}`,
  roomMembers: (roomId: string) => `rooms/${roomId}/members`,
  roomMember: (roomId: string, uid: string) => `rooms/${roomId}/members/${uid}`,
  roomCodeIndex: (code: string) => `roomCodes/${code}`,
  queue: 'matchmaking/queue',
  queueTicket: (uid: string) => `matchmaking/queue/${uid}`,
  presence: (uid: string) => `presence/${uid}`,
} as const;
