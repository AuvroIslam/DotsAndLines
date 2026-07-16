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

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() === false) return;
    void (async () => {
      await onDisconnect(targetRef).update(offlinePayload);
      await update(targetRef, onlinePayload);
    })().catch(swallow);
  });

  return () => {
    unsub();
    void update(targetRef, offlinePayload).catch(swallow);
  };
}

/**
 * Presence is cosmetic — it drives an "opponent is away" hint, and the server
 * resolves an absent player by their missed turns regardless. So a failed write
 * must never surface as an error: these are fire-and-forget, and an unhandled
 * rejection here put a full-screen `PERMISSION_DENIED` over a working game.
 *
 * A rejection is expected in ordinary play: the rules only allow a player to
 * write their own slot in a game that still exists, so a write that races a
 * finished game's cleanup — or one left in flight while navigating away — is
 * denied, correctly.
 */
function swallow(): void {}
