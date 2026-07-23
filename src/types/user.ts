/**
 * User, social, and persistence domain types.
 * These map to Cloud Firestore documents (see services/firebase).
 */

export type AuthProvider = 'anonymous' | 'google';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  /** Short searchable tag, e.g. for friend lookups. Unique. */
  username: string;
  provider: AuthProvider;
  createdAt: number;
  updatedAt: number;
}

export interface UserStatistics {
  uid: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  totalBoxesWon: number;
  winStreak: number;
  bestWinStreak: number;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromDisplayName: string;
  fromUsername: string;
  /** Snapshot so accepting needs no extra read to build the friendship. */
  fromPhotoURL: string | null;
  status: FriendRequestStatus;
  createdAt: number;
}

/** The display fields a friendship caches for one member, so the list renders from one query. */
export interface FriendProfileSnapshot {
  displayName: string;
  username: string;
  photoURL: string | null;
}

/**
 * A friendship as a single shared edge document, keyed by the sorted uid pair.
 * `users` drives the `array-contains` query ("my friends"); `profiles` carries a
 * light snapshot of each member so the list needs no per-friend profile read.
 * Presence (online/offline) is NOT stored here — it's read live from RTDB.
 */
export interface Friendship {
  users: string[];
  profiles: Record<string, FriendProfileSnapshot>;
  createdAt: number;
}

/** A friend as rendered in the list — derived from a Friendship, not stored. */
export interface Friend {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string | null;
  since: number;
}

export type MatchOutcome = 'win' | 'loss' | 'draw';

export interface MatchHistoryEntry {
  id: string;
  gameId: string;
  mode: 'friend' | 'random';
  boardSize: number;
  playerCount: number;
  outcome: MatchOutcome;
  myScore: number;
  opponents: { uid: string; displayName: string; score: number }[];
  playedAt: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  wins: number;
  gamesPlayed: number;
  rank: number;
}

export interface UserSettings {
  uid: string;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  themePreference: 'system' | 'light' | 'dark';
  notificationsEnabled: boolean;
}
