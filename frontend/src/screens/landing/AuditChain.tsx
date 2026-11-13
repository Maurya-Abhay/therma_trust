"use client";

import { useState } from "react";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, Reveal } from "../../components/motion";
import { FONT, GRAIN, L, gridBackground, mono } from "./tokens";

const BLOCKS = [
  { n: 1041, event: "Credential verified", hash: "a91f03c7", prev: "00000000" },
  { n: 1042, event: "Job assigned", hash: "5be2d718", prev: "a91f03c7" },
  { n: 1043, event: "Report submitted", hash: "c04a9e52", prev: "5be2d718" },
  { n: 1044, event: "Cylinder recovered", hash: "7d38b6f1", prev: "c04a9e52" },
];
const FORGED = "e1c0ffee";

/** Interactive demo: edit one record and watch every later link break. */
function Chain() {
  const [tampered, setTampered] = useState<number | null>(null);

  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: { xs: 4, md: 5 }, position: "relative" }}>
        {BLOCKS.map((b, i) => {
          const isTampered = tampered === i;
          const broken = tampered !== null && i >= tampered;
          const accent = broken ? L.heat : L.teal;
          return (
            <Box key={b.n} sx={{ position: "relative" }}>
              <motion.div
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: EASE }}
                animate={isTampered ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
              >
                <Box
                  component="button"
                  onClick={() => setTampered(isTampered ? null : i)}
                  aria-label={`${isTampered ? "Restore" : "Tamper with"} record ${b.n}`}
                  sx={{
                    all: "unset", boxSizing: "border-box", display: "block", width: "100%", cursor: "pointer", p: 2.25,
                    bgcolor: broken ? "#2A1713" : L.inkSoft,
                    border: `2px solid ${broken ? L.heat : "rgba(239,233,220,0.5)"}`,
                    boxShadow: `6px 6px 0 ${broken ? L.heat : L.teal}`,
                    transition: "background-color .35s, border-color .35s, box-shadow .35s, transform .2s",
                    "&:hover": { transform: "translate(-2px, -2px)" },
                    "&:focus-visible": { outline: `2px solid ${L.paper}`, outlineOffset: 4 },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.75}>
                    <Typography sx={{ ...mono, fontSize: 11, color: "rgba(239,233,220,0.55)" }}>Record #{b.n}</Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ ...mono, fontSize: 10, color: accent, fontWeight: 700 }}>
                      <Box sx={{ width: 8, height: 8, bgcolor: accent }} />
                      <span>{broken ? "Broken" : "Sealed"}</span>
                    </Stack>
                  </Stack>
                  <Typography sx={{ fontFamily: FONT.serif, fontSize: 26, lineHeight: 1.02, color: L.paper, mb: 2, minHeight: 54 }}>
                    {isTampered ? "Record edited" : b.event}
                  </Typography>
                  <Box sx={{ fontFamily: FONT.mono, fontSize: 12, lineHeight: 1.8 }}>
                    <Box sx={{ color: "rgba(239,233,220,0.45)" }}>
                      prev <Box component="span" sx={{ color: tampered !== null && i === tampered + 1 ? L.heat : "#9CC8E8" }}>{b.prev}</Box>
                    </Box>
                    <Box sx={{ color: "rgba(239,233,220,0.45)" }}>
                      hash{" "}
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span key={isTampered ? "forged" : b.hash} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }} style={{ color: broken ? "#FF8F73" : "#5EEAD4", display: "inline-block" }}>
                          {isTampered ? FORGED : b.hash}
                        </motion.span>
                      </AnimatePresence>
                    </Box>
                  </Box>
                </Box>
              </motion.div>
              {i < BLOCKS.length - 1 && (
                <Box aria-hidden sx={{ position: "absolute", display: { xs: "none", md: "block" }, top: "50%", right: -40, width: 40, height: 3, transform: "translateY(-50%)", bgcolor: tampered !== null && i >= tampered ? L.heat : L.teal, transition: "background-color .35s", zIndex: 2 }}>
                  <Box sx={{ position: "absolute", right: -2, top: -4, width: 11, height: 11, bgcolor: "inherit", transform: "rotate(45deg)" }} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="center" spacing={3} mt={7}>
        <Button
          onClick={() => setTampered(tampered === null ? 1 : null)}
          sx={{ px: 3.25, py: 1.4, borderRadius: "3px", bgcolor: tampered === null ? L.paper : "transparent", color: tampered === null ? L.ink : L.paper, border: `2px solid ${L.paper}`, boxShadow: tampered === null ? `5px 5px 0 ${L.heat}` : "none", "&:hover": { bgcolor: tampered === null ? L.paper : "rgba(239,233,220,0.1)" } }}
        >
          {tampered === null ? "Try to tamper with record #1042" : "Restore the chain"}
        </Button>
        <Typography sx={{ color: tampered === null ? "rgba(239,233,220,0.65)" : "#FFB09E", fontSize: 15, fontWeight: 500, textAlign: { xs: "center", sm: "left" }, maxWidth: 420 }}>
          {tampered === null ? "Every entry is sealed with the hash of the one before it." : "Chain broken: one edit invalidates every record after it, so tampering is always detectable."}
        </Typography>
      </Stack>
    </Box>
  );
}

export function AuditSection() {
  return (
    <Box id="audit" sx={{ position: "relative", bgcolor: L.ink, color: L.paper, py: { xs: 9, md: 14 }, overflow: "hidden", scrollMarginTop: 70, ...gridBackground("rgba(239,233,220,0.04)", "rgba(239,233,220,0.07)") }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.18, mixBlendMode: "screen", pointerEvents: "none" }} />
      <Container maxWidth={false} sx={{ position: "relative", maxWidth: 1280, px: { xs: 2.5, md: 5 } }}>
        <Reveal>
          <Box sx={{ mb: { xs: 6, md: 9 } }}>
            <Typography sx={{ ...mono, color: L.heat, mb: 2 }}>Audit trail</Typography>
            <Typography component="h2" sx={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: { xs: "2.7rem", md: "4.6rem" }, lineHeight: 0.98, letterSpacing: "-0.022em", maxWidth: 820 }}>
              History nobody can <Box component="span" sx={{ fontStyle: "italic", color: "#F6B8A6" }}>quietly rewrite.</Box>
            </Typography>
            <Typography sx={{ mt: 2.5, color: "rgba(239,233,220,0.7)", fontSize: 17.5, lineHeight: 1.65, maxWidth: 560 }}>
              Click any record below and edit it. Watch what happens to everything after it.
            </Typography>
          </Box>
        </Reveal>
        <Chain />
      </Container>
    </Box>
  );
}
