import { onDisconnect, onValue, ref, update, type DatabaseReference } from 'firebase/database';

import { realtimeDb } from './config';

/**
 * Watches RTDB's `.info/connected` and keeps `targetRef` reflecting this
 * client's connection state, using `onDisconnect` so an abrupt disconnect
 * (app kill, network loss) is reflected server-side with no client action.
 * Shared by global presence and per-game connection tracking so this ordering
 * — register the offline write before the online one, so it survives a crash
 * mid-setup — isn't duplicated.
 */
export function trackRefConnection(
  targetRef: DatabaseReference,
  onlinePayload: object,
  offlinePayload: object,
): () => void {
  const connectedRef = ref(realtimeDb, '.info/connected');

  const unsub = onValue(connectedRef, async (snap) => {
    if (snap.val() === false) return;
    await onDisconnect(targetRef).update(offlinePayload);
    await update(targetRef, onlinePayload);
  });

  return () => {
    unsub();
    void update(targetRef, offlinePayload);
  };
}
