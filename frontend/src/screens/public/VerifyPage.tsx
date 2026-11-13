"use client";

import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { motion } from "framer-motion";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import GppMaybeRoundedIcon from "@mui/icons-material/GppMaybeRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import { fetchPublicVerification, publicPassportPdfUrl, verifyPassportHash } from "../../api/endpoints";
import { PageLoader } from "../../components/PageLoader";
import { Logo } from "../../components/Logo";
import { EASE, Stagger, StaggerItem } from "../../components/motion";
import { createAppTheme } from "../../theme";
import { Stamp } from "../landing/art";
import { FONT, GRAIN, L, gridBackground, mono } from "../landing/tokens";

// The public page is always paper and ink, whatever colour mode the visitor last left the app in.
const lightTheme = createAppTheme("light");

function Banner({ tone, icon: Icon, title, body }: { tone: "ok" | "warn" | "bad"; icon: typeof VerifiedRoundedIcon; title: string; body: string }) {
  const palette = {
    ok: { bg: L.teal, fg: "#fff" },
    warn: { bg: L.amber, fg: L.ink },
    bad: { bg: L.heat, fg: "#fff" },
  }[tone];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ p: 2.5, bgcolor: palette.bg, border: `2px solid ${L.ink}`, boxShadow: `6px 6px 0 ${L.ink}`, color: palette.fg }}>
        <Icon sx={{ fontSize: 30, mt: 0.25 }} />
        <Box>
          <Typography fontWeight={800}>{title}</Typography>
          <Typography sx={{ opacity: 0.9, fontSize: 14.5, mt: 0.25 }}>{body}</Typography>
        </Box>
      </Stack>
    </motion.div>
  );
}

export function VerifyPage({ token, passportHash }: { token: string; passportHash: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-verification", token],
    queryFn: () => fetchPublicVerification(token!),
    enabled: !!token,
    retry: false,
  });

  // Only present when the visitor arrived by scanning a printed passport's QR.
  const passportCheck = useQuery({
    queryKey: ["passport-check", token, passportHash],
    queryFn: () => verifyPassportHash(token!, passportHash!),
    enabled: !!token && !!passportHash,
    retry: false,
  });

  const initials = data
    ? data.full_name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <ThemeProvider theme={lightTheme}>
    <Box sx={{ minHeight: "100vh", bgcolor: L.paper, color: L.ink, position: "relative", overflow: "hidden", ...gridBackground("rgba(14,23,38,0.05)", "rgba(14,23,38,0.09)") }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.3, mixBlendMode: "multiply", pointerEvents: "none" }} />
      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1, py: { xs: 4, sm: 7 } }}>
        <Stack alignItems="center" mb={5}>
          <NextLink href="/" style={{ textDecoration: "none" }} aria-label="ThermaTrust home">
            <Logo size={34} />
          </NextLink>
          <Typography sx={{ ...mono, mt: 2, color: "rgba(14,23,38,0.6)" }}>Capability verification</Typography>
        </Stack>

        {isLoading && <PageLoader rows={3} />}

        {isError && (
          <Banner tone="bad" icon={LinkOffRoundedIcon} title="Link not valid" body="This verification link is invalid or has expired." />
        )}

        <Stack spacing={2} mb={passportHash ? 3 : 0}>
          {passportHash && passportCheck.data?.valid === true && (
            <Banner tone="ok" icon={VerifiedRoundedIcon} title="Passport matches" body="This passport matches the platform's current verified records." />
          )}
          {passportHash && passportCheck.data?.valid === false && (
            <Banner
              tone="warn"
              icon={GppMaybeRoundedIcon}
              title="Passport is outdated or altered"
              body="The verified records have changed since it was issued. Rely on the live record below, not the printed copy."
            />
          )}
        </Stack>

        {data && (
          <Stagger inView={false} gap={0.12}>
            <StaggerItem>
              <Paper sx={{ p: 3.5, mb: 3, position: "relative", overflow: "visible" }}>
                <Stack direction="row" spacing={2.5} alignItems="center">
                  <Box sx={{ width: 76, height: 76, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: L.teal, color: "#fff", border: `2px solid ${L.ink}`, boxShadow: `4px 4px 0 ${L.ink}`, fontFamily: FONT.wordmark, fontWeight: 900, fontSize: 36, letterSpacing: "0.04em" }}>
                    {initials}
                  </Box>
                  <Box minWidth={0}>
                    <Typography variant="h4" sx={{ fontSize: "2.2rem", lineHeight: 1 }}>{data.full_name}</Typography>
                    <Typography sx={{ color: "text.secondary", mt: 0.75 }}>
                      {data.contractor_name ?? "Independent technician"} &middot; {data.years_experience} yrs experience
                    </Typography>
                  </Box>
                </Stack>
                {passportCheck.data?.valid !== false && (
                  <motion.div
                    initial={{ opacity: 0, scale: 2.4, rotate: -30 }}
                    animate={{ opacity: 0.94, scale: 1, rotate: -12 }}
                    transition={{ delay: 0.9, duration: 0.32, ease: [0.5, 0, 0.9, 0.3] }}
                    style={{ position: "absolute", right: 2, top: -58, pointerEvents: "none", mixBlendMode: "multiply" }}
                  >
                    <Stamp size={104} />
                  </motion.div>
                )}
              </Paper>
            </StaggerItem>

            <StaggerItem>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography sx={{ ...mono, color: "text.secondary" }} mb={1.75}>Verified capabilities</Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {data.verified_capabilities.map((c, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.05, duration: 0.4, ease: EASE }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.6, borderRadius: "2px", bgcolor: L.teal, color: "#fff", border: `1.5px solid ${L.ink}`, fontWeight: 700, fontSize: 13.5 }}>
                        <VerifiedRoundedIcon sx={{ fontSize: 16 }} />
                        {c.label}
                      </Box>
                    </motion.div>
                  ))}
                  {data.verified_capabilities.length === 0 && (
                    <Typography variant="body2" color="text.secondary">None verified yet.</Typography>
                  )}
                </Stack>
              </Paper>
            </StaggerItem>

            <StaggerItem>
              <Paper sx={{ p: 3 }}>
                <Typography sx={{ ...mono, color: "text.secondary" }} mb={1.5}>Verified credentials</Typography>
                <Stack spacing={1.25}>
                  {data.verified_credentials.map((c, i) => (
                    <Stack key={i} direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ py: 1, borderBottom: "1px solid rgba(14,23,38,0.18)", "&:last-child": { borderBottom: 0 } }}>
                      <Box>
                        <Typography fontWeight={700} fontSize={14.5}>{c.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{c.issuer_name}</Typography>
                      </Box>
                      {c.expiry_date && (
                        <Typography variant="caption" sx={{ ...mono, fontSize: 10.5, px: 1.25, py: 0.5, borderRadius: "2px", bgcolor: L.paperDeep, border: `1.5px solid ${L.ink}`, whiteSpace: "nowrap" }}>
                          expires {c.expiry_date}
                        </Typography>
                      )}
                    </Stack>
                  ))}
                  {data.verified_credentials.length === 0 && (
                    <Typography variant="body2" color="text.secondary">None verified yet.</Typography>
                  )}
                </Stack>
              </Paper>
            </StaggerItem>

            <StaggerItem>
              <Stack alignItems="center" mt={4.5}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PictureAsPdfRoundedIcon />}
                  href={publicPassportPdfUrl(token!)}
                >
                  Download passport (PDF)
                </Button>
                <Typography sx={{ mt: 3.5, ...mono, fontSize: 10.5, textTransform: "none", letterSpacing: "0.04em", lineHeight: 1.7, color: "rgba(14,23,38,0.6)", textAlign: "center", maxWidth: 440 }}>
                  This page shows only capabilities and credentials that have been verified on the platform.
                  Pending or unverified items are never shown here.
                </Typography>
              </Stack>
            </StaggerItem>
          </Stagger>
        )}
      </Container>
    </Box>
    </ThemeProvider>
  );
}
