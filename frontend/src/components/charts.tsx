import { Box, Stack, Typography, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import { EASE } from "./motion";

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const scaled = value / base;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * base;
}

export interface BarPoint {
  label: string;
  a: number;
  b: number;
}

/** Two bars per category (e.g. added vs recovered per month), drawn as SVG. */
export function GroupedBarChart({
  data,
  aLabel,
  bLabel,
  aColor = "#3E7CB1",
  bColor = "#0D9488",
  unit = "kg",
}: {
  data: BarPoint[];
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  unit?: string;
}) {
  const theme = useTheme();
  const width = 760;
  const height = 260;
  const pad = { top: 16, right: 12, bottom: 34, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => [d.a, d.b])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.min(18, slot / 2.6);
  const muted = theme.palette.text.secondary;
  const summary = data.map((d) => `${d.label}: ${aLabel} ${d.a} ${unit}, ${bLabel} ${d.b} ${unit}`).join("; ");

  return (
    <Box>
      <Stack direction="row" spacing={2.5} mb={1} flexWrap="wrap" useFlexGap>
        {[
          [aLabel, aColor],
          [bLabel, bColor],
        ].map(([label, color]) => (
          <Stack key={label} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: color }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary" }}>{label}</Typography>
          </Stack>
        ))}
      </Stack>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={summary} style={{ display: "block" }}>
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke={theme.palette.divider} strokeWidth={1} />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={12} fill={muted}>
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const bars = [
            { value: d.a, color: aColor, x: cx - barW - 1, name: aLabel },
            { value: d.b, color: bColor, x: cx + 1, name: bLabel },
          ];
          return (
            <g key={d.label}>
              {bars.map((bar, j) => {
                const h = (bar.value / max) * innerH;
                return (
                  <motion.rect
                    key={bar.name}
                    x={bar.x}
                    width={barW}
                    rx={4}
                    fill={bar.color}
                    initial={{ y: pad.top + innerH, height: 0 }}
                    whileInView={{ y: pad.top + innerH - h, height: h }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.04 + j * 0.05, ease: EASE }}
                  >
                    <title>{`${d.label}: ${bar.name} ${bar.value} ${unit}`}</title>
                  </motion.rect>
                );
              })}
              <text x={cx} y={height - 12} textAnchor="middle" fontSize={12} fill={muted}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

export interface RateRow {
  label: string;
  sublabel?: string;
  value: number | null;
  threshold: number;
}

/** One horizontal bar per row with a marker at the threshold. */
export function ThresholdBars({ rows, unit = "%" }: { rows: RateRow[]; unit?: string }) {
  const theme = useTheme();
  const scaleMax = niceMax(Math.max(...rows.map((r) => Math.max(r.value ?? 0, r.threshold * 1.25)), 1));

  return (
    <Stack spacing={2.25}>
      {rows.map((row, i) => {
        const over = row.value !== null && row.value >= row.threshold;
        const color = row.value === null ? theme.palette.text.disabled : over ? theme.palette.error.main : "#0D9488";
        const pct = row.value === null ? 0 : Math.min(100, (row.value / scaleMax) * 100);
        const markerPct = Math.min(100, (row.threshold / scaleMax) * 100);
        return (
          <Box key={`${row.label}-${i}`}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={0.75} spacing={2}>
              <Box minWidth={0}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: 15 }}>{row.label}</Typography>
                {row.sublabel && <Typography noWrap sx={{ fontSize: 12.5, color: "text.secondary" }}>{row.sublabel}</Typography>}
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 15, color, whiteSpace: "nowrap" }}>
                {row.value === null ? "No data" : `${row.value}${unit}`}
              </Typography>
            </Stack>
            <Box
              role="img"
              aria-label={`${row.label}: ${row.value === null ? "no data" : `${row.value}${unit}`}, limit ${row.threshold}${unit}`}
              sx={{ position: "relative", height: 12, borderRadius: 99, bgcolor: "action.hover" }}
            >
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.06, ease: EASE }}
                style={{ height: "100%", borderRadius: 99, background: color }}
              />
              <Box
                title={`Limit ${row.threshold}${unit}`}
                sx={{ position: "absolute", top: -4, bottom: -4, left: `${markerPct}%`, width: 2.5, bgcolor: "text.primary", borderRadius: 2, opacity: 0.7 }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
