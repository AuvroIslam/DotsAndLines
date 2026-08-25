import { darkPalette, palette, playerColors } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 32, lineHeight: 38, fontFamily: 'Fredoka_700Bold' },
  h2: { fontSize: 25, lineHeight: 31, fontFamily: 'Fredoka_700Bold' },
  h3: { fontSize: 19, lineHeight: 25, fontFamily: 'Fredoka_600SemiBold' },
  body: { fontSize: 16, lineHeight: 23, fontFamily: 'Fredoka_500Medium' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: 'Fredoka_500Medium' },
};

export const theme = {
  colors: palette,
  playerColors,
  spacing,
  radius,
  typography,
} as const;

export type Theme = typeof theme;

export { palette, playerColors, darkPalette };
export { lightPalette } from './colors';
export type { AppColors, ColorScheme } from './colors';

// Note: the reactive `useThemeColors`/`useAppColorScheme` hooks live in `./useTheme`,
// not here — that module pulls in the settings store (and transitively Firebase),
// which pure/offline-only consumers of this barrel (e.g. services/local/*) must not.
