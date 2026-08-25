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
  accent: string;
  purple: string;
  ink: string;
  paper: string;
  board: string;
  boardRail: string;
  shadow: string;
  grid: string;
}

export const darkPalette: AppColors = {
  bg: '#081B31',
  surface: '#132D4A',
  surfaceAlt: '#1C3A5B',
  border: '#3B6383',
  text: '#FFF7E2',
  textMuted: '#B6C8D8',
  primary: '#35D0C8',
  primaryDark: '#189B9A',
  success: '#68D982',
  danger: '#FF6F68',
  warning: '#FFCA3A',
  dotIdle: '#507492',
  accent: '#FF7867',
  purple: '#9A82FF',
  ink: '#101B3F',
  paper: '#FFF6DC',
  board: '#0D243D',
  boardRail: '#31506A',
  shadow: '#020B18',
  grid: '#17415F',
};

export const lightPalette: AppColors = {
  bg: '#F4EBD5',
  surface: '#FFF9E9',
  surfaceAlt: '#E3F4EF',
  border: '#9CB9C4',
  text: '#142342',
  textMuted: '#65778B',
  primary: '#1FB6B1',
  primaryDark: '#118B8A',
  success: '#42B968',
  danger: '#E95655',
  warning: '#F2AE18',
  dotIdle: '#A8C2C8',
  accent: '#F06455',
  purple: '#755CE0',
  ink: '#142342',
  paper: '#FFF9E9',
  board: '#FFF8E8',
  boardRail: '#C8E3DE',
  shadow: '#90A3AB',
  grid: '#D7E2DD',
};

/** Distinct per-player colors (P1..P4). Index aligns with PlayerIndex. Same in both schemes. */
export const playerColors = ['#35D0C8', '#FF7867', '#68D982', '#FFCA3A'] as const;

/** Default/static palette (dark). Prefer `useThemeColors()` in components so the app reacts to the setting. */
export const palette = darkPalette;

export type ColorScheme = 'light' | 'dark';
