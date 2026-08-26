import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { configureGoogleSignIn } from '@/services/auth/googleAuth';
import { useAuthStore } from '@/store';

/**
 * Returns a `guard()` async function that online-feature handlers should call
 * before proceeding. If the user is already signed in with Google, `guard()`
 * resolves to `true` immediately. If the user is a guest (anonymous), it shows
 * a confirmation Alert and — on acceptance — triggers the Google sign-in flow
 * to sign in directly, unlocking online features and loading their cloud profile.
 *
 * Usage:
 * ```ts
 * const { guard } = useRequireGoogleAuth();
 * const handlePlay = async () => {
 *   if (!(await guard())) return;
 *   matchmaking.start();
 * };
 * ```
 */
export function useRequireGoogleAuth() {
  const profile = useAuthStore((s) => s.profile);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const busyRef = useRef(false);

  const guard = useCallback(async (): Promise<boolean> => {
    // Already a Google user — nothing to do.
    if (profile?.provider === 'google') return true;

    // Prevent double-taps while an alert/sign-in is in progress.
    if (busyRef.current) return false;
    busyRef.current = true;

    try {
      // Show a confirmation dialog first.
      const accepted = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Sign in required',
          'Online features need a Google account. Sign in now to play online and save your progress!',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Sign In', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });

      if (!accepted) return false;

      // Ensure Google Sign-In is configured globally before checking Play Services
      configureGoogleSignIn();

      // Trigger the native Google sign-in.
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (!idToken) {
          console.error('Google Sign-In succeeded but no ID token was returned.');
          return false;
        }
        await signInWithGoogle(idToken);
        return true;
      }
      return false;
    } catch (error: any) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            break; // user cancelled — silent
          case statusCodes.IN_PROGRESS:
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            console.error('Google Play Services is not available or outdated.');
            break;
          default:
            console.error('Google Sign-In error:', error);
        }
      } else {
        console.error('Unexpected error during Google Sign-In:', error);
      }
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [profile?.provider, signInWithGoogle]);

  return { guard };
}

