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
  status: FriendRequestStatus;
  createdAt: number;
}

export interface Friend {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string | null;
  /** Realtime-Database-backed presence flag, denormalized for list rendering. */
  isOnline: boolean;
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
