import {
  GoogleAuthProvider,
  signInAnonymously,
  signInWithCredential,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';

import { firebaseAuth } from './config';

/**
 * Thin adapter over Firebase Auth. Knows nothing about app stores or UI;
 * higher layers (authStore / hooks) orchestrate state from these primitives.
 */
export const authService = {
  getCurrentUser(): FirebaseUser | null {
    return firebaseAuth.currentUser;
  },

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(firebaseAuth, callback);
  },

  async signInAnonymously(): Promise<FirebaseUser> {
    const cred = await signInAnonymously(firebaseAuth);
    return cred.user;
  },

  /** Exchange a Google OAuth id token (from expo-auth-session) for a session. */
  async signInWithGoogle(idToken: string): Promise<FirebaseUser> {
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(firebaseAuth, credential);
    return cred.user;
  },

  async updateDisplayName(displayName: string, photoURL?: string | null): Promise<void> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await updateProfile(user, { displayName, photoURL: photoURL ?? user.photoURL });
  },

  async signOut(): Promise<void> {
    await fbSignOut(firebaseAuth);
  },
};

export type { FirebaseUser };
