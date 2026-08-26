import {
  GoogleAuthProvider,
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
 *
 * Anonymous auth is intentionally absent: "Guest" mode is a pure local
 * session (no Firebase account created), so no backend resources are consumed
 * and the app is immune to anonymous-account spam attacks.
 */
export const authService = {
  getCurrentUser(): FirebaseUser | null {
    return firebaseAuth.currentUser;
  },

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(firebaseAuth, callback);
  },

  /** Exchange a Google OAuth id token for a Firebase session. */
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

