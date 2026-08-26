import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { authService, userRepository, type FirebaseUser } from '@/services/firebase';
import type { AuthProvider, UserProfile } from '@/types';
import { generateUsername } from '@/utils';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

export const GUEST_USER_ID = 'local_guest';
const GUEST_SESSION_KEY = '@dots_guest_session';

export function createGuestProfile(name = 'Guest Player'): UserProfile {
  const now = Date.now();
  return {
    uid: GUEST_USER_ID,
    displayName: name,
    photoURL: null,
    username: 'guest',
    provider: 'anonymous',
    createdAt: now,
    updatedAt: now,
  };
}

interface AuthState {
  status: AuthStatus;
  user: FirebaseUser | null;
  profile: UserProfile | null;
  error: string | null;

  /** Subscribe to Firebase auth changes and restore guest session. Call once at app start. Returns teardown. */
  initialize: () => () => void;
  signInAsGuest: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
  refreshProfile: () => Promise<void>;
}

/**
 * Owns authentication/session state. UI components read `status`/`profile` and
 * call actions; all Firebase orchestration lives here, never in screens.
 *
 * Guest mode is 100% local — no Firebase Auth or Firestore records are created,
 * keeping the app immune to anonymous-account spam attacks and completely offline-capable.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'initializing',
  user: null,
  profile: null,
  error: null,

  initialize: () => {
    return authService.onAuthStateChanged(async (user) => {
      if (user) {
        // If an old legacy anonymous session is detected, purge it
        if (user.isAnonymous) {
          await authService.signOut();
          return;
        }
        // Google-authenticated user
        await AsyncStorage.removeItem(GUEST_SESSION_KEY);
        try {
          const profile = await userRepository.ensureProfile({
            uid: user.uid,
            displayName: user.displayName ?? 'Player',
            photoURL: user.photoURL,
            username: generateUsername(user.uid),
            provider: 'google',
          });
          set({ status: 'authenticated', user, profile, error: null });
        } catch (e) {
          set({ status: 'authenticated', user, error: toMessage(e) });
        }
      } else {
        // No Firebase user. Check if we have an active local guest session.
        const isGuest = await AsyncStorage.getItem(GUEST_SESSION_KEY);
        if (isGuest === 'true') {
          set({
            status: 'authenticated',
            user: null,
            profile: createGuestProfile(),
            error: null,
          });
        } else {
          set({ status: 'unauthenticated', user: null, profile: null });
        }
      }
    });
  },

  signInAsGuest: async () => {
    set({ error: null });
    await AsyncStorage.setItem(GUEST_SESSION_KEY, 'true');
    set({
      status: 'authenticated',
      user: null,
      profile: createGuestProfile(),
      error: null,
    });
  },

  signInAnonymously: async () => {
    await get().signInAsGuest();
  },

  signInWithGoogle: async (idToken) => {
    set({ error: null });
    await AsyncStorage.removeItem(GUEST_SESSION_KEY);
    try {
      await authService.signInWithGoogle(idToken);
    } catch (e) {
      set({ error: toMessage(e) });
      throw e;
    }
  },

  signOut: async () => {
    await AsyncStorage.removeItem(GUEST_SESSION_KEY);
    if (authService.getCurrentUser()) {
      await authService.signOut();
    }
    set({ status: 'unauthenticated', user: null, profile: null });
  },

  setProfile: (profile) => set({ profile }),

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return; // Guests have no remote profile
    const profile = await userRepository.getProfile(user.uid);
    if (profile) set({ profile });
  },
}));

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

