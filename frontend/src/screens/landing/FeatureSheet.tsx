"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box, Container, Stack, Typography } from "@mui/material";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { EASE, Reveal } from "../../components/motion";
import { Cylinder, Gauge, Thermometer } from "./art";
import { FONT, GRAIN, L, mono } from "./tokens";

const chip = (bg: string, fg: string, border = "transparent") => ({ bgcolor: bg, color: fg, border: `1.5px solid ${border}` });

function PassportChips() {
  const items: [string, ReturnType<typeof chip>][] = [
    ["Verified", chip(L.teal, "#fff", L.ink)],
    ["Pending review", chip("transparent", L.ink, L.ink)],
    ["Expiring in 30d", chip(L.amber, L.ink, L.ink)],
    ["Outdated copy", chip(L.heat, "#fff", L.ink)],
  ];
  return (
    <Stack direction="row" flexWrap="wrap" gap={1.25} justifyContent="center" sx={{ maxWidth: 330 }}>
      {items.map(([label, s], i) => (
        <motion.div key={label} initial={{ opacity: 0, scale: 1.6, rotate: i % 2 ? 6 : -6 }} whileInView={{ opacity: 1, scale: 1, rotate: i % 2 ? 2 : -2 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.22, duration: 0.3, ease: [0.5, 0, 0.9, 0.3] }}>
          <Box sx={{ ...mono, fontSize: 12, fontWeight: 700, px: 1.75, py: 0.8, boxShadow: `3px 3px 0 ${L.ink}`, ...s }}>{label}</Box>
        </motion.div>
      ))}
    </Stack>
  );
}

function ChainMini() {
  const hashes = ["a91f", "5be2", "c04a", "7d38"];
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setLit((n) => (n + 1) % hashes.length), 1100);
    return () => window.clearInterval(t);
  }, [hashes.length]);
  return (
    <Stack direction="row" alignItems="center">
      {hashes.map((h, i) => (
        <Stack key={h} direction="row" alignItems="center">
          <Box sx={{ width: 62, py: 1.1, textAlign: "center", border: `2px solid ${L.ink}`, bgcolor: lit === i ? L.ink : L.card, color: lit === i ? L.paper : L.ink, transition: "all .25s", ...mono, fontSize: 12, letterSpacing: "0.04em" }}>
            {h}
          </Box>
          {i < hashes.length - 1 && <Box sx={{ width: 16, height: 2, bgcolor: L.ink }} />}
        </Stack>
      ))}
    </Stack>
  );
}

function GaugeCycle() {
  const states = [
    { v: 4, label: "Chiller A · within limit", over: false },
    { v: 27, label: "Walk-in 3 · over limit", over: true },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % states.length), 3600);
    return () => window.clearInterval(t);
  }, [states.length]);
  return (
    <Stack alignItems="center" spacing={0.5}>
      <Gauge value={states[i].v} size={230} label="Leak rate gauge" />
      <Box sx={{ ...mono, fontSize: 11.5, fontWeight: 700, px: 1.5, py: 0.6, bgcolor: states[i].over ? L.heat : L.teal, color: "#fff", transition: "background-color .3s" }}>
        {states[i].v}% · {states[i].label}
      </Box>
    </Stack>
  );
}

function AlertSlips() {
  const slips = [
    ["Credential expires in 30 days", L.amber],
    ["Walk-in 3 leak rate over 20%", L.heat],
    ["Job idle for 5 days", L.cold],
  ] as const;
  return (
    <Stack spacing={1.25} sx={{ width: "100%", maxWidth: 330 }}>
      {slips.map(([text, color], i) => (
        <motion.div key={text} initial={{ opacity: 0, x: 60 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.25, duration: 0.7, ease: EASE }}>
          <Stack direction="row" sx={{ bgcolor: L.card, border: `2px solid ${L.ink}`, boxShadow: `4px 4px 0 ${L.ink}` }}>
            <Box sx={{ width: 10, bgcolor: color }} />
            <Box sx={{ px: 1.5, py: 1 }}>
              <Typography sx={{ ...mono, fontSize: 9.5, color: "rgba(14,23,38,0.55)" }}>Alert</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: L.ink }}>{text}</Typography>
            </Box>
          </Stack>
        </motion.div>
      ))}
    </Stack>
  );
}

function PhoneQueue() {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setOnline((v) => !v), 2800);
    return () => window.clearInterval(t);
  }, []);
  return (
    <Box sx={{ width: 150, height: 226, border: `3px solid ${L.ink}`, borderRadius: "22px", bgcolor: L.card, boxShadow: `6px 6px 0 ${L.ink}`, p: 1.5, display: "flex", flexDirection: "column" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ ...mono, fontSize: 9.5 }}>
        <span>{online ? "Online" : "No signal"}</span>
        <Stack direction="row" alignItems="flex-end" spacing="2px">
          {[6, 9, 12, 15].map((h, i) => (
            <Box key={h} sx={{ width: 4, height: h, bgcolor: online || i === 0 ? L.ink : "rgba(14,23,38,0.2)", transition: "background-color .3s" }} />
          ))}
        </Stack>
      </Stack>
      <Box sx={{ mt: 1.25, flex: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
        {["Report #212", "Report #213", "Report #214"].map((r, i) => (
          <Box key={r} sx={{ border: `1.5px solid ${L.ink}`, px: 1, py: 0.75, fontSize: 11, fontWeight: 700, color: online ? L.paper : L.ink, bgcolor: online ? L.teal : "transparent", transition: `all .35s ${i * 0.12}s`, display: "flex", justifyContent: "space-between" }}>
            <span>{r}</span>
            <span>{online ? "Sent" : "Queued"}</span>
          </Box>
        ))}
      </Box>
      <Typography sx={{ ...mono, fontSize: 9.5, textAlign: "center", color: online ? L.tealDeep : L.heat }}>{online ? "Sending now" : "3 waiting"}</Typography>
    </Box>
  );
}

const FEATURES: { title: string; body: string; visual: ReactNode }[] = [
  {
    title: "Capability passports",
    body: "Equipment, refrigerant and safety capabilities in one verifiable record. Credentials are read by AI, then confirmed by a human reviewer, and every passport prints as a PDF with a scannable QR.",
    visual: <PassportChips />,
  },
  {
    title: "Tamper-evident audit log",
    body: "Each entry is sealed with the hash of the one before it. Change history and the chain visibly breaks.",
    visual: <ChainMini />,
  },
  {
    title: "Risk-based job matching",
    body: "Jobs are scored by equipment criticality and refrigerant hazard, then matched only to people qualified for them.",
    visual: <Thermometer level={82} height={210} />,
  },
  {
    title: "Cylinder chain-of-custody",
    body: "Every cylinder has a ledger. Refrigerant added or recovered moves its balance, with safety checks on type and capacity.",
    visual: <Cylinder level={64} tag="R-410A" height={210} />,
  },
  {
    title: "Proactive compliance alerts",
    body: "Expiring credentials, over-threshold leaks and idle jobs reach the right role in-app and by email digest.",
    visual: <AlertSlips />,
  },
  {
    title: "Leak-rate and drift detection",
    body: "Added charge over system charge on a 365-day window, plus an early warning when superheat, subcooling or amps drift across visits.",
    visual: <GaugeCycle />,
  },
  {
    title: "Offline-first field app",
    body: "Install it on a phone. Reports queue on-device with no signal and send themselves when it returns.",
    visual: <PhoneQueue />,
  },
];

function Row({ n, f }: { n: number; f: (typeof FEATURES)[number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12%" });
  return (
    <Box
      ref={ref}
      sx={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "56px 1fr 330px" },
        gap: { xs: 2.5, md: 4 },
        alignItems: "center",
        py: { xs: 4, md: 5 },
        px: { xs: 0, md: 2 },
        transition: "background-color .35s",
        "&:hover": { bgcolor: "rgba(248,244,234,0.75)" },
        "&:hover .row-n": { color: L.heat },
      }}
    >
      <motion.div initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : undefined} transition={{ duration: 1.1, ease: EASE }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: L.ink, transformOrigin: "left" }} />
      <Typography className="row-n" sx={{ ...mono, fontSize: 13, color: "rgba(14,23,38,0.5)", transition: "color .3s" }}>{String(n).padStart(2, "0")}</Typography>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.8, delay: 0.1, ease: EASE }}>
        <Typography component="h3" sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: { xs: "2rem", md: "2.7rem" }, lineHeight: 1, letterSpacing: "-0.015em", mb: 1.5 }}>{f.title}</Typography>
        <Typography sx={{ fontSize: 16, lineHeight: 1.7, color: "rgba(14,23,38,0.74)", maxWidth: 520 }}>{f.body}</Typography>
      </motion.div>
      <Box sx={{ position: "relative", minHeight: 230, display: "grid", placeItems: "center", bgcolor: "rgba(14,23,38,0.045)", "&::before, &::after": { content: '""', position: "absolute", width: 14, height: 14, borderColor: L.ink, borderStyle: "solid" }, "&::before": { top: 6, left: 6, borderWidth: "2px 0 0 2px" }, "&::after": { bottom: 6, right: 6, borderWidth: "0 2px 2px 0" } }}>
        <AnimatePresence>{inView && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} style={{ display: "grid", placeItems: "center", width: "100%", padding: 16 }}>{f.visual}</motion.div>}</AnimatePresence>
      </Box>
    </Box>
  );
}

export function FeatureSheet() {
  return (
    <Box id="features" sx={{ position: "relative", bgcolor: L.paper, color: L.ink, py: { xs: 9, md: 14 }, scrollMarginTop: 70 }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.3, mixBlendMode: "multiply", pointerEvents: "none" }} />
      <Container maxWidth={false} sx={{ position: "relative", maxWidth: 1280, px: { xs: 2.5, md: 5 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.62fr 1.38fr" }, gap: { xs: 5, lg: 8 }, alignItems: "start" }}>
          <Box sx={{ position: { lg: "sticky" }, top: { lg: 120 } }}>
            <Reveal>
              <Typography sx={{ ...mono, color: L.heat, mb: 2 }}>Specification</Typography>
              <Typography component="h2" sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: { xs: "2.7rem", md: "4rem" }, lineHeight: 0.98, letterSpacing: "-0.022em" }}>
                Built around real safety rules, <Box component="span" sx={{ fontStyle: "italic" }}>not a generic checklist.</Box>
              </Typography>
              <Typography sx={{ mt: 3, fontSize: 16.5, lineHeight: 1.7, color: "rgba(14,23,38,0.72)", maxWidth: 380 }}>
                Seven things the platform does for you, each one drawn from how commercial refrigeration actually gets serviced.
              </Typography>
            </Reveal>
          </Box>
          <Box sx={{ borderBottom: `2px solid ${L.ink}` }}>
            {FEATURES.map((f, i) => (
              <Row key={f.title} n={i + 1} f={f} />
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
