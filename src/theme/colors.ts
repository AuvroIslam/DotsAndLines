/** Centralized color palette. UI components must read from here, never hardcode. */

export interface AppColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryDark: string;
  success: string;
  danger: string;
  warning: string;
  dotIdle: string;
}

export const darkPalette: AppColors = {
  bg: '#0E1116',
  surface: '#171B22',
  surfaceAlt: '#1F242D',
  border: '#2A303A',
  text: '#F5F7FA',
  textMuted: '#9AA4B2',
  primary: '#4F8CFF',
  primaryDark: '#2F6BE0',
  success: '#34D399',
  danger: '#F87171',
  warning: '#FBBF24',
  dotIdle: '#3A4250',
};

export const lightPalette: AppColors = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF0F5',
  border: '#D7DCE3',
  text: '#12151B',
  textMuted: '#5B6472',
  primary: '#2F6BE0',
  primaryDark: '#1E4FB8',
  success: '#0E9A66',
  danger: '#DC2626',
  warning: '#B45309',
  dotIdle: '#C7CDD6',
};

/** Distinct per-player colors (P1..P4). Index aligns with PlayerIndex. Same in both schemes. */
export const playerColors = ['#4F8CFF', '#F87171', '#34D399', '#FBBF24'] as const;

/** Default/static palette (dark). Prefer `useThemeColors()` in components so the app reacts to the setting. */
export const palette = darkPalette;

export type ColorScheme = 'light' | 'dark';
