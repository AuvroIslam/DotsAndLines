import { onDisconnect, onValue, ref, serverTimestamp, set } from 'firebase/database';

import { realtimeDb } from './config';
import { RtdbPaths } from './paths';

export interface PresenceState {
  isOnline: boolean;
  lastSeen: number | object;
}

/**
 * Connection-aware presence using RTDB's special `.info/connected` node and
 * `onDisconnect` hooks, so a player is marked offline automatically even if the
 * app is killed or loses network without a clean sign-out.
 */
export const presenceRepository = {
  /** Begin tracking presence for `uid`. Returns an unsubscribe/teardown fn. */
  track(uid: string): () => void {
    const userStatusRef = ref(realtimeDb, RtdbPaths.presence(uid));
    const connectedRef = ref(realtimeDb, '.info/connected');

    const unsub = onValue(connectedRef, async (snap) => {
      if (snap.val() === false) return;
      // Register the offline write first so it survives an abrupt disconnect.
      await onDisconnect(userStatusRef).set({ isOnline: false, lastSeen: serverTimestamp() });
      await set(userStatusRef, { isOnline: true, lastSeen: serverTimestamp() });
    });

    return () => {
      unsub();
      // Best-effort immediate offline on graceful teardown.
      void set(userStatusRef, { isOnline: false, lastSeen: serverTimestamp() });
    };
  },

  subscribe(uid: string, cb: (state: PresenceState | null) => void): () => void {
    return onValue(ref(realtimeDb, RtdbPaths.presence(uid)), (snap) =>
      cb(snap.val() as PresenceState | null),
    );
  },
};
