import type { ElementType } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { AnimatedNumber, EASE } from "./motion";
import { FONT, L, lineColor, mono } from "../screens/landing/tokens";

// Callers pass whatever colour suits the number; these fold it into the brand palette.
const TONES: Record<string, { fill: string; text: string }> = {
  "#0d9488": { fill: L.teal, text: "#fff" },
  "#2563eb": { fill: L.cold, text: "#fff" },
  "#0ea5e9": { fill: L.cold, text: "#fff" },
  "#e11d48": { fill: L.heat, text: "#fff" },
  "#7c3aed": { fill: L.amber, text: L.ink },
  "#f59e0b": { fill: L.amber, text: L.ink },
  "#64748b": { fill: L.paperDeep, text: L.ink },
};

/** KPI tile: stamped square icon, big serif number, lifts on hover. */
export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "#0D9488",
  decimals = 0,
  hint,
}: {
  label: string;
  value: number;
  unit?: string;
  icon?: ElementType;
  tone?: string;
  decimals?: number;
  hint?: string;
}) {
  const t = TONES[tone.toLowerCase()] ?? { fill: tone, text: "#fff" };
  return (
    <motion.div whileHover={{ x: -2, y: -2 }} transition={{ duration: 0.2, ease: EASE }} style={{ height: "100%" }}>
      <Paper sx={{ position: "relative", height: "100%", p: 2.75, "&:hover": { boxShadow: (th) => `7px 7px 0 ${th.palette.mode === "dark" ? "rgba(239,233,220,0.2)" : L.ink}` } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
          <Typography sx={{ ...mono, fontSize: 11, color: "text.secondary", maxWidth: "75%", lineHeight: 1.5 }}>{label}</Typography>
          {Icon && (
            <Box sx={{ width: 38, height: 38, display: "grid", placeItems: "center", bgcolor: t.fill, color: t.text, border: 2, borderColor: lineColor, borderRadius: "3px", flexShrink: 0 }}>
              <Icon fontSize="small" />
            </Box>
          )}
        </Box>
        <Typography sx={{ fontFamily: FONT.serif, fontSize: 52, lineHeight: 0.95, letterSpacing: "-0.03em" }}>
          <AnimatedNumber value={value} decimals={decimals} />
          {unit && (
            <Typography component="span" sx={{ ...mono, fontSize: 12, color: "text.secondary", ml: 1, letterSpacing: "0.08em" }}>
              {unit}
            </Typography>
          )}
        </Typography>
        {hint && <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 1.25 }}>{hint}</Typography>}
      </Paper>
    </motion.div>
  );
}
