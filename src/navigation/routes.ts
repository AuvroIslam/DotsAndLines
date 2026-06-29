/** Typed route path helpers so navigation calls stay consistent across the app. */
export const Routes = {
  signIn: '/(auth)/sign-in',
  home: '/(app)/home',
  friends: '/(app)/friends',
  friendRequests: '/(app)/friend-requests',
  createRoom: '/(app)/create-room',
  joinRoom: '/(app)/join-room',
  lobby: (roomId: string) => ({ pathname: '/(app)/lobby/[roomId]', params: { roomId } }) as const,
  game: (gameId: string) => ({ pathname: '/(app)/game/[gameId]', params: { gameId } }) as const,
  history: '/(app)/history',
  profile: '/(app)/profile',
  settings: '/(app)/settings',
  statistics: '/(app)/statistics',
} as const;
