"use client";

import { useEffect, useState, type ReactNode } from "react";
import NextLink from "next/link";
import { Box, Stack, Typography } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { AnimatePresence, motion } from "framer-motion";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import Co2RoundedIcon from "@mui/icons-material/Co2Rounded";
import HistoryEduRoundedIcon from "@mui/icons-material/HistoryEduRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import { createAppTheme } from "../theme";
import { Logo } from "./Logo";
import { EASE } from "./motion";
import { Condenser, Contours } from "../screens/landing/art";
import { FONT, GRAIN, L, gridBackground, mono } from "../screens/landing/tokens";

const POINTS = [
  { icon: VerifiedUserRoundedIcon, title: "Verifiable capability passports", text: "Every credential checked, every passport scannable by anyone." },
  { icon: RuleRoundedIcon, title: "Risk-based job matching", text: "Unqualified assignments are blocked before they happen." },
  { icon: Co2RoundedIcon, title: "Cylinder-level refrigerant tracking", text: "From cylinder to compressor, every kilogram accounted for." },
  { icon: HistoryEduRoundedIcon, title: "Tamper-evident audit trail", text: "A hash-chained history that can't be quietly rewritten." },
  { icon: WifiOffRoundedIcon, title: "Works with no signal", text: "Reports queue on the device and sync when you're back." },
];

/**
 * The sign-in, sign-up and password pages always use the paper-and-ink look of the landing page, whatever
 * colour mode the app is in. Inputs get solid ink outlines, buttons a hard shadow, links an orange underline.
 * Label type is left alone on purpose: the outlined input's notch is sized from it.
 */
const authTheme = createTheme(createAppTheme("light"), {
  palette: {
    primary: { main: L.ink, dark: "#000", light: L.inkSoft, contrastText: L.paper },
    text: { primary: L.ink, secondary: "rgba(14,23,38,0.68)" },
    background: { default: L.paper, paper: L.card },
    divider: L.rule,
  },
  shape: { borderRadius: 3 },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#fff",
          borderRadius: 3,
          transition: "box-shadow .15s",
          "& .MuiOutlinedInput-notchedOutline": { borderWidth: 2, borderColor: "rgba(14,23,38,0.42)", borderRadius: 3 },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: L.ink },
          "&.Mui-focused": { boxShadow: `4px 4px 0 ${L.teal}` },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderWidth: 2, borderColor: L.ink },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: L.heat },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 600, "&.Mui-focused": { color: L.ink }, "&.Mui-error": { color: L.heat } } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2 } } },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 3, "&:active": { transform: "none" } },
        sizeLarge: { borderRadius: 3 },
        containedPrimary: {
          background: L.ink,
          color: L.paper,
          boxShadow: `5px 5px 0 ${L.heat}`,
          transition: "transform .15s, box-shadow .15s, background-color .15s",
          "&:hover": { background: L.ink, boxShadow: `3px 3px 0 ${L.heat}`, transform: "translate(2px, 2px)" },
          "&:active": { boxShadow: `0 0 0 ${L.heat}`, transform: "translate(5px, 5px)" },
          "&.Mui-disabled": { background: "rgba(14,23,38,0.22)", color: "rgba(14,23,38,0.5)", boxShadow: "none" },
        },
      },
    },
    MuiLink: {
      defaultProps: { underline: "always" },
      styleOverrides: { root: { color: L.ink, fontWeight: 700, textDecorationColor: L.heat, textDecorationThickness: 2, textUnderlineOffset: 3, "&:hover": { color: L.heat } } },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 3, border: `2px solid ${L.ink}`, alignItems: "center" } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 0 }, bar: { borderRadius: 0 } } },
  },
});

function Rotator() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % POINTS.length), 4200);
    return () => window.clearInterval(id);
  }, []);
  const { icon: Icon, title, text } = POINTS[index];

  return (
    <Box>
      <Box sx={{ position: "relative", minHeight: 176 }}>
        <AnimatePresence mode="wait">
          <motion.div key={index} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.45, ease: EASE }}>
            <Box sx={{ p: 2.75, bgcolor: L.inkSoft, border: `2px solid rgba(239,233,220,0.55)`, boxShadow: `7px 7px 0 ${L.teal}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Box sx={{ width: 44, height: 44, display: "grid", placeItems: "center", bgcolor: L.paper, color: L.ink, border: `2px solid ${L.paper}` }}>
                  <Icon />
                </Box>
                <Typography sx={{ ...mono, fontSize: 11, color: "rgba(239,233,220,0.55)" }}>0{index + 1} / 0{POINTS.length}</Typography>
              </Stack>
              <Typography sx={{ fontFamily: FONT.serif, fontSize: 29, lineHeight: 1.02, mb: 0.75, color: L.paper }}>{title}</Typography>
              <Typography sx={{ color: "rgba(239,233,220,0.72)", fontSize: 14.5, lineHeight: 1.6 }}>{text}</Typography>
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>
      <Stack direction="row" spacing={0.75} mt={2.5}>
        {POINTS.map((_, i) => (
          <Box
            key={i}
            role="button"
            aria-label={`Show point ${i + 1}`}
            tabIndex={0}
            onClick={() => setIndex(i)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setIndex(i)}
            sx={{ height: 6, width: i === index ? 34 : 12, cursor: "pointer", bgcolor: i === index ? L.heat : "rgba(239,233,220,0.3)", transition: "all .35s ease" }}
          />
        ))}
      </Stack>
    </Box>
  );
}

export function AuthSplitLayout({
  title,
  subtitle,
  eyebrow = "Secure access",
  children,
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <ThemeProvider theme={authTheme}>
      <Box display="flex" minHeight="100vh" sx={{ bgcolor: L.paper, color: L.ink }}>
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "space-between",
            width: "46%",
            maxWidth: 680,
            p: 6,
            color: L.paper,
            bgcolor: L.ink,
            position: "relative",
            overflow: "hidden",
            ...gridBackground("rgba(239,233,220,0.04)", "rgba(239,233,220,0.075)"),
          }}
        >
          <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.18, mixBlendMode: "screen", pointerEvents: "none" }} />
          <Box aria-hidden sx={{ position: "absolute", width: "130%", aspectRatio: "1", right: "-55%", bottom: "-38%", opacity: 0.75, pointerEvents: "none" }}>
            <Contours seed={3} count={11} />
          </Box>

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <NextLink href="/" style={{ textDecoration: "none" }} aria-label="ThermaTrust home">
              <Logo light />
            </NextLink>
          </Box>

          <Stack spacing={4.5} sx={{ position: "relative", zIndex: 1 }}>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
              <Typography sx={{ ...mono, color: L.heat, mb: 2 }}>Trust layer for commercial HVAC/R</Typography>
              <Typography component="p" sx={{ fontFamily: FONT.serif, fontSize: { md: 50, lg: 58 }, lineHeight: 0.96, letterSpacing: "-0.024em", maxWidth: 500 }}>
                Verified for the job, <Box component="span" sx={{ fontStyle: "italic", color: "#F6B8A6" }}>not just certified.</Box>
              </Typography>
            </motion.div>
            <Rotator />
          </Stack>

          {/* a unit to look at, when the window is tall enough to spare the room */}
          <Box aria-hidden sx={{ position: "absolute", right: -46, bottom: 30, width: 300, opacity: 0.95, pointerEvents: "none", display: "none", "@media (min-height: 960px)": { display: "block" } }}>
            <svg viewBox="40 70 520 320" width="100%">
              <Condenser />
            </svg>
          </Box>

          <Typography sx={{ position: "relative", zIndex: 1, ...mono, fontSize: 10.5, color: "rgba(239,233,220,0.55)", maxWidth: 300 }}>
            A trust and compliance layer for commercial HVAC/refrigeration work.
          </Typography>
        </Box>

        <Box
          flex={1}
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={{ xs: 2.5, sm: 4 }}
          sx={{ position: "relative", overflow: "hidden", ...gridBackground("rgba(14,23,38,0.05)", "rgba(14,23,38,0.09)") }}
        >
          <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.3, mixBlendMode: "multiply", pointerEvents: "none" }} />
          <Box
            component={NextLink}
            href="/"
            sx={{ ...mono, fontSize: 11, position: "absolute", top: { xs: 14, sm: 22 }, right: { xs: 18, sm: 32 }, color: L.ink, textDecoration: "none", zIndex: 2, "&:hover": { color: L.heat } }}
          >
            ← Back to home
          </Box>

          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}>
            <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", mb: 4, mt: 3 }}>
              <NextLink href="/" style={{ textDecoration: "none" }} aria-label="ThermaTrust home">
                <Logo />
              </NextLink>
            </Box>
            <Box sx={{ bgcolor: L.card, border: `2px solid ${L.ink}`, boxShadow: `9px 9px 0 ${L.ink}`, p: { xs: 3, sm: 4.5 }, position: "relative" }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ ...mono, fontSize: 11, color: "rgba(14,23,38,0.6)", mb: 1.75 }}>
                <Box sx={{ width: 8, height: 8, bgcolor: L.teal }} />
                <span>{eyebrow}</span>
              </Stack>
              <Typography component="h1" sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: { xs: 38, sm: 44 }, lineHeight: 0.98, letterSpacing: "-0.02em", mb: 1.25 }}>
                {title}
              </Typography>
              <Typography sx={{ color: "text.secondary", mb: 3.5, fontSize: 15, lineHeight: 1.6 }}>{subtitle}</Typography>
              {children}
            </Box>
          </motion.div>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
