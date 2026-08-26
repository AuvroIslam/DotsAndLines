import { GoogleSignin } from '@react-native-google-signin/google-signin';

let configured = false;

/**
 * Configure Google Sign-In globally once.
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ['profile', 'email'],
  });
  configured = true;
}
