import { create } from 'zustand';

import { userRepository } from '@/services/firebase';
import type { UserProfile, UserStatistics } from '@/types';

import { useAuthStore } from './authStore';

interface ProfileStoreState {
  statistics: UserStatistics | null;
  isSaving: boolean;
  error: string | null;

  loadStatistics: (uid: string) => Promise<void>;
  updateProfile: (
    uid: string,
    patch: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'username'>>,
  ) => Promise<{ ok: boolean; reason?: string }>;
}

/**
 * Owns profile editing and the user's aggregate statistics. Profile *reads* are
 * cached via React Query in feature hooks; this store handles writes and keeps
 * the auth store's cached profile in sync after a successful edit.
 */
export const useProfileStore = create<ProfileStoreState>((set) => ({
  statistics: null,
  isSaving: false,
  error: null,

  loadStatistics: async (uid) => {
    const statistics = await userRepository.getStatistics(uid);
    set({ statistics });
  },

  updateProfile: async (uid, patch) => {
    set({ isSaving: true, error: null });
    try {
      if (patch.username !== undefined) {
        const available = await userRepository.isUsernameAvailable(patch.username, uid);
        if (!available) {
          set({ isSaving: false, error: 'username_taken' });
          return { ok: false, reason: 'username_taken' };
        }
      }
      await userRepository.updateProfile(uid, patch);
      await useAuthStore.getState().refreshProfile();
      set({ isSaving: false });
      return { ok: true };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown';
      set({ isSaving: false, error: reason });
      return { ok: false, reason };
    }
  },
}));
