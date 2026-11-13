import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { ROLE_ACCENTS } from "../theme";
import { L } from "../screens/landing/tokens";

/** Consistent title block for inner pages: a block of the role's colour, a serif title, optional subtitle and actions. */
export function PageHeader({
  title,
  subtitle,
  action,
  mb = 3,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  mb?: number;
}) {
  const { user } = useAuth();
  const accent = user ? ROLE_ACCENTS[user.role].main : L.teal;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={2} sx={{ mb }}>
      <Stack direction="row" spacing={2} alignItems="stretch" minWidth={0}>
        <Box aria-hidden sx={{ width: 8, flexShrink: 0, bgcolor: accent, border: 2, borderColor: (th) => (th.palette.mode === "dark" ? "rgba(239,233,220,0.5)" : L.ink) }} />
        <Box minWidth={0}>
          <Typography variant="h4" sx={{ lineHeight: 1.05 }}>{title}</Typography>
          {subtitle && <Typography sx={{ color: "text.secondary", mt: 0.75 }}>{subtitle}</Typography>}
        </Box>
      </Stack>
      {action}
    </Stack>
  );
}
