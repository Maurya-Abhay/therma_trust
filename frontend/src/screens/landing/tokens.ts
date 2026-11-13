import type { Theme } from "@mui/material/styles";

/** The public pages' own palette and type: warm paper, ink, and one signal colour taken from thermography. */
export const L = {
  paper: "#EFE9DC",
  paperDeep: "#E3DAC7",
  card: "#F8F4EA",
  ink: "#0E1726",
  inkSoft: "#172236",
  rule: "rgba(14,23,38,0.2)",
  ruleLight: "rgba(239,233,220,0.2)",
  teal: "#0D9488",
  tealDeep: "#0A6D64",
  heat: "#F2542D",
  cold: "#3E7CB1",
  amber: "#E8A317",
} as const;

export const FONT = {
  serif: 'var(--font-serif), "Instrument Serif", Georgia, "Times New Roman", serif',
  mono: 'var(--font-mono), "JetBrains Mono", ui-monospace, monospace',
  wordmark: 'var(--font-wordmark), "Big Shoulders", Impact, "Arial Narrow", sans-serif',
  body: 'var(--font-jakarta), "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

/** Printed-paper grain, drawn once as an SVG noise tile. */
export const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Drafting-paper grid: fine lines every 32px, stronger every 160px. */
export const gridBackground = (line: string, strong: string) => ({
  backgroundImage: [
    `linear-gradient(${strong} 1px, transparent 1px)`,
    `linear-gradient(90deg, ${strong} 1px, transparent 1px)`,
    `linear-gradient(${line} 1px, transparent 1px)`,
    `linear-gradient(90deg, ${line} 1px, transparent 1px)`,
  ].join(","),
  backgroundSize: "160px 160px, 160px 160px, 32px 32px, 32px 32px",
});

/** The ink outline colour for the current colour mode (paper-toned in dark mode). */
export const lineColor = (th: Theme) => (th.palette.mode === "dark" ? "rgba(239,233,220,0.5)" : L.ink);

export const mono = {
  fontFamily: FONT.mono,
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  fontSize: 12,
  fontWeight: 500,
};
