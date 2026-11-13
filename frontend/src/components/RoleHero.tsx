import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { motion } from "framer-motion";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import EngineeringRoundedIcon from "@mui/icons-material/EngineeringRounded";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import { ROLE_ACCENTS } from "../theme";
import { AnimatedNumber, EASE } from "./motion";
import { Contours } from "../screens/landing/art";
import { FONT, L, gridBackground, mono } from "../screens/landing/tokens";
import type { Role } from "../types";

const ROLE_ICONS: Record<Role, typeof ApartmentRoundedIcon> = {
  facility_manager: ApartmentRoundedIcon,
  technician: EngineeringRoundedIcon,
  contractor_manager: BusinessCenterRoundedIcon,
  admin: AdminPanelSettingsRoundedIcon,
};

export function RoleHero({
  role,
  title,
  subtitle,
  stats,
  action,
}: {
  role: Role;
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string | number }[];
  action?: ReactNode;
}) {
  const accent = ROLE_ACCENTS[role];
  const Icon = ROLE_ICONS[role];

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          p: { xs: 2.75, sm: 4 },
          mb: 3.5,
          color: L.paper,
          bgcolor: L.ink,
          border: `2px solid ${L.ink}`,
          boxShadow: (th) => `8px 8px 0 ${th.palette.mode === "dark" ? "rgba(239,233,220,0.2)" : accent.main}`,
          ...gridBackground("rgba(239,233,220,0.04)", "rgba(239,233,220,0.08)"),
        }}
      >
        <Box aria-hidden sx={{ position: "absolute", width: 520, height: 520, right: -170, top: -170, pointerEvents: "none" }}>
          <Contours count={9} seed={accent.main.length} hot={3} ink={L.paper} hotColor={accent.main} inkOpacity={0.09} />
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2.5}
          sx={{ position: "relative" }}
        >
          <Stack direction="row" spacing={2.5} alignItems="center">
            <Box
              sx={{
                width: 58,
                height: 58,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: accent.main,
                color: accent.text,
                border: `2px solid ${L.paper}`,
                boxShadow: `4px 4px 0 rgba(239,233,220,0.85)`,
                flexShrink: 0,
              }}
            >
              <Icon />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontSize: { xs: 32, sm: 44 }, lineHeight: 1 }}>{title}</Typography>
              {subtitle && <Typography sx={{ color: "rgba(239,233,220,0.75)", mt: 1, fontSize: 15 }}>{subtitle}</Typography>}
            </Box>
          </Stack>
          {action && (
            <Box
              sx={{
                "& .MuiButton-contained": {
                  background: L.paper,
                  color: L.ink,
                  borderColor: L.paper,
                  boxShadow: `4px 4px 0 ${accent.main}`,
                  "&:hover": { background: L.paper, transform: "translate(2px, 2px)", boxShadow: `2px 2px 0 ${accent.main}` },
                },
                "& .MuiButton-outlined": { color: L.paper, borderColor: "rgba(239,233,220,0.7)", "&:hover": { borderColor: L.paper, bgcolor: "rgba(239,233,220,0.1)" } },
              }}
            >
              {action}
            </Box>
          )}
        </Stack>

        {stats && stats.length > 0 && (
          <Stack direction="row" spacing={2} mt={3.5} flexWrap="wrap" useFlexGap sx={{ position: "relative" }}>
            {stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.08, duration: 0.5, ease: EASE }}>
                <Box sx={{ border: "2px solid rgba(239,233,220,0.55)", bgcolor: "rgba(239,233,220,0.05)", px: 2.25, py: 1.25, minWidth: 132 }}>
                  <Typography sx={{ fontFamily: FONT.serif, fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                    {typeof s.value === "number" ? <AnimatedNumber value={s.value} /> : s.value}
                  </Typography>
                  <Typography sx={{ ...mono, fontSize: 10, color: "rgba(239,233,220,0.7)", mt: 0.25 }}>{s.label}</Typography>
                </Box>
              </motion.div>
            ))}
          </Stack>
        )}
      </Box>
    </motion.div>
  );
}
