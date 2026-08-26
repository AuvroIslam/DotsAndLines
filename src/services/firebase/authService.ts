import {
  GoogleAuthProvider,
  linkWithCredential,
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

  /**
   * Upgrade the current anonymous account to a Google account in-place.
   * The uid stays the same, so all Firestore data (stats, history, friends)
   * is preserved without any migration.
   *
   * If the Google credential already belongs to another Firebase account
   * (`auth/credential-already-in-use`), we fall back to signing in with that
   * existing Google account directly — the anonymous session is abandoned.
   */
  async linkWithGoogle(idToken: string): Promise<FirebaseUser> {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const credential = GoogleAuthProvider.credential(idToken);
    try {
      const cred = await linkWithCredential(user, credential);
      return cred.user;
    } catch (error: any) {
      if (error?.code === 'auth/credential-already-in-use') {
        // The Google account is already linked to a different Firebase user.
        // Sign in with it directly — switches to the existing Google account.
        const cred = await signInWithCredential(firebaseAuth, credential);
        return cred.user;
      }
      throw error;
    }
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
