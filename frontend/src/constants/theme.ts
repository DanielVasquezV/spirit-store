import { Platform, StyleSheet } from 'react-native';
import type { TextStyle } from 'react-native';

const systemFont = Platform.select({
  ios: 'system-ui',
  android: 'sans-serif',
  default: 'system-ui',
}) as string;

export const Colors = {
  bg: '#0B0B0C',
  surface: '#141416',
  card: '#1C1C1F',
  overlay: '#232327',
  overlayPressed: '#2C2C31',

  stageFrom: '#2E2E34',
  stageTo: '#161619',

  border: '#2A2A2E',
  borderStrong: '#3A3A40',
  borderFocus: '#FFFFFF',

  text: '#FFFFFF',
  textSecondary: '#A8A8B0',
  textMuted: '#6E6E76',
  textInverse: '#0B0B0C',

  accent: '#FFFFFF',
  accentPressed: '#E4E4E7',

  success: '#3FB950',
  warning: '#D29922',
  danger: '#F85149',
  info: '#58A6FF',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
} as const;

export const Radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const Hairline = StyleSheet.hairlineWidth;

export const FontFamily = {
  regular: systemFont,
  medium: systemFont,
  semibold: systemFont,
  bold: systemFont,
} as const;

export const Type = {
  display: { fontFamily: FontFamily.semibold, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  h1: { fontFamily: FontFamily.semibold, fontSize: 24, lineHeight: 28, letterSpacing: -0.3 },
  h2: { fontFamily: FontFamily.semibold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  h3: { fontFamily: FontFamily.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: FontFamily.medium, fontSize: 15, lineHeight: 21 },
  bodySm: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: FontFamily.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
  labelSm: { fontFamily: FontFamily.semibold, fontSize: 10, lineHeight: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  price: { fontFamily: FontFamily.bold, fontSize: 26, lineHeight: 28, letterSpacing: -0.6 },
  priceCents: { fontFamily: FontFamily.bold, fontSize: 15, lineHeight: 18, letterSpacing: -0.2 },
} satisfies Record<string, TextStyle>;

export const Layout = {
  screenX: 16,
  cardPadding: 16,
  gap: 12,
  sectionGap: 24,
  touchMin: 44,
  rowHeight: 52,
  headerHeight: 56,
  tabBarHeight: 56,
  ctaBarHeight: 72,
} as const;

export const Motion = {
  fast: 120,
  base: 180,
  slow: 260,
  pressScale: 0.98,
  pressOpacity: 0.7,
} as const;