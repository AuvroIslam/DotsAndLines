import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { userRepository } from '@/services/firebase';
import type { UserSettings } from '@/types';

type SettingsValues = Omit<UserSettings, 'uid'>;

interface SettingsStoreState extends SettingsValues {
  hydrated: boolean;
  /** Pull authoritative settings from Firestore, falling back to local cache. */
  load: (uid: string) => Promise<void>;
  update: (uid: string, patch: Partial<SettingsValues>) => Promise<void>;
}

const DEFAULTS: SettingsValues = {
  soundEnabled: true,
  hapticsEnabled: true,
  themePreference: 'system',
  notificationsEnabled: true,
};

/**
 * Settings are persisted locally (instant app start, offline-friendly) and
 * mirrored to Firestore as the cross-device source of truth.
 */
export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      hydrated: false,

      load: async (uid) => {
        const remote = await userRepository.getSettings(uid);
        if (remote) {
          const { uid: _uid, ...values } = remote;
          set({ ...values, hydrated: true });
        } else {
          set({ hydrated: true });
        }
      },

      update: async (uid, patch) => {
        set(patch); // optimistic local update
        await userRepository.updateSettings(uid, patch);
      },
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        soundEnabled: s.soundEnabled,
        hapticsEnabled: s.hapticsEnabled,
        themePreference: s.themePreference,
        notificationsEnabled: s.notificationsEnabled,
      }),
    },
  ),
);
