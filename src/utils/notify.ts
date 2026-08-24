import { Alert } from 'react-native';

/**
 * Standard failure alert for a user-initiated action whose write was refused or
 * threw. Centralised so every fire-and-forget handler surfaces failures the same
 * way instead of each re-inventing the copy (or, worse, leaking an uncaught
 * rejection). Pair it with a try/catch, or a store action that resolves to a
 * boolean.
 */
export function alertActionFailed(title: string): void {
  Alert.alert(title, 'Please check your connection and try again.');
}
