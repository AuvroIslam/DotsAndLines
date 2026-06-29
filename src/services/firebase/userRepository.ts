import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

import type { UserProfile, UserSettings, UserStatistics } from '@/types';

import { firestore } from './config';
import { Collections } from './paths';

const DEFAULT_SETTINGS: Omit<UserSettings, 'uid'> = {
  soundEnabled: true,
  hapticsEnabled: true,
  themePreference: 'system',
  notificationsEnabled: true,
};

const DEFAULT_STATS: Omit<UserStatistics, 'uid'> = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  totalBoxesWon: 0,
  winStreak: 0,
  bestWinStreak: 0,
};

/** Repository for user profile, statistics, and settings in Firestore. */
export const userRepository = {
  async getProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(firestore, Collections.users, uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  },

  /** Create the profile/stats/settings documents for a new user if absent. */
  async ensureProfile(input: {
    uid: string;
    displayName: string;
    photoURL: string | null;
    username: string;
    provider: UserProfile['provider'];
  }): Promise<UserProfile> {
    const ref = doc(firestore, Collections.users, input.uid);
    const existing = await getDoc(ref);
    if (existing.exists()) return existing.data() as UserProfile;

    const now = Date.now();
    const profile: UserProfile = {
      uid: input.uid,
      displayName: input.displayName,
      photoURL: input.photoURL,
      username: input.username,
      provider: input.provider,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(ref, { ...profile, createdAtServer: serverTimestamp() });
    await setDoc(doc(firestore, Collections.statistics, input.uid), {
      uid: input.uid,
      ...DEFAULT_STATS,
    });
    await setDoc(doc(firestore, Collections.settings, input.uid), {
      uid: input.uid,
      ...DEFAULT_SETTINGS,
    });
    return profile;
  },

  async updateProfile(
    uid: string,
    patch: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'username'>>,
  ): Promise<void> {
    await updateDoc(doc(firestore, Collections.users, uid), {
      ...patch,
      updatedAt: Date.now(),
    });
  },

  async isUsernameAvailable(username: string, exceptUid?: string): Promise<boolean> {
    const q = query(
      collection(firestore, Collections.users),
      where('username', '==', username),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return true;
    return exceptUid !== undefined && snap.docs[0]?.id === exceptUid;
  },

  async searchByUsername(prefix: string, max = 10): Promise<UserProfile[]> {
    // Firestore prefix search via range query on the indexed username field.
    const end = prefix + String.fromCharCode(0xf8ff);
    const q = query(
      collection(firestore, Collections.users),
      where('username', '>=', prefix),
      where('username', '<=', end),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  },

  async getStatistics(uid: string): Promise<UserStatistics | null> {
    const snap = await getDoc(doc(firestore, Collections.statistics, uid));
    return snap.exists() ? (snap.data() as UserStatistics) : null;
  },

  async getSettings(uid: string): Promise<UserSettings | null> {
    const snap = await getDoc(doc(firestore, Collections.settings, uid));
    return snap.exists() ? (snap.data() as UserSettings) : null;
  },

  async updateSettings(uid: string, patch: Partial<Omit<UserSettings, 'uid'>>): Promise<void> {
    await updateDoc(doc(firestore, Collections.settings, uid), patch);
  },

  /** Persist a device push token so the backend can target this user via FCM. */
  async savePushToken(uid: string, token: string): Promise<void> {
    await updateDoc(doc(firestore, Collections.users, uid), {
      pushToken: token,
      pushTokenUpdatedAt: Date.now(),
    });
  },
};
