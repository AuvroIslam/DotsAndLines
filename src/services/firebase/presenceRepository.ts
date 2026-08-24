import { onValue, ref, serverTimestamp } from 'firebase/database';

import { realtimeDb } from './config';
import { trackRefConnection } from './connectionTracking';
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
    return trackRefConnection(
      userStatusRef,
      { isOnline: true, lastSeen: serverTimestamp() },
      { isOnline: false, lastSeen: serverTimestamp() },
    );
  },

  subscribe(uid: string, cb: (state: PresenceState | null) => void): () => void {
    return onValue(ref(realtimeDb, RtdbPaths.presence(uid)), (snap) =>
      cb(snap.val() as PresenceState | null),
    );
  },
};
