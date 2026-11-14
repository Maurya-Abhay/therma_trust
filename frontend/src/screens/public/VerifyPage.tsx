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
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { fetchPublicVerification, publicPassportPdfUrl, publicQrImageUrl, publicVerifyUrl, verifyPassportHash } from "../../api/endpoints";
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
        <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, py: { xs: 3, sm: 5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" gap={2} mb={{ xs: 3, sm: 5 }}>
            <NextLink href="/" style={{ textDecoration: "none" }} aria-label="ThermaTrust home">
              <Logo size={36} />
            </NextLink>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ ...mono, color: "rgba(14,23,38,0.6)", fontSize: 11 }}>
              <VerifiedRoundedIcon sx={{ color: L.teal, fontSize: 18 }} />
              LIVE PROFESSIONAL VERIFICATION
            </Stack>
          </Stack>

          {isLoading && <PageLoader rows={3} />}

          {isError && (
            <Banner tone="bad" icon={LinkOffRoundedIcon} title="Link not valid" body="This verification link is invalid or has expired." />
          )}

          <Stack spacing={2} mb={passportHash ? 3 : 0}>
            {passportHash && passportCheck.data?.valid === true && (
              <Banner tone="ok" icon={VerifiedRoundedIcon} title="Passport matches live records" body="This passport matches the platform's current verified records." />
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
                <Paper sx={{ p: { xs: 2.5, sm: 4 }, mb: 3, position: "relative", overflow: "visible", borderTop: `8px solid ${L.teal}` }}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 250px" }, gap: { xs: 3, md: 5 }, alignItems: "center" }}>
                    <Stack direction="row" spacing={2.5} alignItems="center">
                      <Box sx={{ width: { xs: 68, sm: 88 }, height: { xs: 68, sm: 88 }, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: L.teal, color: "#fff", border: `2px solid ${L.ink}`, boxShadow: `5px 5px 0 ${L.ink}`, fontFamily: FONT.wordmark, fontWeight: 900, fontSize: { xs: 30, sm: 40 }, letterSpacing: "0.04em" }}>
                        {initials}
                      </Box>
                      <Box minWidth={0}>
                        <Typography sx={{ ...mono, color: L.teal, fontSize: 11, mb: 1 }}>VERIFIED TECHNICIAN</Typography>
                        <Typography variant="h3" sx={{ fontSize: { xs: "2rem", sm: "3rem" }, lineHeight: 0.98 }}>{data.full_name}</Typography>
                        <Typography sx={{ color: "text.secondary", mt: 1 }}>
                          {data.contractor_name ?? "Independent technician"} &middot; {data.years_experience} years experience
                        </Typography>
                      </Box>
                    </Stack>
                    <Box sx={{ p: 2, bgcolor: L.paperDeep, border: `2px solid ${L.ink}`, textAlign: "center" }}>
                      <Box component="img" src={publicQrImageUrl(token)} alt="QR code for this technician verification page" sx={{ display: "block", width: 150, height: 150, mx: "auto", bgcolor: "#fff", p: 1 }} />
                      <Typography sx={{ ...mono, mt: 1.25, fontSize: 10, color: "text.secondary" }}>SCAN TO VERIFY LIVE STATUS</Typography>
                    </Box>
                  </Box>
                  {passportCheck.data?.valid !== false && (
                    <motion.div
                      initial={{ opacity: 0, scale: 2.4, rotate: -30 }}
                      animate={{ opacity: 0.94, scale: 1, rotate: -12 }}
                      transition={{ delay: 0.9, duration: 0.32, ease: [0.5, 0, 0.9, 0.3] }}
                      style={{ position: "absolute", right: 18, top: -30, pointerEvents: "none", mixBlendMode: "multiply" }}
                    >
                      <Stamp size={92} />
                    </motion.div>
                  )}
                </Paper>
              </StaggerItem>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                <StaggerItem>
                  <Paper sx={{ p: { xs: 2.5, sm: 3 }, height: "100%" }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                      <Typography sx={{ ...mono, color: "text.secondary" }}>Verified capabilities</Typography>
                      <Typography sx={{ ...mono, color: L.teal, fontSize: 11 }}>{data.verified_capabilities.length} VERIFIED</Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {data.verified_capabilities.map((c, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05, duration: 0.35, ease: EASE }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.1, bgcolor: "#EAF5F3", borderLeft: `4px solid ${L.teal}` }}>
                            <VerifiedRoundedIcon sx={{ fontSize: 18, color: L.teal }} />
                            <Box>
                              <Typography fontWeight={700} fontSize={14}>{c.label}</Typography>
                              <Typography sx={{ ...mono, fontSize: 10, color: "text.secondary", mt: 0.25 }}>{c.capability_type}</Typography>
                            </Box>
                          </Box>
                        </motion.div>
                      ))}
                      {data.verified_capabilities.length === 0 && <Typography variant="body2" color="text.secondary">None verified yet.</Typography>}
                    </Stack>
                  </Paper>
                </StaggerItem>

                <StaggerItem>
                  <Paper sx={{ p: { xs: 2.5, sm: 3 }, height: "100%" }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                      <Typography sx={{ ...mono, color: "text.secondary" }}>Verified credentials</Typography>
                      <Typography sx={{ ...mono, color: L.teal, fontSize: 11 }}>{data.verified_credentials.length} VERIFIED</Typography>
                    </Stack>
                    <Stack spacing={1.25}>
                      {data.verified_credentials.map((c, i) => (
                        <Stack key={i} direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.25, bgcolor: i % 2 ? "#fff" : L.paperDeep, border: "1px solid rgba(14,23,38,0.14)" }}>
                          <VerifiedRoundedIcon sx={{ color: L.teal, fontSize: 20 }} />
                          <Box minWidth={0} flex={1}>
                            <Typography fontWeight={700} fontSize={14}>{c.name}</Typography>
                            <Typography variant="body2" color="text.secondary">{c.issuer_name}</Typography>
                          </Box>
                          <Typography sx={{ ...mono, fontSize: 9.5, color: L.teal, textAlign: "right", whiteSpace: "nowrap" }}>
                            {c.expiry_date ? `EXPIRES ${c.expiry_date}` : "NO EXPIRY"}
                          </Typography>
                        </Stack>
                      ))}
                      {data.verified_credentials.length === 0 && <Typography variant="body2" color="text.secondary">None verified yet.</Typography>}
                    </Stack>
                  </Paper>
                </StaggerItem>
              </Box>

              <StaggerItem>
                <Paper sx={{ mt: 3, p: { xs: 2.5, sm: 3 }, bgcolor: L.ink, color: "#fff", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <QrCode2RoundedIcon sx={{ color: "#5EEAD4" }} />
                      <Typography fontWeight={800}>Trust this live record</Typography>
                    </Stack>
                    <Typography sx={{ color: "rgba(255,255,255,0.7)", mt: 0.75, fontSize: 13 }}>
                      Only platform-verified capabilities and credentials are shown.
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} width={{ xs: "100%", sm: "auto" }}>
                    <Button variant="contained" size="large" startIcon={<PictureAsPdfRoundedIcon />} href={publicPassportPdfUrl(token!)} sx={{ whiteSpace: "nowrap" }}>
                      Download PDF
                    </Button>
                    <Button component={NextLink} href={publicVerifyUrl(token!)} target="_blank" rel="noreferrer" variant="outlined" size="large" endIcon={<OpenInNewRoundedIcon />} sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>
                      Open link
                    </Button>
                  </Stack>
                </Paper>
                <Typography sx={{ mt: 2.5, ...mono, fontSize: 10.5, textTransform: "none", letterSpacing: "0.04em", lineHeight: 1.7, color: "rgba(14,23,38,0.6)", textAlign: "center" }}>
                  This page is generated from live ThermaTrust verification records. Pending or unverified items are never shown.
                </Typography>
              </StaggerItem>
            </Stagger>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
}
