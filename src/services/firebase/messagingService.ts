import { userRepository } from './userRepository';

/**
 * Cloud Messaging integration point.
 *
 * The Firebase *JS* SDK's `firebase/messaging` is web-only and does not deliver
 * push on native React Native. To enable FCM on devices, build a custom dev
 * client and bridge one of:
 *   - `expo-notifications` (recommended with Expo) for token + handlers, or
 *   - `@react-native-firebase/messaging` for direct FCM.
 *
 * This service owns the *app-side contract* (acquire a token, persist it, handle
 * taps) so the rest of the codebase is already wired; only `acquireToken` needs a
 * concrete native implementation. Token persistence and targeting are real today.
 */
export const messagingService = {
  /**
   * Acquire a device push token. Returns null until a native provider is wired
   * (see module docs). Replace the body with expo-notifications'
   * `getDevicePushTokenAsync()` / `getExpoPushTokenAsync()` in the dev client.
   */
  async acquireToken(): Promise<string | null> {
    return null;
  },

  /** Register the current device for push and persist its token for the user. */
  async registerForUser(uid: string): Promise<void> {
    const token = await this.acquireToken();
    if (token) await userRepository.savePushToken(uid, token);
  },
};
