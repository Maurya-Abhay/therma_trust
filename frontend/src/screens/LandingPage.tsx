"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { Box, Button, Container, IconButton, Stack } from "@mui/material";
import { MotionConfig, motion, useScroll, useSpring } from "framer-motion";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Logo } from "../components/Logo";
import { Hero } from "./landing/Hero";
import { CycleSection } from "./landing/CycleSection";
import { FeatureSheet } from "./landing/FeatureSheet";
import { Journey } from "./landing/Journey";
import { AuditSection } from "./landing/AuditChain";
import { Roles } from "./landing/Roles";
import { Cta, Ribbon, Stats } from "./landing/Closing";
import { L, mono } from "./landing/tokens";

const NAV = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Audit trail", href: "#audit" },
  { label: "Roles", href: "#roles" },
];

function Progress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  return <motion.div aria-hidden style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: L.heat, transformOrigin: "left", scaleX, zIndex: 1300 }} />;
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Box
      component="header"
      sx={{
        position: "fixed", top: 3, left: 0, right: 0, zIndex: 1200,
        transition: "background-color .3s, box-shadow .3s, backdrop-filter .3s",
        bgcolor: scrolled || open ? "rgba(239,233,220,0.93)" : "transparent",
        backdropFilter: scrolled || open ? "blur(10px)" : "none",
        boxShadow: scrolled ? `0 2px 0 ${L.ink}` : "none",
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1280, px: { xs: 2.5, md: 5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 68 }}>
          <NextLink href="/" style={{ textDecoration: "none" }} aria-label="ThermaTrust home">
            <Logo size={36} />
          </NextLink>
          <Stack direction="row" spacing={4} sx={{ display: { xs: "none", md: "flex" } }}>
            {NAV.map((n, i) => (
              <Box
                key={n.href}
                component="a"
                href={n.href}
                sx={{ ...mono, fontSize: 12, color: L.ink, textDecoration: "none", position: "relative", py: 0.5, "&::after": { content: '""', position: "absolute", left: 0, right: 0, bottom: 0, height: 2, bgcolor: L.heat, transform: "scaleX(0)", transformOrigin: "left", transition: "transform .3s" }, "&:hover::after": { transform: "scaleX(1)" } }}
              >
                <Box component="span" sx={{ color: L.heat, mr: 0.75 }}>0{i + 1}</Box>
                {n.label}
              </Box>
            ))}
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button component={NextLink} href="/login" sx={{ display: { xs: "none", sm: "inline-flex" }, color: L.ink, borderRadius: "3px", px: 2 }}>
              Sign in
            </Button>
            <Button
              component={NextLink}
              href="/register"
              sx={{ display: { xs: "none", sm: "inline-flex" }, borderRadius: "3px", px: 2.5, bgcolor: L.ink, color: L.paper, boxShadow: `3px 3px 0 ${L.heat}`, transition: "transform .15s, box-shadow .15s", "&:hover": { bgcolor: L.ink, transform: "translate(2px, 2px)", boxShadow: `1px 1px 0 ${L.heat}` } }}
            >
              Get started
            </Button>
            <IconButton aria-label="Menu" onClick={() => setOpen((v) => !v)} sx={{ color: L.ink, display: { md: "none" } }}>
              {open ? <CloseRoundedIcon /> : <MenuRoundedIcon />}
            </IconButton>
          </Stack>
        </Stack>
        {open && (
          <Stack spacing={0} sx={{ pb: 2, display: { md: "none" } }}>
            {[...NAV, { label: "Sign in", href: "/login" }, { label: "Get started", href: "/register" }].map((n) => (
              <Box
                key={n.label}
                component={n.href.startsWith("#") ? "a" : NextLink}
                href={n.href}
                onClick={() => setOpen(false)}
                sx={{ ...mono, fontSize: 13, color: L.ink, textDecoration: "none", py: 1.5, borderTop: `1px solid ${L.rule}` }}
              >
                {n.label}
              </Box>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <Box
        sx={{
          bgcolor: L.paper,
          color: L.ink,
          overflowX: "clip",
          "@media (prefers-reduced-motion: reduce)": { "& *": { animationDuration: "0.001s !important", animationIterationCount: "1 !important" } },
        }}
      >
        <Progress />
        <Nav />
        <Hero />
        <Ribbon />
        <Stats />
        <CycleSection />
        <FeatureSheet />
        <Journey />
        <AuditSection />
        <Roles />
        <Cta />
      </Box>
    </MotionConfig>
  );
}
