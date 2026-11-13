import { alpha, createTheme } from "@mui/material";
import type { Role } from "./types";
import { FONT, GRAIN, L } from "./screens/landing/tokens";

export type ColorMode = "light" | "dark";

// Brand tokens shared by the theme and by bespoke pages (shell, public passport page). One identity
// everywhere: warm paper, ink, and a single signal orange taken from thermography. No gradients.
export const BRAND = {
  ink: L.ink,
  inkSoft: L.inkSoft,
  paper: L.paper,
  card: L.card,
  teal: L.teal,
  tealDark: L.tealDeep,
  tealLight: "#5EEAD4",
  heat: L.heat,
  blue: L.cold,
  amber: L.amber,
  surface: L.paper,
  // Kept so older call sites keep compiling; they are solid colours now.
  gradient: L.teal,
  gradientSoft: "rgba(13,148,136,0.14)",
  thermal: L.heat,
};

// One accent per role so each workspace reads as "its own" area at a glance. `gradient` is a solid colour
// now (the name stays so existing call sites keep working); `text` is what to print on top of it.
export const ROLE_ACCENTS: Record<Role, { main: string; dark: string; bg: string; gradient: string; glow: string; text: string }> = {
  facility_manager: { main: L.teal, dark: "#0A6D64", bg: "#D3E8E3", gradient: L.teal, glow: "rgba(13,148,136,0.4)", text: "#FFFFFF" },
  technician: { main: L.heat, dark: "#B93A18", bg: "#F8D8CE", gradient: L.heat, glow: "rgba(242,84,45,0.4)", text: "#FFFFFF" },
  contractor_manager: { main: L.amber, dark: "#8A5A00", bg: "#F3E2B5", gradient: L.amber, glow: "rgba(232,163,23,0.4)", text: L.ink },
  admin: { main: L.cold, dark: "#2C5A82", bg: "#D3E1EE", gradient: L.cold, glow: "rgba(62,124,177,0.4)", text: "#FFFFFF" },
};

export function createAppTheme(mode: ColorMode) {
  const dark = mode === "dark";
  // "line" is the ink outline every card, input and chip carries; "hard" is its offset shadow.
  const line = dark ? "rgba(239,233,220,0.5)" : L.ink;
  const lineSoft = dark ? "rgba(239,233,220,0.16)" : "rgba(14,23,38,0.18)";
  const hard = (px: number) => (dark ? `${px}px ${px}px 0 rgba(239,233,220,0.16)` : `${px}px ${px}px 0 ${L.ink}`);
  const pageBg = dark ? L.ink : L.paper;
  const paperBg = dark ? L.inkSoft : L.card;
  const textPrimary = dark ? L.paper : L.ink;
  const textSecondary = dark ? "rgba(239,233,220,0.66)" : "rgba(14,23,38,0.68)";
  const accent = dark ? "#5EEAD4" : L.teal;
  const serif = { fontFamily: FONT.serif, fontWeight: 400 };

  return createTheme({
    palette: {
      mode,
      primary: dark
        ? { main: L.paper, dark: "#FFFFFF", light: L.paper, contrastText: L.ink }
        : { main: L.ink, dark: "#000000", light: L.inkSoft, contrastText: L.paper },
      secondary: { main: dark ? "#8DB6D8" : L.cold },
      success: dark ? { main: "#5EEAD4", contrastText: L.ink } : { main: L.teal, contrastText: "#FFFFFF" },
      warning: { main: L.amber, contrastText: L.ink },
      error: dark ? { main: "#FF8F73", contrastText: L.ink } : { main: "#D8431C", contrastText: "#FFFFFF" },
      info: dark ? { main: "#8DB6D8", contrastText: L.ink } : { main: L.cold, contrastText: "#FFFFFF" },
      text: { primary: textPrimary, secondary: textSecondary },
      background: { default: pageBg, paper: paperBg },
      divider: lineSoft,
    },
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: FONT.body,
      h1: { ...serif, letterSpacing: "-0.028em", lineHeight: 0.98 },
      h2: { ...serif, letterSpacing: "-0.025em", lineHeight: 1 },
      h3: { ...serif, letterSpacing: "-0.022em", lineHeight: 1.02 },
      h4: { ...serif, letterSpacing: "-0.02em", lineHeight: 1.05 },
      h5: { ...serif, letterSpacing: "-0.015em", lineHeight: 1.1 },
      h6: { ...serif, letterSpacing: "-0.01em", lineHeight: 1.15, fontSize: "1.45rem" },
      // Card and section headings.
      subtitle1: { ...serif, fontSize: "1.45rem", lineHeight: 1.15, letterSpacing: "-0.01em" },
      subtitle2: { fontWeight: 700 },
      button: { fontWeight: 700, textTransform: "none", letterSpacing: "-0.005em" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: pageBg,
            color: textPrimary,
            textRendering: "optimizeLegibility",
            transition: "background-color 0.3s ease, color 0.3s ease",
          },
          // Printed-paper grain over the whole app, behind the content.
          "body::before": {
            content: '""',
            position: "fixed",
            inset: 0,
            zIndex: -1,
            pointerEvents: "none",
            backgroundImage: GRAIN,
            opacity: dark ? 0.1 : 0.3,
            mixBlendMode: dark ? "screen" : "multiply",
          },
          "::selection": { background: alpha(L.heat, 0.3) },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-thumb": {
            background: dark ? "rgba(239,233,220,0.3)" : "rgba(14,23,38,0.35)",
            borderRadius: 0,
            border: "2px solid transparent",
            backgroundClip: "content-box",
          },
          "*::-webkit-scrollbar-thumb:hover": {
            background: dark ? "rgba(239,233,220,0.55)" : "rgba(14,23,38,0.6)",
            backgroundClip: "content-box",
            border: "2px solid transparent",
          },
          "@keyframes tt-fade-up": {
            from: { opacity: 0, transform: "translateY(14px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
          "@keyframes tt-shimmer": {
            "0%": { backgroundPosition: "-420px 0" },
            "100%": { backgroundPosition: "420px 0" },
          },
          "@keyframes tt-float": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-10px)" },
          },
          "@keyframes tt-drift": {
            "0%": { transform: "translate3d(0,0,0) scale(1)" },
            "50%": { transform: "translate3d(40px,-30px,0) scale(1.12)" },
            "100%": { transform: "translate3d(0,0,0) scale(1)" },
          },
          "@keyframes tt-pulse-ring": {
            "0%": { transform: "scale(0.8)", opacity: 0.7 },
            "100%": { transform: "scale(2.2)", opacity: 0 },
          },
          "@keyframes tt-gradient": {
            "0%": { backgroundPosition: "0% 50%" },
            "50%": { backgroundPosition: "100% 50%" },
            "100%": { backgroundPosition: "0% 50%" },
          },
          "@keyframes tt-marquee": {
            from: { transform: "translateX(0)" },
            to: { transform: "translateX(-50%)" },
          },
          "@keyframes tt-ring": {
            "0%, 100%": { transform: "rotate(0)" },
            "15%": { transform: "rotate(14deg)" },
            "30%": { transform: "rotate(-12deg)" },
            "45%": { transform: "rotate(8deg)" },
            "60%": { transform: "rotate(-5deg)" },
          },
          // Every table body row and page card eases in, staggered, with no per-page code.
          "tbody tr": { animation: "tt-fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both" },
          "tbody tr:nth-of-type(1)": { animationDelay: "0.02s" },
          "tbody tr:nth-of-type(2)": { animationDelay: "0.06s" },
          "tbody tr:nth-of-type(3)": { animationDelay: "0.10s" },
          "tbody tr:nth-of-type(4)": { animationDelay: "0.14s" },
          "tbody tr:nth-of-type(5)": { animationDelay: "0.18s" },
          "tbody tr:nth-of-type(6)": { animationDelay: "0.22s" },
          "tbody tr:nth-of-type(n+7)": { animationDelay: "0.26s" },
          "@media (prefers-reduced-motion: reduce)": {
            "*, *::before, *::after": {
              animationDuration: "0.001ms !important",
              animationIterationCount: "1 !important",
              transitionDuration: "0.001ms !important",
              scrollBehavior: "auto !important",
            },
          },
          html: { scrollBehavior: "smooth" },
        },
      },
      MuiAppBar: { defaultProps: { elevation: 0 } },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            transition: "box-shadow 0.2s ease, transform 0.2s ease, border-color 0.25s ease, background-color 0.3s ease",
          },
          // overflow-x lets wide tables scroll sideways inside their card on phones.
          elevation1: { boxShadow: hard(4), border: `2px solid ${line}`, borderRadius: 4, overflowX: "auto" },
          elevation8: { boxShadow: hard(6), border: `2px solid ${line}`, borderRadius: 4 },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: false },
        styleOverrides: {
          root: {
            borderRadius: 3,
            transition: "transform 0.15s ease, box-shadow 0.15s ease, background-color 0.2s ease, border-color 0.2s ease",
            "&:active": { transform: "translate(3px, 3px)" },
          },
          sizeLarge: { padding: "11px 26px", fontSize: "0.98rem", borderRadius: 3 },
          contained: {
            border: `2px solid ${dark ? L.paper : L.ink}`,
            boxShadow: hard(3),
            "&:hover": { transform: "translate(1px, 1px)", boxShadow: hard(2) },
            "&:active": { boxShadow: "none", transform: "translate(3px, 3px)" },
            "&.Mui-disabled": {
              background: dark ? "rgba(239,233,220,0.1)" : "rgba(14,23,38,0.12)",
              color: dark ? "rgba(239,233,220,0.4)" : "rgba(14,23,38,0.4)",
              borderColor: "transparent",
              boxShadow: "none",
            },
          },
          containedPrimary: {
            background: dark ? L.paper : L.ink,
            color: dark ? L.ink : L.paper,
            boxShadow: `4px 4px 0 ${L.heat}`,
            "&:hover": { background: dark ? L.paper : L.ink, transform: "translate(2px, 2px)", boxShadow: `2px 2px 0 ${L.heat}` },
          },
          outlined: {
            borderWidth: 2,
            borderColor: line,
            "&:hover": { borderWidth: 2, borderColor: line, backgroundColor: alpha(dark ? L.paper : L.ink, 0.07) },
            "&:active": { transform: "none" },
          },
          text: { "&:hover": { backgroundColor: alpha(dark ? L.paper : L.ink, 0.07) }, "&:active": { transform: "none" } },
          // Amber text on paper is too pale to read; use a deeper shade for outlined/text warnings.
          outlinedWarning: {
            color: dark ? "#FBBF24" : "#8A5A00",
            borderColor: dark ? alpha("#FBBF24", 0.6) : "#8A5A00",
            "&:hover": { borderColor: dark ? "#FBBF24" : "#8A5A00", backgroundColor: alpha(L.amber, 0.14) },
          },
          textWarning: { color: dark ? "#FBBF24" : "#8A5A00" },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 3, transition: "transform 0.15s ease, background-color 0.2s ease", "&:hover": { backgroundColor: alpha(dark ? L.paper : L.ink, 0.08) } } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 3,
            backgroundColor: dark ? "rgba(239,233,220,0.05)" : "#FFFFFF",
            transition: "box-shadow 0.15s ease, background-color 0.2s ease",
            "& .MuiOutlinedInput-notchedOutline": {
              borderWidth: 2,
              borderRadius: 3,
              borderColor: dark ? "rgba(239,233,220,0.4)" : "rgba(14,23,38,0.42)",
              transition: "border-color 0.2s ease",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: dark ? L.paper : L.ink },
            "&.Mui-focused": { boxShadow: `4px 4px 0 ${L.teal}` },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: dark ? L.paper : L.ink, borderWidth: 2 },
            "&.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: dark ? "#FF8F73" : L.heat },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { fontWeight: 600, "&.Mui-focused": { color: textPrimary }, "&.Mui-error": { color: dark ? "#FF8F73" : "#D8431C" } },
        },
      },
      MuiChip: {
        styleOverrides: {
          // Chips read like stamped labels: square corners and a thin ink outline, in every colour.
          root: { fontWeight: 700, borderRadius: 2, letterSpacing: "0.01em", border: `1.5px solid ${line}` },
          sizeSmall: { height: 24, fontSize: "0.72rem" },
          colorSuccess: { backgroundColor: dark ? "#0E4A45" : L.teal, color: dark ? "#BDF5EA" : "#FFFFFF" },
          colorError: { backgroundColor: dark ? "#5A2418" : "#D8431C", color: dark ? "#FFC9B8" : "#FFFFFF" },
          colorWarning: { backgroundColor: L.amber, color: L.ink },
          colorInfo: { backgroundColor: dark ? "#1F3A52" : L.cold, color: dark ? "#C5DDF0" : "#FFFFFF" },
          colorDefault: { backgroundColor: dark ? "rgba(239,233,220,0.1)" : L.paperDeep, color: textPrimary },
          outlined: { backgroundColor: "transparent" },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 3, alignItems: "center", fontWeight: 500 },
          standardInfo: dark
            ? { backgroundColor: "rgba(141,182,216,0.14)", color: "#C5DDF0", border: "2px solid #8DB6D8" }
            : { backgroundColor: "#DCE8F2", color: "#173A57", border: `2px solid ${L.ink}` },
          standardSuccess: dark
            ? { backgroundColor: "rgba(94,234,212,0.12)", color: "#BDF5EA", border: "2px solid #5EEAD4" }
            : { backgroundColor: "#D3E8E3", color: "#07423C", border: `2px solid ${L.ink}` },
          standardWarning: dark
            ? { backgroundColor: "rgba(232,163,23,0.14)", color: "#F6DFA5", border: `2px solid ${L.amber}` }
            : { backgroundColor: "#F6E7BE", color: "#5C3C00", border: `2px solid ${L.ink}` },
          standardError: dark
            ? { backgroundColor: "rgba(255,143,115,0.14)", color: "#FFC9B8", border: "2px solid #FF8F73" }
            : { backgroundColor: "#FADBD1", color: "#7A220C", border: `2px solid ${L.ink}` },
        },
      },
      MuiTableContainer: { styleOverrides: { root: { borderRadius: 0 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${lineSoft}`, padding: "14px 16px" },
          head: {
            fontFamily: FONT.mono,
            fontWeight: 500,
            color: dark ? "rgba(239,233,220,0.75)" : L.ink,
            fontSize: "0.68rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            backgroundColor: dark ? "rgba(239,233,220,0.06)" : L.paperDeep,
            borderBottom: `2px solid ${line}`,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: "background-color 0.15s ease",
            "tbody &:hover": { backgroundColor: alpha(dark ? L.paper : L.ink, 0.05) },
            "tbody &:last-of-type td": { borderBottom: 0 },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 4, border: `2px solid ${line}`, boxShadow: dark ? "8px 8px 0 rgba(239,233,220,0.16)" : `9px 9px 0 ${L.ink}`, backgroundImage: "none" },
        },
      },
      MuiDialogTitle: { styleOverrides: { root: { ...serif, fontSize: "1.9rem", lineHeight: 1.1, letterSpacing: "-0.015em", padding: "22px 24px 8px" } } },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            // MUI removes the top padding of a dialog body that follows its title. The first field's label
            // floats about 9px above its box, and the body clips anything outside it, so the label was cut
            // off. Give it room instead.
            ".MuiDialogTitle-root + &.MuiDialogContent-root": { paddingTop: 14 },
          },
        },
      },
      MuiDialogActions: { styleOverrides: { root: { padding: "12px 24px 22px", gap: 4 } } },
      MuiBackdrop: { styleOverrides: { root: { backgroundColor: "rgba(14,23,38,0.6)" } } },
      MuiMenu: { styleOverrides: { paper: { borderRadius: 3, border: `2px solid ${line}`, boxShadow: hard(5), marginTop: 6 } } },
      MuiPopover: { styleOverrides: { paper: { borderRadius: 3 } } },
      MuiMenuItem: { styleOverrides: { root: { borderRadius: 2, margin: "2px 6px", transition: "background-color 0.15s ease" } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: dark ? L.paper : L.ink, color: dark ? L.ink : L.paper, borderRadius: 2, fontSize: "0.75rem", fontWeight: 600, padding: "6px 10px" },
          arrow: { color: dark ? L.paper : L.ink },
        },
      },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 0, height: 8, backgroundColor: dark ? "rgba(239,233,220,0.14)" : "rgba(14,23,38,0.14)" }, bar: { borderRadius: 0 } } },
      MuiDivider: { styleOverrides: { root: { borderColor: lineSoft } } },
      MuiTabs: { styleOverrides: { indicator: { height: 3, backgroundColor: L.heat } } },
      MuiTab: { styleOverrides: { root: { fontWeight: 700, textTransform: "none" } } },
      MuiSwitch: {
        styleOverrides: {
          switchBase: { "&.Mui-checked": { color: dark ? L.paper : L.ink }, "&.Mui-checked + .MuiSwitch-track": { backgroundColor: L.teal, opacity: 1 } },
          track: { backgroundColor: dark ? "rgba(239,233,220,0.4)" : "rgba(14,23,38,0.4)", opacity: 1 },
        },
      },
      MuiCheckbox: { styleOverrides: { root: { color: dark ? "rgba(239,233,220,0.6)" : "rgba(14,23,38,0.6)", "&.Mui-checked": { color: accent } } } },
      MuiAvatar: { styleOverrides: { root: { borderRadius: 3, border: `2px solid ${line}` } } },
      MuiLink: {
        defaultProps: { underline: "always" },
        styleOverrides: {
          root: { fontWeight: 700, color: textPrimary, textDecorationColor: L.heat, textDecorationThickness: 2, textUnderlineOffset: 3, "&:hover": { color: dark ? "#FF8F73" : "#D8431C" } },
        },
      },
      // Page titles (h4) ease in on every route change without touching each page.
      MuiTypography: {
        variants: [
          {
            props: { variant: "h4" },
            style: { fontSize: "2.4rem", "@media (max-width:600px)": { fontSize: "2rem" }, animation: "tt-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both" },
          },
        ],
      },
      MuiSkeleton: { defaultProps: { animation: "wave" }, styleOverrides: { root: { borderRadius: 3 } } },
    },
  });
}

// Kept for code that does not care about the colour mode.
export const theme = createAppTheme("light");
