import { Platform, StyleSheet } from "react-native";

export const colors = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#EFF3FE",
  background: "#FFFFFF",
  surface: "#F7F8FA",
  surfaceAlt: "#F2F4F7",
  text: "#17191C",
  secondaryText: "#6B7280",
  tertiaryText: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F0F1F3",
  success: "#16A34A",
  successBg: "#D8EED9",
  error: "#EF4444",
  errorBg: "#FDECEC",
  emergency: "#E02D2D",
  warning: "#F59E0B",
  disabled: "#D1D5DB",
  disabledText: "#9CA3AF",
  overlay: "rgba(23,25,28,0.45)",
  // Service card palette (from Figma service tiles)
  servicePink: "#F6D5D2",
  serviceGreen: "#D5EDCE",
  serviceYellow: "#FAE8B6",
  servicePurple: "#DAD5F4",
  serviceBlue: "#C9DFF6",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = StyleSheet.create({
  largeTitle: { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: 0.2 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  heading: { fontSize: 18, fontWeight: "700", color: colors.text },
  subheading: { fontSize: 16, fontWeight: "600", color: colors.text },
  body: { fontSize: 15, fontWeight: "400", color: colors.text, lineHeight: 21 },
  bodySmall: { fontSize: 13, fontWeight: "400", color: colors.secondaryText, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "400", color: colors.secondaryText },
  label: { fontSize: 13, fontWeight: "500", color: colors.text },
  link: { fontSize: 14, fontWeight: "600", color: colors.primary },
});

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#101828",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
    default: {},
  }),
  sheet: Platform.select({
    ios: {
      shadowColor: "#101828",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: { elevation: 12 },
    default: {},
  }),
} as const;

/** Widest a screen's content grows. Phones are narrower, so this only takes effect on tablets. */
export const MAX_CONTENT_WIDTH = 560;
