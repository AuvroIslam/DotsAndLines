import { create } from 'zustand';

import { friendRepository, userRepository } from '@/services/firebase';
import type { SendResult } from '@/services/firebase/friendRepository';
import type { Friend, FriendRequest, UserProfile } from '@/types';

interface FriendStoreState {
  friends: Friend[];
  incomingRequests: FriendRequest[];
  searchResults: UserProfile[];
  isSearching: boolean;
  error: string | null;

  /** Subscribe to friends + incoming requests for a user. Returns teardown. */
  subscribe: (uid: string) => () => void;
  search: (prefix: string, selfUid: string) => Promise<void>;
  sendRequest: (from: UserProfile, toUid: string) => Promise<SendResult | null>;
  /** These resolve to `false` (never throw) if the write is refused, so a `void`
   *  call site can't leak an uncaught rejection. */
  acceptRequest: (request: FriendRequest, self: UserProfile) => Promise<boolean>;
  declineRequest: (requestId: string) => Promise<boolean>;
  removeFriend: (selfUid: string, friendUid: string) => Promise<boolean>;
}

export const useFriendStore = create<FriendStoreState>((set) => ({
  friends: [],
  incomingRequests: [],
  searchResults: [],
  isSearching: false,
  error: null,

  subscribe: (uid) => {
    const unsubFriends = friendRepository.subscribeFriends(uid, (friends) => set({ friends }));
    const unsubReq = friendRepository.subscribeIncoming(uid, (incomingRequests) =>
      set({ incomingRequests }),
    );
    return () => {
      unsubFriends();
      unsubReq();
    };
  },

  search: async (prefix, selfUid) => {
    if (prefix.trim().length < 2) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true, error: null });
    try {
      const results = await userRepository.searchByUsername(prefix.trim());
      set({ searchResults: results.filter((u) => u.uid !== selfUid), isSearching: false });
    } catch (e) {
      set({ error: toMessage(e), isSearching: false });
    }
  },

  sendRequest: async (from, toUid) => {
    try {
      return await friendRepository.sendRequest(from, toUid);
    } catch (e) {
      set({ error: toMessage(e) });
      return null;
    }
  },

  acceptRequest: async (request, self) => {
    try {
      await friendRepository.acceptRequest(request, self);
      return true;
    } catch (e) {
      set({ error: toMessage(e) });
      return false;
    }
  },

  declineRequest: async (requestId) => {
    try {
      await friendRepository.declineRequest(requestId);
      return true;
    } catch (e) {
      set({ error: toMessage(e) });
      return false;
    }
  },

  removeFriend: async (selfUid, friendUid) => {
    try {
      await friendRepository.removeFriend(selfUid, friendUid);
      return true;
    } catch (e) {
      set({ error: toMessage(e) });
      return false;
    }
  },
}));

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
