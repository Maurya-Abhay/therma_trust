"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box, Container, Stack, Typography } from "@mui/material";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useScroll } from "framer-motion";
import { EASE, Reveal } from "../../components/motion";
import { Cylinder, Stamp, Thermometer } from "./art";
import { FONT, GRAIN, L, gridBackground, mono } from "./tokens";

const STEPS = [
  { n: "01", title: "Prove who can do what", body: "Technicians upload credentials and take scored assessments. Admins confirm, and a passport is issued." },
  { n: "02", title: "Dispatch with confidence", body: "Facility managers raise jobs. The platform rates the risk and blocks assignments nobody is qualified for." },
  { n: "03", title: "Report, reconcile, prove", body: "Reports tie refrigerant to cylinders, flag drift and leaks, and write a sealed audit entry for each action." },
];

const paper = { bgcolor: L.card, border: `2px solid ${L.ink}`, boxShadow: `6px 6px 0 ${L.ink}` };

function StepProve() {
  return (
    <Stack direction="row" alignItems="center" spacing={{ xs: 1.5, sm: 3 }} justifyContent="center" sx={{ position: "relative" }}>
      <motion.div initial={{ opacity: 0, x: -40, rotate: -6 }} animate={{ opacity: 1, x: 0, rotate: -3 }} transition={{ duration: 0.8, ease: EASE }}>
        <Box sx={{ ...paper, width: { xs: 120, sm: 150 }, p: 1.5 }}>
          <Typography sx={{ ...mono, fontSize: 9, color: "rgba(14,23,38,0.55)" }}>Uploaded credential</Typography>
          <Typography sx={{ fontFamily: FONT.serif, fontSize: 20, lineHeight: 1, mt: 0.5 }}>EPA 608<br />Universal</Typography>
          {[88, 70, 80, 52].map((w, i) => (
            <Box key={i} sx={{ height: 5, width: `${w}%`, bgcolor: "rgba(14,23,38,0.14)", mt: i ? 0.75 : 1.25 }} />
          ))}
        </Box>
      </motion.div>
      <motion.svg width="46" height="24" viewBox="0 0 46 24" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
        <motion.path d="M2 12 H40 M32 4 L42 12 L32 20" stroke={L.ink} strokeWidth="2.5" fill="none" strokeLinecap="square" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.7, duration: 0.7 }} />
      </motion.svg>
      <motion.div initial={{ opacity: 0, x: 40, rotate: 5 }} animate={{ opacity: 1, x: 0, rotate: 2 }} transition={{ duration: 0.8, delay: 1.1, ease: EASE }} style={{ position: "relative" }}>
        <Box sx={{ ...paper, width: { xs: 130, sm: 170 }, p: 1.5 }}>
          <Typography sx={{ ...mono, fontSize: 9, color: "rgba(14,23,38,0.55)" }}>Capability passport</Typography>
          <Typography sx={{ fontFamily: FONT.serif, fontSize: 21, lineHeight: 1, mt: 0.5 }}>Arjun Senior</Typography>
          <Stack spacing={0.5} mt={1.25}>
            {["Chillers", "R-410A", "A2L safety"].map((c) => (
              <Stack key={c} direction="row" spacing={0.75} alignItems="center" sx={{ fontSize: 11.5, fontWeight: 700 }}>
                <Box sx={{ width: 9, height: 9, bgcolor: L.teal }} /> <span>{c}</span>
              </Stack>
            ))}
          </Stack>
        </Box>
        <motion.div initial={{ opacity: 0, scale: 2.6, rotate: -34 }} animate={{ opacity: 0.94, scale: 1, rotate: -14 }} transition={{ delay: 2.0, duration: 0.3, ease: [0.5, 0, 0.9, 0.3] }} style={{ position: "absolute", right: -26, bottom: -34, mixBlendMode: "multiply" }}>
          <Stamp size={104} />
        </motion.div>
      </motion.div>
    </Stack>
  );
}

function StepDispatch() {
  const rows = [
    { name: "Maria D.", note: "Missing R-404A", ok: false },
    { name: "Dev K.", note: "A2L safety expired", ok: false },
    { name: "Arjun S.", note: "Fully qualified", ok: true },
  ];
  return (
    <Stack direction="row" alignItems="center" spacing={{ xs: 1.5, sm: 4 }} justifyContent="center">
      <Stack alignItems="center">
        <Thermometer level={82} height={190} />
        <Typography sx={{ ...mono, fontSize: 10.5, color: L.heat, fontWeight: 700, mt: -0.5 }}>Job risk 82 · High</Typography>
      </Stack>
      <Stack spacing={1.25} sx={{ width: { xs: 190, sm: 250 } }}>
        <Typography sx={{ ...mono, fontSize: 10, color: "rgba(14,23,38,0.55)" }}>Job A-118 · Walk-in cooler · R-404A</Typography>
        {rows.map((r, i) => (
          <motion.div key={r.name} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.35, duration: 0.7, ease: EASE }}>
            <Box sx={{ ...paper, boxShadow: r.ok ? `5px 5px 0 ${L.teal}` : `3px 3px 0 rgba(14,23,38,0.35)`, borderColor: r.ok ? L.teal : "rgba(14,23,38,0.4)", px: 1.5, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: r.ok ? 1 : 0.62 }}>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 14, textDecoration: r.ok ? "none" : "line-through", textDecorationColor: L.heat, textDecorationThickness: 2 }}>{r.name}</Typography>
                <Typography sx={{ ...mono, fontSize: 9.5, color: r.ok ? L.tealDeep : L.heat }}>{r.note}</Typography>
              </Box>
              <Box sx={{ ...mono, fontSize: 10, fontWeight: 700, px: 1, py: 0.4, bgcolor: r.ok ? L.teal : "transparent", color: r.ok ? "#fff" : L.heat, border: `1.5px solid ${r.ok ? L.ink : L.heat}` }}>{r.ok ? "Matched" : "Blocked"}</Box>
            </Box>
          </motion.div>
        ))}
      </Stack>
    </Stack>
  );
}

function StepProveIt() {
  const [level, setLevel] = useState(64);
  useEffect(() => {
    const t = window.setTimeout(() => setLevel(61), 1300);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <Stack direction="row" alignItems="center" spacing={{ xs: 1.5, sm: 4 }} justifyContent="center">
      <Cylinder level={level} height={200} />
      <Stack spacing={1.5} sx={{ width: { xs: 190, sm: 240 } }}>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7, ease: EASE }}>
          <Box sx={{ ...paper, p: 1.5 }}>
            <Typography sx={{ ...mono, fontSize: 9.5, color: "rgba(14,23,38,0.55)" }}>Service report #214</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 15, mt: 0.25 }}>Recovered 2.8 kg R-410A</Typography>
            <Typography sx={{ ...mono, fontSize: 9.5, color: L.tealDeep, mt: 0.5 }}>Cylinder CYL-0042 · 64% → 61%</Typography>
          </Box>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 0.7, ease: EASE }}>
          <Box sx={{ bgcolor: L.ink, color: L.paper, p: 1.5, border: `2px solid ${L.ink}`, boxShadow: `6px 6px 0 ${L.heat}` }}>
            <Typography sx={{ ...mono, fontSize: 9.5, color: L.heat }}>Audit entry sealed</Typography>
            <Typography sx={{ ...mono, fontSize: 11, letterSpacing: "0.04em", mt: 0.5, textTransform: "none" }}>#1045 · hash 3f9a1c07</Typography>
            <Typography sx={{ ...mono, fontSize: 10, letterSpacing: "0.04em", opacity: 0.6, textTransform: "none" }}>prev 7d38b6f1</Typography>
          </Box>
        </motion.div>
      </Stack>
    </Stack>
  );
}

const VISUALS: ReactNode[] = [<StepProve key="a" />, <StepDispatch key="b" />, <StepProveIt key="c" />];

/** Starts a visual's own animation only once it has scrolled into view. */
function OnView({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-20%" });
  return <div ref={ref} style={{ width: "100%", minHeight: 260 }}>{seen ? children : null}</div>;
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ position: "relative", minHeight: { xs: 300, md: 430 }, display: "grid", placeItems: "center", p: { xs: 2, md: 4 }, bgcolor: "rgba(14,23,38,0.05)", overflow: "hidden", "&::before, &::after": { content: '""', position: "absolute", width: 18, height: 18, borderColor: L.ink, borderStyle: "solid" }, "&::before": { top: 8, left: 8, borderWidth: "2px 0 0 2px" }, "&::after": { bottom: 8, right: 8, borderWidth: "0 2px 2px 0" } }}>
      {children}
    </Box>
  );
}

export function Journey() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.max(0, Math.min(2, Math.floor(v * 3 - 0.0001)))));

  const heading = (
    <Reveal>
      <Typography sx={{ ...mono, color: L.heat, mb: 2 }}>How it works</Typography>
      <Typography component="h2" sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: { xs: "2.7rem", md: "4.2rem" }, lineHeight: 0.98, letterSpacing: "-0.022em" }}>
        From credential to proof <Box component="span" sx={{ fontStyle: "italic" }}>in three steps.</Box>
      </Typography>
    </Reveal>
  );

  return (
    <Box id="how" sx={{ position: "relative", bgcolor: L.paperDeep, color: L.ink, scrollMarginTop: 70, ...gridBackground("rgba(14,23,38,0.05)", "rgba(14,23,38,0.09)") }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.3, mixBlendMode: "multiply", pointerEvents: "none" }} />

      {/* wide screens: pinned, driven by scroll */}
      <Box ref={ref} sx={{ display: { xs: "none", md: "block" }, height: "340vh", position: "relative" }}>
        <Box sx={{ position: "sticky", top: 0, height: "100vh", display: "flex", alignItems: "center" }}>
          <Container maxWidth={false} sx={{ maxWidth: 1280, px: 5 }}>
            <Box sx={{ mb: 6 }}>{heading}</Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 8, alignItems: "center" }}>
              <Box>
                <Stack direction="row" spacing={1} mb={3}>
                  {STEPS.map((s, i) => (
                    <Box key={s.n} sx={{ flex: 1, height: 4, bgcolor: "rgba(14,23,38,0.15)", position: "relative", overflow: "hidden" }}>
                      <motion.div animate={{ scaleX: i <= step ? 1 : 0 }} transition={{ duration: 0.6, ease: EASE }} style={{ position: "absolute", inset: 0, background: L.ink, transformOrigin: "left" }} />
                    </Box>
                  ))}
                </Stack>
                <Box sx={{ position: "relative", minHeight: 250 }}>
                  <AnimatePresence mode="wait">
                    <motion.div key={step} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5, ease: EASE }}>
                      <Typography sx={{ fontFamily: FONT.wordmark, fontWeight: 900, fontSize: 120, lineHeight: 0.85, color: L.heat, letterSpacing: "0.01em" }}>{STEPS[step].n}</Typography>
                      <Typography component="h3" sx={{ fontFamily: FONT.serif, fontSize: 46, lineHeight: 1, letterSpacing: "-0.015em", mt: 1.5 }}>{STEPS[step].title}</Typography>
                      <Typography sx={{ mt: 2, fontSize: 17, lineHeight: 1.7, color: "rgba(14,23,38,0.75)", maxWidth: 440 }}>{STEPS[step].body}</Typography>
                    </motion.div>
                  </AnimatePresence>
                </Box>
                <Typography sx={{ ...mono, fontSize: 11, color: "rgba(14,23,38,0.5)", mt: 2 }}>Keep scrolling ↓</Typography>
              </Box>
              <Frame>
                <AnimatePresence mode="wait">
                  <motion.div key={step} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.4 }} style={{ width: "100%" }}>
                    {VISUALS[step]}
                  </motion.div>
                </AnimatePresence>
              </Frame>
            </Box>
          </Container>
        </Box>
      </Box>

      {/* phones: plain stack, nothing pinned */}
      <Container maxWidth={false} sx={{ display: { xs: "block", md: "none" }, position: "relative", px: 2.5, py: 9 }}>
        <Box sx={{ mb: 5 }}>{heading}</Box>
        <Stack spacing={7}>
          {STEPS.map((s, i) => (
            <Reveal key={s.n}>
              <Typography sx={{ fontFamily: FONT.wordmark, fontWeight: 900, fontSize: 72, lineHeight: 0.85, color: L.heat }}>{s.n}</Typography>
              <Typography component="h3" sx={{ fontFamily: FONT.serif, fontSize: 34, lineHeight: 1, mt: 1 }}>{s.title}</Typography>
              <Typography sx={{ mt: 1.5, mb: 3, fontSize: 16, lineHeight: 1.65, color: "rgba(14,23,38,0.75)" }}>{s.body}</Typography>
              <Frame><OnView>{VISUALS[i]}</OnView></Frame>
            </Reveal>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
