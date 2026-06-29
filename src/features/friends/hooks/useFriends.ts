import { useEffect } from 'react';

import { useAuthStore, useFriendStore } from '@/store';

/**
 * Subscribes the friend store to the current user's friends and incoming
 * requests for the lifetime of the consuming screen, and exposes the actions
 * a UI needs. Keeps all Firestore wiring out of the screens.
 */
export function useFriends() {
  const profile = useAuthStore((s) => s.profile);
  const friends = useFriendStore((s) => s.friends);
  const incomingRequests = useFriendStore((s) => s.incomingRequests);
  const searchResults = useFriendStore((s) => s.searchResults);
  const isSearching = useFriendStore((s) => s.isSearching);
  const subscribe = useFriendStore((s) => s.subscribe);
  const search = useFriendStore((s) => s.search);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const declineRequest = useFriendStore((s) => s.declineRequest);
  const removeFriend = useFriendStore((s) => s.removeFriend);

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribe(profile.uid);
    return unsub;
  }, [profile, subscribe]);

  return {
    profile,
    friends,
    incomingRequests,
    searchResults,
    isSearching,
    search: (prefix: string) => (profile ? search(prefix, profile.uid) : undefined),
    sendRequest: (toUid: string) => (profile ? sendRequest(profile, toUid) : undefined),
    acceptRequest,
    declineRequest,
    removeFriend: (friendUid: string) =>
      profile ? removeFriend(profile.uid, friendUid) : undefined,
  };
}
