/** Centralized color palette. UI components must read from here, never hardcode. */

export const palette = {
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
} as const;

/** Distinct per-player colors (P1..P4). Index aligns with PlayerIndex. */
export const playerColors = ['#4F8CFF', '#F87171', '#34D399', '#FBBF24'] as const;

export type AppColors = typeof palette;
