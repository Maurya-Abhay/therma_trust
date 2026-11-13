"use client";

import { useId, useMemo, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { keyframes } from "@emotion/react";
import { Box } from "@mui/material";
import { EASE } from "../../components/motion";
import { FONT, L } from "./tokens";

export const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
export const flow = keyframes`to { stroke-dashoffset: -28; }`;
export const rise = keyframes`0% { transform: translateY(0); opacity: 0; } 25% { opacity: 0.8; } 100% { transform: translateY(-52px); opacity: 0; }`;
export const blink = keyframes`0%, 62% { opacity: 1; } 72%, 100% { opacity: 0.2; }`;
export const drift = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
export const steam = keyframes`0% { transform: translate(0, 0) scale(0.6); opacity: 0; } 20% { opacity: 0.55; } 100% { transform: translate(10px, -70px) scale(1.7); opacity: 0; }`;

const around = { transformBox: "fill-box", transformOrigin: "center" } as const;

/** Polar to cartesian, angle in degrees measured from the positive x axis, y pointing down. */
const pt = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x0, y0] = pt(cx, cy, r, from);
  const [x1, y1] = pt(cx, cy, r, to);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to > from ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const BLADE = "M0 -5 C 16 -24 46 -28 70 -12 C 52 -8 26 6 0 5 Z";

/** A commercial condensing unit, front elevation, with both fans turning and heat rising off the top. */
export function Condenser({ still = false }: { still?: boolean }) {
  const fans = [170, 350];
  return (
    <g>
      {/* heat shimmer */}
      {[140, 250, 360].map((x, i) => (
        <Box
          key={x}
          component="path"
          d={`M${x} 94 q7 -11 0 -22 t0 -22`}
          fill="none"
          stroke={L.heat}
          strokeWidth="2.5"
          strokeLinecap="round"
          sx={still ? { opacity: 0.5 } : { animation: `${rise} 3.4s ease-out ${i * 1.1}s infinite`, opacity: 0 }}
        />
      ))}

      {/* feet and body */}
      <rect x="92" y="360" width="46" height="14" fill={L.ink} />
      <rect x="402" y="360" width="46" height="14" fill={L.ink} />
      <rect x="70" y="110" width="400" height="250" rx="4" fill={L.card} stroke={L.ink} strokeWidth="3" />
      <rect x="60" y="94" width="420" height="18" rx="3" fill="#CFC5AC" stroke={L.ink} strokeWidth="3" />

      {/* side panel seam and rivets */}
      <path d="M88 126 V344 M452 126 V344" stroke={L.ink} strokeOpacity=".25" strokeWidth="1.5" />
      {[130, 224, 318].map((y) => (
        <g key={y}>
          <circle cx="79" cy={y} r="2" fill={L.ink} fillOpacity=".5" />
          <circle cx="461" cy={y} r="2" fill={L.ink} fillOpacity=".5" />
        </g>
      ))}

      {/* fans */}
      {fans.map((cx, n) => (
        <g key={cx} transform={`translate(${cx} 228)`}>
          <circle r="82" fill="#E6DFCD" stroke={L.ink} strokeWidth="2.5" />
          <Box
            component="g"
            sx={still ? undefined : { ...around, animation: `${spin} ${n ? 1.3 : 1.6}s linear infinite` }}
          >
            {[0, 1, 2, 3, 4].map((k) => (
              <path key={k} d={BLADE} transform={`rotate(${k * 72})`} fill={L.ink} fillOpacity=".9" />
            ))}
          </Box>
          <circle r="10" fill={L.teal} stroke={L.ink} strokeWidth="2.5" />
          {/* guard */}
          {[72, 56, 40, 24].map((r) => (
            <circle key={r} r={r} fill="none" stroke={L.ink} strokeOpacity=".5" strokeWidth="1.5" />
          ))}
          {Array.from({ length: 12 }, (_, k) => {
            const [x, y] = pt(0, 0, 82, k * 30);
            return <path key={k} d={`M0 0 L${x.toFixed(1)} ${y.toFixed(1)}`} stroke={L.ink} strokeOpacity=".28" strokeWidth="1.5" />;
          })}
        </g>
      ))}

      {/* louvres */}
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M214 ${322 + i * 7} H326`} stroke={L.ink} strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" />
      ))}

      {/* nameplate */}
      <rect x="92" y="322" width="104" height="30" fill={L.paper} stroke={L.ink} strokeWidth="1.5" />
      <text x="100" y="335" fontFamily={FONT.mono} fontSize="8.5" fontWeight="600" fill={L.ink}>R-410A · 11.8 KG</text>
      <text x="100" y="346" fontFamily={FONT.mono} fontSize="8" fill={L.ink} fillOpacity=".6">UNIT TT-0147</text>

      {/* controls */}
      <rect x="352" y="322" width="84" height="30" fill={L.ink} />
      <Box component="circle" cx="366" cy="337" r="4.5" fill={L.teal} sx={still ? undefined : { animation: `${blink} 1.8s steps(1) infinite` }} />
      <rect x="378" y="332" width="48" height="4" fill={L.paper} fillOpacity=".5" />
      <rect x="378" y="340" width="30" height="4" fill={L.paper} fillOpacity=".3" />

      {/* pipework: hot gas out, cold return in */}
      <path d="M470 190 H524" stroke={L.heat} strokeWidth="9" />
      <path d="M470 232 H524" stroke={L.cold} strokeWidth="9" />
      {[190, 232].map((y) => (
        <Box
          key={y}
          component="path"
          d={`M470 ${y} H524`}
          stroke={L.paper}
          strokeWidth="2.5"
          strokeDasharray="6 8"
          sx={still ? undefined : { animation: `${flow} 1.1s linear infinite` }}
          style={y === 232 ? { animationDirection: "reverse" } : undefined}
        />
      ))}
      <rect x="520" y="180" width="10" height="62" fill={L.ink} />
    </g>
  );
}

/** Mini needle-and-dial gauge. `value` of `max` is where the needle settles. */
export function Gauge({ value, max = 30, limit = 20, label, size = 220 }: { value: number; max?: number; limit?: number; label?: string; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const toDeg = (v: number) => 180 + (v / max) * 180;
  const ticks = Array.from({ length: max / 5 + 1 }, (_, i) => i * 5);
  return (
    <svg ref={ref} viewBox="-16 0 252 150" width={size} height={(size * 150) / 252} role="img" aria-label={label ?? `Gauge reading ${value}`}>
      <path d={arc(110, 120, 84, 180, toDeg(limit))} stroke={L.teal} strokeWidth="14" fill="none" />
      <path d={arc(110, 120, 84, toDeg(limit), 360)} stroke={L.heat} strokeWidth="14" fill="none" />
      <path d={arc(110, 120, 100, 180, 360)} stroke={L.ink} strokeWidth="2" fill="none" />
      {ticks.map((t) => {
        const [x0, y0] = pt(110, 120, 94, toDeg(t));
        const [x1, y1] = pt(110, 120, 106, toDeg(t));
        const [tx, ty] = pt(110, 120, 118, toDeg(t));
        return (
          <g key={t}>
            <path d={`M${x0} ${y0} L${x1} ${y1}`} stroke={L.ink} strokeWidth="2" />
            <text x={tx} y={ty + 3} textAnchor="middle" fontFamily={FONT.mono} fontSize="9" fill={L.ink} fillOpacity=".7">{t}</text>
          </g>
        );
      })}
      <g transform="translate(110 120)">
        {/* the needle is drawn symmetrically (lower half invisible) so its box centre is the hub it pivots on */}
        <motion.g
          initial={{ rotate: -90 }}
          animate={{ rotate: inView || reduce ? toDeg(value) - 270 : -90 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 9, mass: 1.1, delay: 0.2 }}
        >
          <path d="M0 0 L0 -68" stroke={L.ink} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M0 0 L0 68" stroke="transparent" strokeWidth="1" />
        </motion.g>
      </g>
      <circle cx="110" cy="120" r="9" fill={L.ink} />
      <circle cx="110" cy="120" r="3" fill={L.paper} />
    </svg>
  );
}

/** A refrigerant cylinder whose contents rise to `level` percent. */
export function Cylinder({ level, tag = "R-410A", height = 220 }: { level: number; tag?: string; height?: number }) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const bodyTop = 58;
  const bodyH = 142;
  const fill = (bodyH * level) / 100;
  return (
    <svg ref={ref} viewBox="0 0 150 220" height={height} width={(height * 150) / 220} role="img" aria-label={`${tag} cylinder at ${level} percent`}>
      <defs>
        <clipPath id={`${id}-c`}>
          <path d="M34 62 Q34 48 50 46 H70 Q86 48 86 62 V196 Q86 204 78 204 H42 Q34 204 34 196 Z" />
        </clipPath>
      </defs>
      {/* valve */}
      <rect x="52" y="14" width="16" height="14" fill={L.ink} />
      <rect x="44" y="8" width="32" height="8" rx="2" fill={L.ink} />
      <rect x="56" y="28" width="8" height="12" fill={L.ink} />
      <rect x="76" y="10" width="34" height="6" rx="2" fill={L.heat} />
      <rect x="44" y="38" width="32" height="8" fill={L.ink} />
      <path d="M34 62 Q34 48 50 46 H70 Q86 48 86 62 V196 Q86 204 78 204 H42 Q34 204 34 196 Z" fill={L.card} stroke={L.ink} strokeWidth="3" />
      <g clipPath={`url(#${id}-c)`}>
        <motion.rect
          x="30"
          width="60"
          fill={L.teal}
          initial={{ y: bodyTop + bodyH, height: 0 }}
          animate={inView ? { y: bodyTop + bodyH - fill + 2, height: fill } : undefined}
          transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
        />
        <rect x="34" y="62" width="9" height="150" fill={L.paper} fillOpacity=".35" />
      </g>
      <rect x="34" y="96" width="52" height="34" fill={L.ink} />
      <text x="60" y="118" textAnchor="middle" fontFamily={FONT.wordmark} fontWeight="900" fontSize="14" letterSpacing="0.6" fill={L.paper}>{tag}</text>
      {[0, 25, 50, 75, 100].map((p) => {
        const y = bodyTop + bodyH - (bodyH * p) / 100 + 2;
        return (
          <g key={p}>
            <path d={`M94 ${y} H${p % 50 === 0 ? 108 : 102}`} stroke={L.ink} strokeWidth="2" />
            {p % 50 === 0 && <text x="112" y={y + 3} fontFamily={FONT.mono} fontSize="9" fill={L.ink} fillOpacity=".7">{p}</text>}
          </g>
        );
      })}
      <rect x="30" y="204" width="60" height="8" fill={L.ink} />
    </svg>
  );
}

/** Risk thermometer: the column climbs to `level` percent and changes colour band as it goes. */
export function Thermometer({ level, height = 220 }: { level: number; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const color = level < 34 ? L.cold : level < 67 ? L.amber : L.heat;
  const top = 16;
  const span = 150;
  const h = (span * level) / 100;
  return (
    <svg ref={ref} viewBox="0 0 150 220" height={height} width={(height * 150) / 220} role="img" aria-label={`Risk ${level} out of 100`}>
      <rect x="44" y={top} width="22" height="172" rx="11" fill={L.card} stroke={L.ink} strokeWidth="3" />
      <circle cx="55" cy="190" r="26" fill={L.card} stroke={L.ink} strokeWidth="3" />
      <rect x="40" y="160" width="30" height="30" fill={L.card} />
      <motion.rect
        x="50"
        width="10"
        rx="5"
        fill={color}
        initial={{ y: top + span + 10, height: 0 }}
        animate={inView ? { y: top + span + 14 - h, height: h } : undefined}
        transition={{ duration: 1.5, ease: EASE, delay: 0.15 }}
      />
      <circle cx="55" cy="190" r="17" fill={color} />
      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => {
        const y = top + span + 14 - (span * p) / 100;
        const major = p % 50 === 0;
        return (
          <g key={p}>
            <path d={`M72 ${y} H${major ? 90 : 82}`} stroke={L.ink} strokeWidth="2" />
            {major && <text x="96" y={y + 3} fontFamily={FONT.mono} fontSize="9" fill={L.ink} fillOpacity=".7">{p === 0 ? "LOW" : p === 50 ? "MED" : "HIGH"}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Rounded isotherm lines, like a heat map read from above. */
export function Contours({ count = 13, seed = 1, hot = 3, ink = L.ink, hotColor = L.heat, inkOpacity = 0.1 }: { count?: number; seed?: number; hot?: number; ink?: string; hotColor?: string; inkOpacity?: number }) {
  const paths = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r0 = 36 + i * 30;
        const pts = Array.from({ length: 96 }, (_, k) => {
          const th = (k / 96) * Math.PI * 2;
          const r = r0 * (1 + 0.13 * Math.sin(3 * th + i * 0.55 + seed) + 0.07 * Math.sin(5 * th - i * 0.4 + seed * 2) + 0.04 * Math.sin(8 * th + i));
          return `${(500 + r * Math.cos(th)).toFixed(1)} ${(500 + r * Math.sin(th)).toFixed(1)}`;
        });
        return `M${pts.join(" L")}Z`;
      }),
    [count, seed]
  );
  return (
    <svg viewBox="0 0 1000 1000" width="100%" height="100%" aria-hidden preserveAspectRatio="xMidYMid slice">
      <Box component="g" sx={{ ...around, animation: `${drift} 220s linear infinite` }}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={i < hot ? hotColor : ink} strokeOpacity={i < hot ? 0.5 - i * 0.1 : inkOpacity} strokeWidth={i < hot ? 2 : 1.3} />
        ))}
      </Box>
    </svg>
  );
}

/** Rooftops of the places this software protects: cold stores, hospitals, supermarkets, with units on top. */
export function Skyline({ stroke = L.ink, fill = L.paperDeep }: { stroke?: string; fill?: string }) {
  const blocks = useMemo(() => {
    const out: { x: number; w: number; h: number; units: number[]; tower?: boolean }[] = [];
    let x = -20;
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    while (x < 1640) {
      const w = 90 + Math.floor(rnd() * 120);
      const h = 50 + Math.floor(rnd() * 130);
      const units = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => 10 + Math.floor(rnd() * (w - 50)));
      out.push({ x, w, h, units, tower: rnd() > 0.82 });
      x += w + 6;
    }
    return out;
  }, []);
  return (
    <svg viewBox="0 0 1600 240" width="100%" preserveAspectRatio="xMidYMax slice" aria-hidden style={{ display: "block" }}>
      {blocks.map((b, i) => {
        const top = 240 - b.h;
        return (
          <g key={i}>
            <rect x={b.x} y={top} width={b.w} height={b.h} fill={fill} stroke={stroke} strokeWidth="2" />
            {Array.from({ length: Math.floor(b.h / 22) }, (_, r) => (
              <path key={r} d={`M${b.x + 10} ${top + 14 + r * 22} H${b.x + b.w - 10}`} stroke={stroke} strokeOpacity=".18" strokeWidth="6" strokeDasharray="10 8" />
            ))}
            {b.units.map((u, k) => (
              <g key={k}>
                <rect x={b.x + u} y={top - 16} width="34" height="16" fill={L.card} stroke={stroke} strokeWidth="2" />
                <circle cx={b.x + u + 17} cy={top - 8} r="5.5" fill="none" stroke={stroke} strokeWidth="1.5" />
              </g>
            ))}
            {b.tower && (
              <g>
                <path d={`M${b.x + b.w / 2 - 22} ${top} L${b.x + b.w / 2 - 15} ${top - 34} H${b.x + b.w / 2 + 15} L${b.x + b.w / 2 + 22} ${top}Z`} fill={L.card} stroke={stroke} strokeWidth="2" />
                {[0, 1, 2].map((k) => (
                  <Box
                    key={k}
                    component="circle"
                    cx={b.x + b.w / 2}
                    cy={top - 38}
                    r="9"
                    fill={L.card}
                    stroke={stroke}
                    strokeOpacity=".5"
                    sx={{ animation: `${steam} 4.8s ease-out ${k * 1.6}s infinite`, opacity: 0, ...around }}
                  />
                ))}
              </g>
            )}
          </g>
        );
      })}
      <path d="M0 239 H1600" stroke={stroke} strokeWidth="3" />
    </svg>
  );
}

/** Round ink stamp: double ring, condensed capitals, a little uneven like a real one. */
export function Stamp({ word = "VERIFIED", sub = "THERMATRUST", size = 150, color = L.heat }: { word?: string; sub?: string; size?: number; color?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 150 150" width={size} height={size} aria-hidden>
      <defs>
        <filter id={`${id}-r`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
        </filter>
        <path id={`${id}-t`} d="M75 75 m-54 0 a54 54 0 1 1 108 0" />
        <path id={`${id}-b`} d="M75 75 m-60 0 a60 60 0 0 0 120 0" />
      </defs>
      <g filter={`url(#${id}-r)`} fill={color} stroke={color}>
        <circle cx="75" cy="75" r="70" fill="none" strokeWidth="4" />
        <circle cx="75" cy="75" r="63" fill="none" strokeWidth="1.5" />
        <circle cx="75" cy="75" r="42" fill="none" strokeWidth="1.5" />
        <text fontFamily={FONT.mono} fontSize="9.5" fontWeight="700" letterSpacing="3.2" stroke="none">
          <textPath href={`#${id}-t`} startOffset="50%" textAnchor="middle">{sub} · FIELD CHECKED</textPath>
        </text>
        <text fontFamily={FONT.mono} fontSize="9.5" fontWeight="700" letterSpacing="3.2" stroke="none">
          <textPath href={`#${id}-b`} startOffset="50%" textAnchor="middle">★ SEALED ★ TRACKED ★</textPath>
        </text>
        <text x="75" y="84" textAnchor="middle" fontFamily={FONT.wordmark} fontWeight="900" fontSize="22" letterSpacing="1" stroke="none">{word}</text>
      </g>
    </svg>
  );
}
