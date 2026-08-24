import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useAuthStore } from '@/store';

// Required for the OAuth redirect to dismiss the in-app browser on return.
WebBrowser.maybeCompleteAuthSession();

// Google rejects the web client on native (it only allows https redirects, and
// native redirects to a custom scheme), so each platform needs its own OAuth
// client. Without one, expo-auth-session silently falls back to the web client
// and Google answers with an opaque `Error 400: invalid_request`.
const platformClientId = Platform.select({
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

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
    ready: !!request && !!platformClientId,
    submitting,
    signIn: () => promptAsync(),
  };
}
