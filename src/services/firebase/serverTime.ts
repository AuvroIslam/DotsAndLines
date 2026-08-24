import { onValue, ref } from 'firebase/database';

import { realtimeDb } from './config';

/**
 * The time the *server* thinks it is.
 *
 * Turn deadlines are written by the server (`turnStartedAt + turnDurationMs`),
 * but the countdown was being measured against the device's own clock. Phone
 * clocks drift, and a user can simply set theirs wrong: a device running a minute
 * fast shows every turn as already expired, and one running slow never fires a
 * timeout at all, leaving the game to crawl along on the once-a-minute sweep.
 *
 * RTDB tells us how far off we are, so use that rather than `Date.now()` for
 * anything compared against a server timestamp. This is a *correctness* fix for
 * the UI, not a security one — the server re-derives every deadline from its own
 * clock before acting, so a lying client can only mislead itself.
 */

let offsetMs = 0;

// `.info/serverTimeOffset` is maintained locally by the SDK and updates as the
// connection's round-trip estimate improves. Subscribing once at module load is
// enough; there is nothing to tear down for the app's lifetime.
onValue(ref(realtimeDb, '.info/serverTimeOffset'), (snap) => {
  const value = snap.val() as number | null;
  if (typeof value === 'number' && Number.isFinite(value)) offsetMs = value;
});

/** Current server time in epoch ms, corrected for this device's clock skew. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** How far this device's clock is from the server's, in ms (for diagnostics). */
export function clockSkewMs(): number {
  return offsetMs;
}
