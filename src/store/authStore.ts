import { create } from 'zustand';

import { authService, userRepository, type FirebaseUser } from '@/services/firebase';
import type { AuthProvider, UserProfile } from '@/types';
import { generateUsername } from '@/utils';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: FirebaseUser | null;
  profile: UserProfile | null;
  error: string | null;

  /** Subscribe to Firebase auth changes. Call once at app start. Returns teardown. */
  initialize: () => () => void;
  signInAnonymously: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
  refreshProfile: () => Promise<void>;
}

function providerOf(user: FirebaseUser): AuthProvider {
  return user.isAnonymous ? 'anonymous' : 'google';
}

/**
 * Owns authentication/session state. UI components read `status`/`profile` and
 * call actions; all Firebase orchestration lives here, never in screens.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'initializing',
  user: null,
  profile: null,
  error: null,

  initialize: () => {
    return authService.onAuthStateChanged(async (user) => {
      if (!user) {
        set({ status: 'unauthenticated', user: null, profile: null });
        return;
      }
      try {
        const profile = await userRepository.ensureProfile({
          uid: user.uid,
          displayName: user.displayName ?? 'Player',
          photoURL: user.photoURL,
          username: generateUsername(user.uid),
          provider: providerOf(user),
        });
        set({ status: 'authenticated', user, profile, error: null });
      } catch (e) {
        set({ status: 'authenticated', user, error: toMessage(e) });
      }
    });
  },

  signInAnonymously: async () => {
    set({ error: null });
    try {
      await authService.signInAnonymously();
    } catch (e) {
      set({ error: toMessage(e) });
      throw e;
    }
  },

  signInWithGoogle: async (idToken) => {
    set({ error: null });
    try {
      await authService.signInWithGoogle(idToken);
    } catch (e) {
      set({ error: toMessage(e) });
      throw e;
    }
  },

  signOut: async () => {
    await authService.signOut();
    set({ status: 'unauthenticated', user: null, profile: null });
  },

  setProfile: (profile) => set({ profile }),

  refreshProfile: async () => {
    const uid = get().user?.uid;
    if (!uid) return;
    const profile = await userRepository.getProfile(uid);
    if (profile) set({ profile });
  },
}));

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
