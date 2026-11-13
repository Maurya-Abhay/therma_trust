"use client";

import { useMemo, type ElementType } from "react";
import NextLink from "next/link";
import { Box, Container, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import EngineeringRoundedIcon from "@mui/icons-material/EngineeringRounded";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { EASE, Reveal } from "../../components/motion";
import { FONT, GRAIN, L, mono } from "./tokens";

const swing = keyframes`
  0% { transform: rotate(0deg); }
  25% { transform: rotate(3.5deg); }
  50% { transform: rotate(-2.5deg); }
  75% { transform: rotate(1.2deg); }
  100% { transform: rotate(0deg); }
`;

const ROLES: { role: string; icon: ElementType; title: string; body: string; accent: string; id: string }[] = [
  { role: "facility_manager", icon: ApartmentRoundedIcon, title: "Facility Manager", body: "Register equipment, raise jobs and see risk before you dispatch.", accent: L.teal, id: "WS-01" },
  { role: "technician", icon: EngineeringRoundedIcon, title: "Technician", body: "Build your passport, work offline, and take jobs you're verified for.", accent: L.heat, id: "WS-02" },
  { role: "contractor_manager", icon: BusinessCenterRoundedIcon, title: "Contractor Manager", body: "Run your roster, cylinders and compliance score in one place.", accent: L.amber, id: "WS-03" },
  { role: "admin", icon: AdminPanelSettingsRoundedIcon, title: "Admin", body: "Review credentials and keep the audit trail clean and verifiable.", accent: L.cold, id: "WS-04" },
];

function Barcode({ seed }: { seed: number }) {
  const bars = useMemo(() => {
    let s = seed * 97 + 13;
    return Array.from({ length: 38 }, () => ((s = (s * 9301 + 49297) % 233280), 1 + Math.floor((s / 233280) * 4)));
  }, [seed]);
  return (
    <Box sx={{ display: "flex", alignItems: "stretch", height: 26, gap: "2px" }} aria-hidden>
      {bars.map((w, i) => (
        <Box key={i} sx={{ width: w, bgcolor: L.ink, opacity: i % 7 === 3 ? 0.35 : 0.9 }} />
      ))}
    </Box>
  );
}

export function Roles() {
  return (
    <Box id="roles" sx={{ position: "relative", bgcolor: L.paper, color: L.ink, py: { xs: 9, md: 14 }, scrollMarginTop: 70, overflow: "hidden" }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.3, mixBlendMode: "multiply", pointerEvents: "none" }} />
      <Container maxWidth={false} sx={{ position: "relative", maxWidth: 1280, px: { xs: 2.5, md: 5 } }}>
        <Reveal>
          <Typography sx={{ ...mono, color: L.heat, mb: 2 }}>Built for every role</Typography>
          <Typography component="h2" sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: { xs: "2.7rem", md: "4.6rem" }, lineHeight: 0.98, letterSpacing: "-0.022em", maxWidth: 860 }}>
            One platform, <Box component="span" sx={{ fontStyle: "italic" }}>four tailored workspaces.</Box>
          </Typography>
        </Reveal>

        <Box sx={{ position: "relative", mt: { xs: 7, md: 11 } }}>
          {/* the rail the badges hang from */}
          <Box aria-hidden sx={{ display: { xs: "none", md: "block" }, position: "absolute", left: -20, right: -20, top: 0, height: 10, bgcolor: L.ink }} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: { xs: 5, md: 4 }, pt: { md: 0 } }}>
            {ROLES.map((r, i) => (
              <motion.div key={r.role} initial={{ opacity: 0, y: -60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.9, delay: i * 0.12, ease: EASE }} style={{ height: "100%" }}>
                <Box
                  component={NextLink}
                  href={`/register?role=${r.role}`}
                  sx={{
                    display: "block", height: "100%", textDecoration: "none", color: "inherit", position: "relative",
                    transformOrigin: "50% 0", "&:hover": { animation: `${swing} 1.1s ease-in-out 1` },
                    "&:hover .badge": { boxShadow: `10px 10px 0 ${r.accent}` },
                    "&:hover .go": { opacity: 1, transform: "translateX(0)" },
                    "&:focus-visible": { outline: `2px solid ${L.ink}`, outlineOffset: 6 },
                  }}
                >
                  {/* strap */}
                  <Box aria-hidden sx={{ display: { xs: "none", md: "block" }, mx: "auto", width: 16, height: 54, bgcolor: r.accent, borderLeft: `2px solid ${L.ink}`, borderRight: `2px solid ${L.ink}` }} />
                  <Box className="badge" sx={{ bgcolor: L.card, border: `2px solid ${L.ink}`, boxShadow: `7px 7px 0 ${L.ink}`, transition: "box-shadow .3s", position: "relative", mt: { xs: 0, md: -0.25 } }}>
                    <Box sx={{ bgcolor: r.accent, height: 66, position: "relative", borderBottom: `2px solid ${L.ink}` }}>
                      <Box aria-hidden sx={{ position: "absolute", left: "50%", top: 14, width: 54, height: 12, ml: "-27px", borderRadius: 99, bgcolor: L.paper, border: `2px solid ${L.ink}` }} />
                    </Box>
                    <Box sx={{ p: 2.75 }}>
                      <Box sx={{ width: 54, height: 54, mt: -7.5, mb: 2.25, bgcolor: L.paper, border: `2px solid ${L.ink}`, display: "grid", placeItems: "center", position: "relative" }}>
                        <r.icon sx={{ fontSize: 30, color: L.ink }} />
                      </Box>
                      <Typography sx={{ ...mono, fontSize: 10.5, color: "rgba(14,23,38,0.55)" }}>{r.id} · Workspace</Typography>
                      <Typography component="h3" sx={{ fontFamily: FONT.serif, fontSize: 34, lineHeight: 1, letterSpacing: "-0.01em", my: 1.25 }}>{r.title}</Typography>
                      <Typography sx={{ fontSize: 15, lineHeight: 1.65, color: "rgba(14,23,38,0.75)", minHeight: 74 }}>{r.body}</Typography>
                      <Box sx={{ mt: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Barcode seed={i + 1} />
                        <ArrowForwardRoundedIcon className="go" sx={{ opacity: 0, transform: "translateX(-10px)", transition: "all .3s", color: L.ink }} />
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </motion.div>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
