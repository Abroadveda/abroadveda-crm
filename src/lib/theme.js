// Design tokens for light and dark themes
const lightTheme = {
  ink: "#0A1F3D",
  blue: "#0d6efd",
  saffron: "#F59E0B",
  mist: "#F5F7FB",
  line: "#E5EAF3",
  ok: "#16A34A",
  danger: "#DC2626",
  teal: "#14B8A6",
  purple: "#8B5CF6",

  // Text colors
  textPrimary: "#0A1F3D",
  textSecondary: "#64748B",
  textLight: "#94A3B8",

  // Backgrounds
  bgPrimary: "#FFFFFF",
  bgSecondary: "#F8FAFC",
  bgTertiary: "#F5F7FB",

  // Borders
  border: "#E5EAF3",
  borderLight: "#F1F5F9",
};

const darkTheme = {
  ink: "#F8FAFC",
  blue: "#60A5FA",
  saffron: "#FCD34D",
  mist: "#1E293B",
  line: "#334155",
  ok: "#4ADE80",
  danger: "#F87171",
  teal: "#2DD4BF",
  purple: "#A78BFA",

  // Text colors
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textLight: "#94A3B8",

  // Backgrounds
  bgPrimary: "#0F172A",
  bgSecondary: "#1E293B",
  bgTertiary: "#334155",

  // Borders
  border: "#334155",
  borderLight: "#475569",
};

// Role-based colors (same in both themes)
export const roleColors = {
  Admin: { bg: "#F59E0B", badge: "#FEF3C7", text: "#92400E" },
  BDE: { bg: "#14B8A6", badge: "#CCFBF1", text: "#134E4A" },
  Counsellor: { bg: "#0d6efd", badge: "#DBEAFE", text: "#1E40AF" },
  "Visa Officer": { bg: "#EF4444", badge: "#FEE2E2", text: "#991B1B" },
};

// Stage colors (same in both themes for visual consistency)
export const stageColors = {
  lead: "#64748B",
  processing: "#F59E0B",
  counsel: "#0d6efd",
  shortlist: "#6366F1",
  applied: "#8B5CF6",
  offer: "#F59E0B",
  finance: "#14B8A6",
  visa: "#EF4444",
  predep: "#10B981",
  departed: "#16A34A",
  future: "#8B5CF6",
  enrolled: "#14B8A6",
  notinterested: "#DC2626",
};

// Get theme based on isDark flag
export function getTheme(isDark) {
  return isDark ? darkTheme : lightTheme;
}

// Get color with transparency (hex to rgba)
export function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export { lightTheme, darkTheme };
