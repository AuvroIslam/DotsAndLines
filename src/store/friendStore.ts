import { create } from 'zustand';

import { friendRepository, userRepository } from '@/services/firebase';
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
  sendRequest: (from: UserProfile, toUid: string) => Promise<void>;
  acceptRequest: (request: FriendRequest, self: UserProfile) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  removeFriend: (selfUid: string, friendUid: string) => Promise<void>;
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
    await friendRepository.sendRequest(from, toUid);
  },

  acceptRequest: async (request, self) => {
    await friendRepository.acceptRequest(request, self);
  },

  declineRequest: async (requestId) => {
    await friendRepository.declineRequest(requestId);
  },

  removeFriend: async (selfUid, friendUid) => {
    await friendRepository.removeFriend(selfUid, friendUid);
  },
}));

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
