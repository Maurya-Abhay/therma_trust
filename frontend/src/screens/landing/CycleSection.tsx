"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Container, Stack, Typography } from "@mui/material";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { EASE, Reveal } from "../../components/motion";
import { blink, flow, spin } from "./art";
import { FONT, GRAIN, L, gridBackground, mono } from "./tokens";

const STAGES = [
  {
    key: "compressor",
    name: "Compressor",
    title: "Only qualified hands",
    body: "Jobs on high-pressure equipment are risk-scored, then matched only to technicians whose passports prove the capability. Everyone else is blocked, with the reason.",
    tag: "Risk-based job matching",
    at: [690, 230],
  },
  {
    key: "condenser",
    name: "Condenser",
    title: "Every kilogram has a name",
    body: "Refrigerant added or recovered moves a cylinder's ledger. Type and capacity are checked at the time, so nothing has to be guessed afterwards.",
    tag: "Cylinder chain-of-custody",
    at: [380, 90],
  },
  {
    key: "valve",
    name: "Expansion valve",
    title: "Leaks show up early",
    body: "Added charge over system charge on a 365-day window, plus an early warning when superheat, subcooling or amps drift across visits.",
    tag: "Leak-rate and drift detection",
    at: [90, 230],
  },
  {
    key: "evaporator",
    name: "Evaporator",
    title: "Sealed into history",
    body: "Each report writes an audit entry sealed with the hash of the one before it. Clients and regulators re-check it from a QR code.",
    tag: "Tamper-evident audit log",
    at: [380, 370],
  },
] as const;

const HOT = "M690 198 V110 Q690 90 670 90 H110 Q90 90 90 110 V198";
const COLD = "M90 262 V350 Q90 370 110 370 H670 Q690 370 690 350 V262";
const ZIG = (x: number, y: number, w: number, rows: number, gap: number) =>
  `M${x} ${y} ` + Array.from({ length: rows }, (_, i) => `H${i % 2 ? x : x + w} ${i < rows - 1 ? `v${gap}` : ""}`).join(" ");

function Diagram({ active, onPick }: { active: number; onPick: (i: number) => void }) {
  const dim = (i: number) => (i === active ? 1 : 0.55);
  return (
    <svg viewBox="0 0 780 470" width="100%" role="img" aria-label="Refrigeration cycle: compressor, condenser, expansion valve and evaporator" style={{ display: "block", overflow: "visible" }}>
      {/* pipes */}
      {[[HOT, L.heat], [COLD, L.cold]].map(([d, c]) => (
        <g key={d}>
          <path d={d} stroke={c} strokeOpacity=".28" strokeWidth="12" fill="none" strokeLinecap="round" />
          <Box component="path" d={d} stroke={c} strokeWidth="3.5" strokeDasharray="10 18" fill="none" sx={{ animation: `${flow} 1.4s linear infinite` }} />
        </g>
      ))}

      {/* condenser (top) */}
      <g opacity={dim(1)} style={{ transition: "opacity .4s" }}>
        <rect x="296" y="62" width="168" height="56" fill={L.inkSoft} stroke={L.paper} strokeWidth="2.5" />
        <path d={ZIG(312, 76, 136, 4, 10)} stroke={L.heat} strokeWidth="3" fill="none" />
        <g transform="translate(380 38)">
          <circle r="22" fill={L.inkSoft} stroke={L.paper} strokeWidth="2.5" />
          <Box component="g" sx={{ transformBox: "fill-box", transformOrigin: "center", animation: `${spin} 1.1s linear infinite` }}>
            {[0, 1, 2].map((k) => (
              <path key={k} d="M0 -2 C 6 -10 16 -12 20 -4 C 12 -2 6 2 0 2Z" transform={`rotate(${k * 120})`} fill={L.paper} />
            ))}
          </Box>
        </g>
      </g>

      {/* evaporator (bottom) */}
      <g opacity={dim(3)} style={{ transition: "opacity .4s" }}>
        <rect x="296" y="342" width="168" height="56" fill={L.inkSoft} stroke={L.paper} strokeWidth="2.5" />
        <path d={ZIG(312, 356, 136, 4, 10)} stroke={L.cold} strokeWidth="3" fill="none" />
        {[326, 380, 434].map((x) => (
          <path key={x} d={`M${x} 410 v10 M${x - 4} 414 l4 -4 l4 4`} stroke={L.cold} strokeWidth="2" fill="none" strokeLinecap="round" />
        ))}
      </g>

      {/* expansion valve (left) */}
      <g opacity={dim(2)} style={{ transition: "opacity .4s" }}>
        <path d="M66 208 L114 252 V208 L66 252Z" fill={L.paper} stroke={L.paper} strokeWidth="2" strokeLinejoin="round" />
        <path d="M90 230 V196" stroke={L.paper} strokeWidth="3" />
        <circle cx="90" cy="192" r="6" fill={L.heat} />
      </g>

      {/* compressor (right) */}
      <g opacity={dim(0)} style={{ transition: "opacity .4s" }}>
        <circle cx="690" cy="230" r="38" fill={L.inkSoft} stroke={L.paper} strokeWidth="2.5" />
        <g transform="translate(690 230)">
          <Box component="g" sx={{ transformBox: "fill-box", transformOrigin: "center", animation: `${spin} 2.2s linear infinite` }}>
            {[0, 1, 2].map((k) => (
              <path key={k} d="M0 -3 C 8 -16 24 -18 30 -6 C 18 -4 8 3 0 3Z" transform={`rotate(${k * 120})`} fill={L.paper} />
            ))}
          </Box>
        </g>
        <circle cx="690" cy="230" r="6" fill={L.teal} />
      </g>

      {/* labels */}
      <text x="122" y="124" fontFamily={FONT.mono} fontSize="10" letterSpacing="1.2" fill={L.heat}>HIGH PRESSURE · HOT GAS</text>
      <text x="486" y="446" fontFamily={FONT.mono} fontSize="10" letterSpacing="1.2" fill={L.cold}>LOW PRESSURE · COLD</text>

      {/* hotspots */}
      {STAGES.map((s, i) => {
        const [x, y] = s.at;
        const on = i === active;
        const bx = i === 0 ? x : i === 2 ? x : x + 112;
        const by = i === 0 ? y - 66 : i === 2 ? y - 66 : y;
        return (
          <g key={s.key} role="button" tabIndex={0} aria-label={`${s.name}: ${s.title}`} onClick={() => onPick(i)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(i)} style={{ cursor: "pointer", outline: "none" }}>
            {on && (
              <Box component="circle" cx={bx} cy={by} r="20" fill="none" stroke={L.teal} strokeWidth="2" sx={{ animation: "tt-pulse-ring 1.8s ease-out infinite", transformBox: "fill-box", transformOrigin: "center" }} />
            )}
            <circle cx={bx} cy={by} r="16" fill={on ? L.teal : L.ink} stroke={on ? L.paper : L.paper} strokeOpacity={on ? 1 : 0.55} strokeWidth="2" />
            <text x={bx} y={by + 4.5} textAnchor="middle" fontFamily={FONT.mono} fontWeight="700" fontSize="12" fill={on ? L.ink : L.paper}>{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function CycleSection() {
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });

  // Walks through the cycle on its own while it is on screen, until someone takes over.
  useEffect(() => {
    if (!inView || hold) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % STAGES.length), 5200);
    return () => window.clearTimeout(t);
  }, [inView, hold, active]);

  return (
    <Box id="cycle" ref={ref} sx={{ position: "relative", bgcolor: L.ink, color: L.paper, py: { xs: 9, md: 14 }, overflow: "hidden", scrollMarginTop: 70, ...gridBackground("rgba(239,233,220,0.045)", "rgba(239,233,220,0.08)") }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.18, mixBlendMode: "screen", pointerEvents: "none" }} />
      <Container maxWidth={false} sx={{ position: "relative", maxWidth: 1280, px: { xs: 2.5, md: 5 } }}>
        <Reveal>
          <Typography sx={{ ...mono, color: L.heat, mb: 2 }}>Follow the refrigerant</Typography>
          <Typography component="h2" sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: { xs: "2.7rem", md: "4.6rem" }, lineHeight: 0.98, letterSpacing: "-0.022em", maxWidth: 900 }}>
            Every stage of the cycle <Box component="span" sx={{ fontStyle: "italic", color: "#F6B8A6" }}>leaves evidence.</Box>
          </Typography>
        </Reveal>

        <Box sx={{ mt: { xs: 6, md: 9 }, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.25fr 0.75fr" }, gap: { xs: 5, lg: 7 }, alignItems: "center" }}>
          <Reveal>
            <Diagram active={active} onPick={(i) => { setActive(i); setHold(true); }} />
          </Reveal>

          <Stack spacing={0} onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
            {STAGES.map((s, i) => {
              const on = i === active;
              return (
                <Box
                  key={s.key}
                  component="button"
                  onClick={() => { setActive(i); setHold(true); }}
                  sx={{ all: "unset", cursor: "pointer", display: "block", position: "relative", py: 2.25, borderTop: `1px solid ${L.ruleLight}`, "&:last-of-type": { borderBottom: `1px solid ${L.ruleLight}` }, "&:focus-visible": { outline: `2px solid ${L.teal}`, outlineOffset: 2 } }}
                >
                  <Stack direction="row" spacing={2} alignItems="baseline">
                    <Typography sx={{ ...mono, color: on ? L.teal : "rgba(239,233,220,0.45)", minWidth: 26 }}>0{i + 1}</Typography>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontFamily: FONT.serif, fontSize: { xs: 26, md: 31 }, lineHeight: 1.05, color: on ? L.paper : "rgba(239,233,220,0.6)", transition: "color .3s" }}>{s.title}</Typography>
                      <AnimatePresence initial={false}>
                        {on && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }} style={{ overflow: "hidden" }}>
                            <Typography sx={{ mt: 1.25, fontSize: 15.5, lineHeight: 1.65, color: "rgba(239,233,220,0.78)" }}>{s.body}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" mt={1.75} sx={{ ...mono, fontSize: 11, color: L.teal }}>
                              <Box component="span" sx={{ width: 8, height: 8, bgcolor: L.teal, animation: `${blink} 1.6s steps(1) infinite` }} />
                              <span>{s.name} · {s.tag}</span>
                            </Stack>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Box>
                  </Stack>
                  {on && !hold && inView && (
                    <motion.div key={`${active}-bar`} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 5.2, ease: "linear" }} style={{ position: "absolute", left: 0, right: 0, top: -1, height: 2, background: L.teal, transformOrigin: "left" }} />
                  )}
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
