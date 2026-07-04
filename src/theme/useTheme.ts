import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store';

import { darkPalette, lightPalette, type AppColors, type ColorScheme } from './colors';

export type { AppColors, ColorScheme };

/** Resolves the user's theme setting ('system' | 'light' | 'dark') to an actual scheme. */
export function useAppColorScheme(): ColorScheme {
  const preference = useSettingsStore((s) => s.themePreference);
  const system = useColorScheme();
  if (preference === 'system') return system === 'light' ? 'light' : 'dark';
  return preference;
}

/** Reactive color palette that follows the user's theme setting. Use in place of the static `theme.colors`. */
export function useThemeColors(): AppColors {
  const scheme = useAppColorScheme();
  return scheme === 'light' ? lightPalette : darkPalette;
}
