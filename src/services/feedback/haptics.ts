import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/store';

function enabled(): boolean {
  return useSettingsStore.getState().hapticsEnabled;
}

/** Thin, settings-aware wrapper over expo-haptics. Safe to call anywhere. */
export const haptics = {
  selection(): void {
    if (!enabled()) return;
    void Haptics.selectionAsync();
  },
  light(): void {
    if (!enabled()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  success(): void {
    if (!enabled()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error(): void {
    if (!enabled()) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};
