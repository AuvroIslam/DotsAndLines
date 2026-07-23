import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import type { Friend, FriendRequest, Friendship, UserProfile } from '@/types';
import { createLogger } from '@/utils';

import { firestore } from './config';
import { Collections } from './paths';

const log = createLogger('FRIENDS');

/** A friend request is directional; its id encodes the direction. */
function requestId(fromUid: string, toUid: string): string {
  return `${fromUid}_${toUid}`;
}

/** A friendship is symmetric; its id is the sorted pair, so both sides agree on one doc. */
function friendshipId(a: string, b: string): string {
  return [a, b].sort().join('_');
}

function snapshotOf(p: {
  displayName: string;
  username: string;
  photoURL: string | null;
}): { displayName: string; username: string; photoURL: string | null } {
  return { displayName: p.displayName, username: p.username, photoURL: p.photoURL ?? null };
}

export type SendResult = 'sent' | 'befriended' | 'already-friends' | 'already-requested';

/**
 * The social graph, stored to minimise both writes and duplication:
 *  - a friendship is ONE shared edge doc (`friendships/{sortedPair}`), not two
 *    reciprocal copies, so creating/removing a friend is a single write and a
 *    friend's profile is never copied twice;
 *  - the edge carries a light per-member snapshot, so the friends list renders
 *    from one `array-contains` query with no per-friend profile read;
 *  - online status is NOT stored here — it's read live from RTDB presence.
 */
export const friendRepository = {
  /**
   * Send a friend request — or, if the other person already asked, just become
   * friends. Guards against duplicates and the mutual-request mess with cheap
   * reads (a read is far cheaper than the redundant write it prevents).
   */
  async sendRequest(from: UserProfile, toUid: string): Promise<SendResult> {
    if (from.uid === toUid) return 'already-friends'; // no self-friending

    // Already friends? Nothing to do.
    const pairRef = doc(firestore, Collections.friendships, friendshipId(from.uid, toUid));
    if ((await getDoc(pairRef)).exists()) return 'already-friends';

    // They already asked us — accept instead of stacking a reverse request.
    const reverseRef = doc(firestore, Collections.friendRequests, requestId(toUid, from.uid));
    const reverse = await getDoc(reverseRef);
    if (reverse.exists()) {
      await this.acceptRequest(reverse.data() as FriendRequest, from);
      return 'befriended';
    }

    // We already have a pending request out to them.
    const forwardRef = doc(firestore, Collections.friendRequests, requestId(from.uid, toUid));
    if ((await getDoc(forwardRef)).exists()) return 'already-requested';

    const request: FriendRequest = {
      id: requestId(from.uid, toUid),
      fromUid: from.uid,
      toUid,
      fromDisplayName: from.displayName,
      fromUsername: from.username,
      fromPhotoURL: from.photoURL ?? null,
      status: 'pending',
      createdAt: Date.now(),
    };
    await setDoc(forwardRef, { ...request, createdAtServer: serverTimestamp() });
    return 'sent';
  },

  subscribeIncoming(uid: string, cb: (requests: FriendRequest[]) => void): () => void {
    const q = query(
      collection(firestore, Collections.friendRequests),
      where('toUid', '==', uid),
      where('status', '==', 'pending'),
    );
    // An error handler is mandatory: without it a transient listener error (a
    // token refresh mid-attach, a rules-propagation blip) escapes as an uncaught
    // promise rejection and pops a "Missing or insufficient permissions" toast
    // over a feature that is otherwise working. The SDK re-attaches on its own, so
    // logging is the right response.
    return onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => d.data() as FriendRequest)),
      (e) => log.error('incoming-requests listener error (retrying)', describe(e)),
    );
  },

  /**
   * Watch my friends via the single edge collection: one `array-contains` query,
   * rendered straight from each edge's cached snapshot — no per-friend read.
   */
  subscribeFriends(uid: string, cb: (friends: Friend[]) => void): () => void {
    const q = query(
      collection(firestore, Collections.friendships),
      where('users', 'array-contains', uid),
    );
    return onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => friendView(uid, d.data() as Friendship)).filter(isFriend)),
      (e) => log.error('friends listener error (retrying)', describe(e)),
    );
  },

  /**
   * Accept a request: create the one shared friendship edge and delete the
   * request (and any reverse one) in a single atomic batch. No profile read —
   * both members' display fields are already in hand (mine, and the requester's
   * from the request snapshot).
   */
  async acceptRequest(request: FriendRequest, accepter: UserProfile): Promise<void> {
    const batch = writeBatch(firestore);

    const friendship: Friendship = {
      users: [request.fromUid, request.toUid].sort(),
      profiles: {
        [request.fromUid]: {
          displayName: request.fromDisplayName,
          username: request.fromUsername,
          photoURL: request.fromPhotoURL ?? null,
        },
        [accepter.uid]: snapshotOf(accepter),
      },
      createdAt: Date.now(),
    };

    batch.set(
      doc(firestore, Collections.friendships, friendshipId(request.fromUid, request.toUid)),
      { ...friendship, createdAtServer: serverTimestamp() },
    );
    batch.delete(doc(firestore, Collections.friendRequests, request.id));
    // Kill a reverse request too, so accepting a mutual pair leaves nothing dangling.
    batch.delete(
      doc(firestore, Collections.friendRequests, requestId(request.toUid, request.fromUid)),
    );

    await batch.commit();
  },

  async declineRequest(requestId: string): Promise<void> {
    await deleteDoc(doc(firestore, Collections.friendRequests, requestId));
  },

  /** Unfriend: delete the single shared edge. One write, both sides removed. */
  async removeFriend(uid: string, friendUid: string): Promise<void> {
    await deleteDoc(doc(firestore, Collections.friendships, friendshipId(uid, friendUid)));
  },
};

/** Project a friendship edge into the viewer's Friend row (the other member). */
function friendView(me: string, f: Friendship): Friend | null {
  const otherUid = f.users.find((u) => u !== me);
  if (!otherUid) return null;
  const p = f.profiles?.[otherUid];
  return {
    uid: otherUid,
    displayName: p?.displayName ?? 'Player',
    username: p?.username ?? '',
    photoURL: p?.photoURL ?? null,
    since: f.createdAt,
  };
}

function isFriend(f: Friend | null): f is Friend {
  return f !== null;
}

function describe(e: unknown): { code?: string; message: string } {
  const err = e as { code?: string; message?: string };
  return { code: err?.code, message: err?.message ?? String(e) };
}
