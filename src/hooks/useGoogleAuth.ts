import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useState } from 'react';

import { useAuthStore } from '@/store';

// Configure once globally
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  scopes: ['profile', 'email'],
});

/**
 * Encapsulates native Google Sign-In and hands the resulting ID token
 * to Firebase Auth via the auth store.
 */
export function useGoogleAuth() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [submitting, setSubmitting] = useState(false);

  const signIn = async () => {
    try {
      setSubmitting(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (!idToken) {
          throw new Error('Google Sign-In succeeded but no ID token was returned.');
        }
        await signInWithGoogle(idToken);
      }
    } catch (error: any) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // User cancelled the login flow - no action required
            break;
          case statusCodes.IN_PROGRESS:
            // Operation is in progress already
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
    } finally {
      setSubmitting(false);
    }
  };

  return {
    ready: true,
    submitting,
    signIn,
  };
}

