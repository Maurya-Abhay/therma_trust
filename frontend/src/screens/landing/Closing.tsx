"use client";

import { useRef } from "react";
import NextLink from "next/link";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { motion, useInView } from "framer-motion";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { AnimatedNumber, EASE, Reveal } from "../../components/motion";
import { spin, Stamp } from "./art";
import { FONT, GRAIN, L, gridBackground, mono } from "./tokens";

const TICKER = [
  "EPA 608 Type I", "EPA 608 Type II", "EPA 608 Type III", "Universal", "R-410A", "R-32", "R-454B", "R-134a",
  "R-404A", "R-22 recovery", "Walk-in coolers", "Chillers", "Rooftop units", "VRF systems", "Cold storage",
];

/** A tilted ribbon of the things the platform tracks, running across the page like a warning tape. */
export function Ribbon() {
  const items = [...TICKER, ...TICKER];
  return (
    <Box sx={{ position: "relative", zIndex: 3, mt: { xs: -3, md: -4 }, mb: { xs: 3, md: 5 }, py: 1, overflow: "hidden", transform: "rotate(-1.4deg)", mx: "-2%", bgcolor: L.ink, color: L.paper, borderTop: `3px solid ${L.heat}`, borderBottom: `3px solid ${L.heat}` }}>
      <Box sx={{ display: "flex", width: "max-content", animation: "tt-marquee 46s linear infinite", "&:hover": { animationPlayState: "paused" } }}>
        {items.map((t, i) => (
          <Stack key={`${t}-${i}`} direction="row" alignItems="center" sx={{ px: 2.25, py: 0.9, ...mono, fontSize: 12.5, whiteSpace: "nowrap" }}>
            <Box sx={{ width: 7, height: 7, bgcolor: i % 3 === 0 ? L.heat : i % 3 === 1 ? L.teal : L.cold, mr: 2.25 }} />
            {t}
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

export function Stats() {
  const stats = [
    { value: 256, suffix: "-bit", label: "SHA-256 hash chain on every audit entry" },
    { value: 365, suffix: " days", label: "Rolling window for every leak-rate calculation" },
    { value: 4, suffix: "", label: "Purpose-built workspaces, one per role" },
    { value: 1, suffix: " scan", label: "Is all a client needs to re-verify a technician live" },
  ];
  return (
    <Box sx={{ position: "relative", bgcolor: L.paper, color: L.ink, pb: { xs: 8, md: 12 }, pt: { xs: 5, md: 7 }, overflow: "hidden" }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.3, mixBlendMode: "multiply", pointerEvents: "none" }} />
      <Container maxWidth={false} sx={{ position: "relative", maxWidth: 1280, px: { xs: 2.5, md: 5 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, borderTop: `2px solid ${L.ink}`, borderBottom: `2px solid ${L.ink}` }}>
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4.5 }, borderLeft: { md: i ? `1.5px solid ${L.rule}` : "none" }, borderTop: { xs: i > 1 ? `1.5px solid ${L.rule}` : "none", md: "none" }, height: "100%" }}>
                <Typography sx={{ fontFamily: FONT.serif, fontSize: { xs: 54, md: 84 }, lineHeight: 0.95, letterSpacing: "-0.03em" }}>
                  <AnimatedNumber value={s.value} suffix={s.suffix} />
                </Typography>
                <Typography sx={{ mt: 1.5, fontSize: 14, lineHeight: 1.55, color: "rgba(14,23,38,0.68)", maxWidth: 220 }}>{s.label}</Typography>
              </Box>
            </Reveal>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export function Cta() {
  return (
    <Box sx={{ position: "relative", bgcolor: L.ink, color: L.paper, overflow: "hidden", pt: { xs: 10, md: 15 }, pb: { xs: 3, md: 5 }, ...gridBackground("rgba(239,233,220,0.04)", "rgba(239,233,220,0.07)") }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.18, mixBlendMode: "screen", pointerEvents: "none" }} />
      <Container maxWidth={false} sx={{ position: "relative", maxWidth: 1280, px: { xs: 2.5, md: 5 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr auto" }, gap: 6, alignItems: "center" }}>
          <Reveal>
            <Typography component="h2" sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: { xs: "3rem", sm: "4.6rem", md: "6.4rem" }, lineHeight: 0.93, letterSpacing: "-0.028em" }}>
              Make trust the easiest part <Box component="span" sx={{ fontStyle: "italic", color: "#F6B8A6" }}>of every job.</Box>
            </Typography>
            <Typography sx={{ mt: 3.5, color: "rgba(239,233,220,0.72)", fontSize: 18, lineHeight: 1.65, maxWidth: 520 }}>
              Set up in minutes. Your first passport, job and sealed audit entry are one sign-up away.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2, sm: 2.5 }} mt={5}>
              <Button
                component={NextLink}
                href="/register"
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{ px: 4, py: 1.7, fontSize: 16.5, borderRadius: "3px", bgcolor: L.paper, color: L.ink, boxShadow: `6px 6px 0 ${L.heat}`, transition: "transform .18s, box-shadow .18s", "&:hover": { bgcolor: L.paper, transform: "translate(3px, 3px)", boxShadow: `3px 3px 0 ${L.heat}` } }}
              >
                Get started free
              </Button>
              <Button component={NextLink} href="/login" sx={{ px: 4, py: 1.7, fontSize: 16.5, borderRadius: "3px", color: L.paper, border: `2px solid ${L.paper}`, "&:hover": { bgcolor: "rgba(239,233,220,0.1)" } }}>
                Sign in
              </Button>
            </Stack>
          </Reveal>

          <Box sx={{ display: { xs: "none", md: "block" }, position: "relative", width: 300, height: 300 }} aria-hidden>
            <Box sx={{ position: "absolute", inset: 0, animation: `${spin} 40s linear infinite` }}>
              <svg viewBox="0 0 300 300" width="300" height="300">
                <defs><path id="cta-ring" d="M150 150 m-118 0 a118 118 0 1 1 236 0 a118 118 0 1 1 -236 0" /></defs>
                <text fontFamily={FONT.mono} fontSize="14" letterSpacing="6.4" fill={L.paper} fillOpacity=".7">
                  <textPath href="#cta-ring">VERIFIED · TRACKED · SEALED · VERIFIED · TRACKED · SEALED · </textPath>
                </text>
              </svg>
            </Box>
            <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <motion.div initial={{ scale: 2.2, opacity: 0, rotate: -40 }} whileInView={{ scale: 1, opacity: 0.95, rotate: -12 }} viewport={{ once: true }} transition={{ duration: 0.35, ease: [0.5, 0, 0.9, 0.3], delay: 0.3 }}>
                <Stamp size={170} color={L.heat} />
              </motion.div>
            </Box>
          </Box>
        </Box>

        <Footer />
      </Container>
    </Box>
  );
}

/** The name, set huge in its own typeface so it is the last thing anyone sees. */
function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  // Watch the whole word, not the letters: they start hidden behind a mask, so they never count as visible themselves.
  const shown = useInView(ref, { once: true, margin: "-8%" });
  const word = "THERMA";
  const tail = "TRUST";
  const letters = (s: string, color: string, offset: number) =>
    s.split("").map((c, i) => (
      <Box key={`${s}${i}`} component="span" sx={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", lineHeight: 0.84 }}>
        <motion.span initial={{ y: "105%" }} animate={{ y: shown ? 0 : "105%" }} transition={{ duration: 0.9, delay: (offset + i) * 0.055, ease: EASE }} style={{ display: "inline-block", color }}>
          {c}
        </motion.span>
      </Box>
    ));
  return (
    <Box component="footer" sx={{ mt: { xs: 10, md: 14 } }}>
      <Box ref={ref} aria-label="ThermaTrust" sx={{ fontFamily: FONT.wordmark, fontWeight: 900, fontSize: { xs: "calc((100vw - 40px) / 5.9)", md: "min(calc((100vw - 80px) / 5.9), 203px)" }, lineHeight: 0.84, letterSpacing: "0.012em", textTransform: "uppercase", whiteSpace: "nowrap", textAlign: "center", userSelect: "none" }}>
        {letters(word, L.paper, 0)}
        {letters(tail, L.heat, word.length)}
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${L.ruleLight}`, ...mono, fontSize: 11.5, color: "rgba(239,233,220,0.6)" }}>
        <span>A trust and compliance layer for commercial HVAC and refrigeration work.</span>
        <Stack direction="row" spacing={3}>
          {[["Sign in", "/login"], ["Register", "/register"]].map(([l, to]) => (
            <Box key={to} component={NextLink} href={to} sx={{ color: "inherit", textDecoration: "none", "&:hover": { color: L.paper } }}>{l}</Box>
          ))}
          <span>© {new Date().getFullYear()} ThermaTrust</span>
        </Stack>
      </Stack>
    </Box>
  );
}
