import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { useAuthStore } from '@/store';

// Required for the OAuth redirect to dismiss the in-app browser on return.
WebBrowser.maybeCompleteAuthSession();

/**
 * Encapsulates the Google OAuth (id-token) flow via expo-auth-session and hands
 * the resulting token to the auth store. UI only calls `promptAsync()`.
 */
export function useGoogleAuth() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [submitting, setSubmitting] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    if (!idToken) return;
    setSubmitting(true);
    signInWithGoogle(idToken).finally(() => setSubmitting(false));
  }, [response, signInWithGoogle]);

  return {
    /** Whether the OAuth config is loaded and ready to prompt. */
    ready: !!request,
    submitting,
    signIn: () => promptAsync(),
  };
}
