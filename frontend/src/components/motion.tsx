import { useEffect, useRef, type ReactNode } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from "framer-motion";
import { Box } from "@mui/material";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its children into place the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  once = true,
  ...rest
}: { children: ReactNode; delay?: number; y?: number; once?: boolean } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const stagger = {
  hidden: {},
  show: (gap: number) => ({ transition: { staggerChildren: gap, delayChildren: 0.05 } }),
};
const staggerItem = {
  hidden: { opacity: 0, y: 22, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } },
};

/** Container whose <StaggerItem> children animate in one after another. */
export function Stagger({
  children,
  gap = 0.08,
  inView = true,
  ...rest
}: { children: ReactNode; gap?: number; inView?: boolean } & Omit<HTMLMotionProps<"div">, "children" | "custom">) {
  return (
    <motion.div
      variants={stagger}
      custom={gap}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true, margin: "-60px" } } : { animate: "show" })}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...rest }: { children: ReactNode } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div variants={staggerItem} {...rest}>
      {children}
    </motion.div>
  );
}

/** Counts up to `value` when it first becomes visible. */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1.4,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const format = (n: number) =>
      `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
    if (!inView) {
      node.textContent = format(0);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (n) => {
        node.textContent = format(n);
      },
    });
    return () => controls.stop();
  }, [inView, value, decimals, duration, prefix, suffix]);

  return <span ref={ref}>{`${prefix}${(0).toFixed(decimals)}${suffix}`}</span>;
}

/** Cursor-following 3D tilt. Disabled on touch (no pointer move events there). */
export function TiltCard({ children, max = 9, ...rest }: { children: ReactNode; max?: number } & Omit<HTMLMotionProps<"div">, "children">) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const springX = useSpring(rx, { stiffness: 160, damping: 18 });
  const springY = useSpring(ry, { stiffness: 160, damping: 18 });

  return (
    <motion.div
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const rect = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        ry.set(px * max * 2);
        rx.set(-py * max * 2);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      style={{ rotateX: springX, rotateY: springY, transformPerspective: 1100, transformStyle: "preserve-3d" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** A card with a soft spotlight that follows the cursor across its surface. */
export function SpotlightCard({
  children,
  color = "rgba(13,148,136,0.16)",
  sx,
  ...rest
}: { children: ReactNode; color?: string; sx?: object } & Omit<HTMLMotionProps<"div">, "children">) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      ref={ref}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: EASE }}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        el.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }}
      {...rest}
    >
      <Box
        sx={{
          position: "relative",
          height: "100%",
          borderRadius: "20px",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: `radial-gradient(420px circle at var(--mx, 50%) var(--my, 0%), ${color}, transparent 60%)`,
            opacity: 0,
            transition: "opacity 0.3s ease",
            pointerEvents: "none",
          },
          "&:hover::before": { opacity: 1 },
          ...sx,
        }}
      >
        {children}
      </Box>
    </motion.div>
  );
}

/** Thin gradient bar at the top of the page that fills as the visitor scrolls. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.3 });
  return (
    <motion.div
      style={{
        scaleX,
        transformOrigin: "0 50%",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 1300,
        background: "linear-gradient(90deg,#2DD4BF,#38BDF8,#FBBF24)",
      }}
    />
  );
}

/** Slow-moving blurred colour blobs that give dark sections depth. */
export function Aurora({ intensity = 1 }: { intensity?: number }) {
  const blob = (sx: object) => ({
    position: "absolute" as const,
    borderRadius: "50%",
    filter: "blur(90px)",
    opacity: 0.55 * intensity,
    animation: "tt-drift 18s ease-in-out infinite",
    ...sx,
  });
  return (
    <Box aria-hidden sx={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <Box sx={blob({ width: 520, height: 520, top: "-12%", left: "-8%", background: "#0D9488" })} />
      <Box sx={blob({ width: 460, height: 460, top: "10%", right: "-6%", background: "#2563EB", animationDelay: "-6s" })} />
      <Box sx={blob({ width: 380, height: 380, bottom: "-14%", left: "34%", background: "#F59E0B", opacity: 0.22 * intensity, animationDelay: "-11s" })} />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse at 50% 30%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, #000 20%, transparent 75%)",
        }}
      />
    </Box>
  );
}

/** Parallax helper: moves its child slower/faster than the page scroll. */
export function Parallax({ children, offset = 60 }: { children: ReactNode; offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  return (
    <motion.div ref={ref} style={{ y }}>
      {children}
    </motion.div>
  );
}
