import { LocalCollection } from './store';

export interface PresenceState {
  isOnline: boolean;
  lastSeen: number;
}

const presence = new LocalCollection<PresenceState>();

/**
 * In-memory replica of `services/firebase/presenceRepository` — same method
 * signatures, no network. There's no real disconnect to detect in-process,
 * so presence just tracks online/offline around the `track()` call's lifetime.
 */
export const presenceRepository = {
  /** Begin tracking presence for `uid`. Returns an unsubscribe/teardown fn. */
  track(uid: string): () => void {
    presence.set(uid, { isOnline: true, lastSeen: Date.now() });
    return () => {
      presence.set(uid, { isOnline: false, lastSeen: Date.now() });
    };
  },

  subscribe(uid: string, cb: (state: PresenceState | null) => void): () => void {
    return presence.subscribe(uid, cb);
  },
};
