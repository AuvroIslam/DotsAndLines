import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import type { Friend, FriendRequest, UserProfile } from '@/types';

import { firestore } from './config';
import { Collections } from './paths';

function friendRequestId(fromUid: string, toUid: string): string {
  return `${fromUid}_${toUid}`;
}

/**
 * Repository for the social graph: friend requests and the friends subcollection.
 * Accepting a request writes a friend doc to *both* users in one atomic batch.
 */
export const friendRepository = {
  async sendRequest(from: UserProfile, toUid: string): Promise<void> {
    const id = friendRequestId(from.uid, toUid);
    const request: FriendRequest = {
      id,
      fromUid: from.uid,
      toUid,
      fromDisplayName: from.displayName,
      fromUsername: from.username,
      status: 'pending',
      createdAt: Date.now(),
    };
    await setDoc(doc(firestore, Collections.friendRequests, id), {
      ...request,
      createdAtServer: serverTimestamp(),
    });
  },

  subscribeIncoming(uid: string, cb: (requests: FriendRequest[]) => void): () => void {
    const q = query(
      collection(firestore, Collections.friendRequests),
      where('toUid', '==', uid),
      where('status', '==', 'pending'),
    );
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => d.data() as FriendRequest));
    });
  },

  subscribeFriends(uid: string, cb: (friends: Friend[]) => void): () => void {
    const ref = collection(firestore, Collections.users, uid, Collections.friends);
    return onSnapshot(ref, (snap) => {
      cb(snap.docs.map((d) => d.data() as Friend));
    });
  },

  async getFriends(uid: string): Promise<Friend[]> {
    const ref = collection(firestore, Collections.users, uid, Collections.friends);
    const snap = await getDocs(ref);
    return snap.docs.map((d) => d.data() as Friend);
  },

  /** Accept a request: create reciprocal friend docs and mark request accepted. */
  async acceptRequest(request: FriendRequest, accepter: UserProfile): Promise<void> {
    const requesterProfileSnap = await getDocs(
      query(collection(firestore, Collections.users), where('uid', '==', request.fromUid)),
    );
    const requester = requesterProfileSnap.docs[0]?.data() as UserProfile | undefined;
    if (!requester) throw new Error('Requesting user no longer exists');

    const now = Date.now();
    const batch = writeBatch(firestore);

    const accepterFriend: Friend = {
      uid: accepter.uid,
      displayName: accepter.displayName,
      username: accepter.username,
      photoURL: accepter.photoURL,
      isOnline: false,
      since: now,
    };
    const requesterFriend: Friend = {
      uid: requester.uid,
      displayName: requester.displayName,
      username: requester.username,
      photoURL: requester.photoURL,
      isOnline: false,
      since: now,
    };

    batch.set(
      doc(firestore, Collections.users, accepter.uid, Collections.friends, requester.uid),
      requesterFriend,
    );
    batch.set(
      doc(firestore, Collections.users, requester.uid, Collections.friends, accepter.uid),
      accepterFriend,
    );
    batch.delete(doc(firestore, Collections.friendRequests, request.id));

    await batch.commit();
  },

  async declineRequest(requestId: string): Promise<void> {
    await deleteDoc(doc(firestore, Collections.friendRequests, requestId));
  },

  async removeFriend(uid: string, friendUid: string): Promise<void> {
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, Collections.users, uid, Collections.friends, friendUid));
    batch.delete(doc(firestore, Collections.users, friendUid, Collections.friends, uid));
    await batch.commit();
  },
};
