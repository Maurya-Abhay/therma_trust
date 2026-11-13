"use client";

import { useRef, type ReactNode } from "react";
import NextLink from "next/link";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { EASE } from "../../components/motion";
import { Condenser, Contours, Skyline, Stamp } from "./art";
import { FONT, GRAIN, L, gridBackground, mono } from "./tokens";

/** One line of the headline, rising out from behind a mask. */
function Line({ children, delay, italic = false }: { children: ReactNode; delay: number; italic?: boolean }) {
  return (
    <Box component="span" sx={{ display: "block", overflow: "hidden", pb: "0.06em", mb: "-0.06em" }}>
      <motion.span
        initial={{ y: "108%" }}
        animate={{ y: 0 }}
        transition={{ duration: 1.05, delay, ease: EASE }}
        style={{ display: "block", fontStyle: italic ? "italic" : "normal" }}
      >
        {children}
      </motion.span>
    </Box>
  );
}

/** A hand-drawn strike through "certified", marked on after the line has landed. */
function Strike({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
      <Box component="span" sx={{ opacity: 0.5 }}>{children}</Box>
      <svg viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden style={{ position: "absolute", left: "-3%", top: "42%", width: "106%", height: "0.34em", overflow: "visible" }}>
        <motion.path
          d="M2 26 C 60 8, 120 30, 180 14 S 276 20, 298 10"
          fill="none"
          stroke={L.heat}
          strokeWidth="9"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, delay: 1.7, ease: EASE }}
        />
      </svg>
    </Box>
  );
}

function Tag({ x, y, w, title, value, delay }: { x: number; y: number; w: number; title: string; value: string; delay: number }) {
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.5 }}>
      <rect x={x + 4} y={y + 4} width={w} height="40" fill={L.ink} fillOpacity=".18" />
      <rect x={x} y={y} width={w} height="40" fill={L.ink} />
      <text x={x + 10} y={y + 15} fontFamily={FONT.mono} fontSize="8.5" letterSpacing="1.2" fill={L.paper} fillOpacity=".62">{title}</text>
      <text x={x + 10} y={y + 32} fontFamily={FONT.wordmark} fontWeight="900" fontSize="19" letterSpacing="0.6" fill={L.paper}>{value}</text>
    </motion.g>
  );
}

function Leader({ d, delay }: { d: string; delay: number }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={L.ink}
      strokeWidth="1.8"
      strokeDasharray="1 0"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ delay, duration: 0.8, ease: EASE }}
    />
  );
}

function Scene() {
  return (
    <svg viewBox="0 0 620 490" width="100%" role="img" aria-label="A rooftop condensing unit with its refrigerant charge and leak rate called out" style={{ display: "block", overflow: "visible" }}>
      <g transform="translate(26 62)">
        <Condenser />
      </g>
      <Tag x={0} y={0} w={148} title="REFRIGERANT CHARGE" value="11.8 KG R-410A" delay={1.2} />
      <Leader d="M60 40 V 100 Q 60 110 70 120 L 120 262" delay={1.3} />
      <circle cx="120" cy="262" r="5" fill={L.heat} />
      <Tag x={452} y={4} w={150} title="LEAK RATE · 365 D" value="4.0%  LIMIT 20%" delay={1.5} />
      <Leader d="M540 44 V 244" delay={1.6} />
      <circle cx="540" cy="248" r="5" fill={L.heat} />

      {/* dimension line */}
      <g stroke={L.ink} strokeWidth="1.6" fill="none">
        <path d="M96 470 H500 M96 462 V478 M500 462 V478" />
      </g>
      <rect x="268" y="460" width="60" height="20" fill={L.paper} />
      <text x="298" y="474" textAnchor="middle" fontFamily={FONT.mono} fontSize="11" fontWeight="600" fill={L.ink}>2.4 M</text>
    </svg>
  );
}

const QR = Array.from({ length: 121 }, (_, i) => {
  const x = i % 11;
  const y = Math.floor(i / 11);
  const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
  return finder || (x * 7 + y * 13 + x * y) % 5 < 2;
});

function PassportCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: -6 }}
      animate={{ opacity: 1, y: 0, rotate: -2 }}
      transition={{ duration: 0.9, delay: 1.0, ease: EASE }}
      style={{ position: "relative", width: "100%" }}
    >
      {/* the card takes a hit when the stamp lands */}
      <motion.div animate={{ x: [0, 0, -5, 4, -2, 0], y: [0, 0, 3, -2, 1, 0] }} transition={{ delay: 2.35, duration: 0.45, times: [0, 0.01, 0.25, 0.5, 0.75, 1] }}>
        <Box sx={{ bgcolor: L.card, border: `2px solid ${L.ink}`, boxShadow: `9px 9px 0 ${L.ink}`, position: "relative" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: L.ink, color: L.paper, px: 1.75, py: 0.9, ...mono, fontSize: 10.5 }}>
            <span>Capability passport</span>
            <span style={{ opacity: 0.65 }}>No. TT-0147</span>
          </Stack>
          <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "1fr auto", gap: 2, alignItems: "start" }}>
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
                <Box sx={{ width: 46, height: 46, bgcolor: L.teal, color: L.card, display: "grid", placeItems: "center", fontFamily: FONT.wordmark, fontWeight: 900, fontSize: 22, letterSpacing: "0.04em", border: `2px solid ${L.ink}` }}>
                  AS
                </Box>
                <Box>
                  <Typography sx={{ fontFamily: FONT.serif, fontSize: 24, lineHeight: 1, color: L.ink }}>Arjun Senior</Typography>
                  <Typography sx={{ ...mono, fontSize: 10, color: "rgba(14,23,38,0.6)", mt: 0.5 }}>Senior technician</Typography>
                </Box>
              </Stack>
              <Stack spacing={0.6}>
                {["EPA 608 Universal", "Commercial chillers", "A2L refrigerant safety"].map((c) => (
                  <Stack key={c} direction="row" spacing={1} alignItems="center" sx={{ fontSize: 12.5, fontWeight: 600, color: L.ink }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: L.teal, display: "grid", placeItems: "center" }}>
                      <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4.2 3.1 6 7 1.6" stroke="#fff" strokeWidth="1.5" fill="none" /></svg>
                    </Box>
                    <span>{c}</span>
                  </Stack>
                ))}
              </Stack>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: "1.5px", width: 74, p: 0.75, bgcolor: "#fff", border: `1.5px solid ${L.ink}` }}>
              {QR.map((on, i) => (
                <Box key={i} sx={{ aspectRatio: "1", bgcolor: on ? L.ink : "transparent" }} />
              ))}
            </Box>
          </Box>
        </Box>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 2.6, rotate: -34 }}
        animate={{ opacity: 0.94, scale: 1, rotate: -14 }}
        transition={{ delay: 2.3, duration: 0.32, ease: [0.5, 0, 0.9, 0.3] }}
        style={{ position: "absolute", right: -40, bottom: -46, pointerEvents: "none", mixBlendMode: "multiply" }}
      >
        <Stamp size={132} />
      </motion.div>
    </motion.div>
  );
}

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const skylineY = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const contourY = useTransform(scrollYProgress, [0, 1], [0, 140]);

  // Pointer parallax: the drawing, the passport and the contours drift by different amounts.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const sceneX = useTransform(sx, (v) => v * -14);
  const sceneY = useTransform(sy, (v) => v * -10);
  const cardX = useTransform(sx, (v) => v * 20);
  const cardY = useTransform(sy, (v) => v * 14);
  const bgX = useTransform(sx, (v) => v * 8);

  return (
    <Box
      ref={ref}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      sx={{ position: "relative", bgcolor: L.paper, color: L.ink, overflow: "hidden", pt: { xs: 13, md: 15 }, ...gridBackground("rgba(14,23,38,0.05)", "rgba(14,23,38,0.09)") }}
    >
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.35, mixBlendMode: "multiply", pointerEvents: "none" }} />
      <motion.div aria-hidden style={{ position: "absolute", right: "-12%", top: "-18%", width: "78%", aspectRatio: "1", y: contourY, x: bgX }}>
        <Contours />
      </motion.div>

      <Container maxWidth={false} sx={{ position: "relative", zIndex: 2, maxWidth: 1280, px: { xs: 2.5, md: 5 } }}>
        <Stack direction="row" justifyContent="space-between" sx={{ ...mono, fontSize: 11, color: "rgba(14,23,38,0.6)", borderTop: `1.5px solid ${L.ink}`, pt: 1.25, mb: { xs: 5, md: 7 } }}>
          <span>Ref. TT-01 · Trust layer for commercial HVAC/R</span>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Evidence, not paperwork</Box>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.08fr 0.92fr" }, gap: { xs: 7, md: 4 }, alignItems: "center" }}>
          <Box>
            <Typography component="h1" sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: { xs: "3.5rem", sm: "5.2rem", md: "6.6rem", lg: "7.4rem" }, lineHeight: 0.92, letterSpacing: "-0.028em" }}>
              <Line delay={0.1}>Verified for</Line>
              <Line delay={0.22}>the job.</Line>
              <Line delay={0.4} italic>
                Not just <Strike>certified</Strike>.
              </Line>
            </Typography>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.0, ease: EASE }}>
              <Typography sx={{ mt: { xs: 4, md: 5 }, maxWidth: 520, fontSize: { xs: 16.5, md: 18 }, lineHeight: 1.65, color: "rgba(14,23,38,0.78)" }}>
                Know who is genuinely qualified, score job risk before you dispatch, and keep a tamper-evident record of every refrigerant
                kilogram. Regulators and clients can check it themselves, in one scan.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2, sm: 2.5 }} mt={4.5}>
                <Button
                  component={NextLink}
                  href="/register"
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{
                    px: 3.5, py: 1.6, fontSize: 16, borderRadius: "3px", bgcolor: L.ink, color: L.paper, boxShadow: `6px 6px 0 ${L.heat}`,
                    transition: "transform .18s ease, box-shadow .18s ease",
                    "&:hover": { bgcolor: L.ink, transform: "translate(3px, 3px)", boxShadow: `3px 3px 0 ${L.heat}` },
                    "&:active": { transform: "translate(6px, 6px)", boxShadow: `0 0 0 ${L.heat}` },
                  }}
                >
                  Create a free account
                </Button>
                <Button
                  component={NextLink}
                  href="/login"
                  sx={{ px: 3.5, py: 1.6, fontSize: 16, borderRadius: "3px", color: L.ink, border: `2px solid ${L.ink}`, "&:hover": { bgcolor: L.ink, color: L.paper } }}
                >
                  Sign in
                </Button>
              </Stack>
              <Stack direction="row" columnGap={3} rowGap={1} mt={5} flexWrap="wrap" sx={{ ...mono, fontSize: 11, color: "rgba(14,23,38,0.7)" }}>
                {["Tamper-evident audit log", "Works offline", "Public QR verification"].map((t) => (
                  <Stack key={t} direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 8, height: 8, bgcolor: L.teal }} />
                    <span>{t}</span>
                  </Stack>
                ))}
              </Stack>
            </motion.div>
          </Box>

          <Box sx={{ position: "relative", pb: { xs: 7, md: 10 }, minHeight: { md: 520 } }}>
            <motion.div style={{ x: sceneX, y: sceneY }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.3 }}>
              <Scene />
            </motion.div>
            {/* on a phone the card sits under the drawing; from tablet up it overlaps the unit's corner */}
            <Box sx={{ position: { xs: "relative", md: "absolute" }, left: { md: "-2%" }, bottom: { md: 0 }, width: { xs: "88%", sm: "70%", md: "min(330px, 64%)" }, mt: { xs: -6, md: 0 } }}>
              <motion.div style={{ x: cardX, y: cardY }}>
                <PassportCard />
              </motion.div>
            </Box>
          </Box>
        </Box>
      </Container>

      <motion.div style={{ y: skylineY, position: "relative", zIndex: 1, marginTop: -10 }}>
        <Skyline />
      </motion.div>
    </Box>
  );
}
