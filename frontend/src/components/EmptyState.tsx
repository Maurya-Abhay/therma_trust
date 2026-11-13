import type { ElementType, ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import { FONT, L, lineColor } from "../screens/landing/tokens";

export function EmptyState({ title, body, icon: Icon = InboxRoundedIcon, action }: { title: string; body?: string; icon?: ElementType; action?: ReactNode }) {
  return (
    <Box sx={{ textAlign: "center", py: 7, px: 2 }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          mx: "auto",
          mb: 2.5,
          borderRadius: "3px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.primary",
          bgcolor: (th) => (th.palette.mode === "dark" ? "rgba(239,233,220,0.08)" : L.paperDeep),
          border: 2,
          borderColor: lineColor,
          boxShadow: (th) => `4px 4px 0 ${th.palette.mode === "dark" ? "rgba(239,233,220,0.2)" : L.ink}`,
        }}
      >
        <Icon />
      </Box>
      <Typography sx={{ fontFamily: FONT.serif, fontSize: 28, lineHeight: 1.1 }}>{title}</Typography>
      {body && <Typography sx={{ color: "text.secondary", mt: 0.75, fontSize: 14.5, maxWidth: 420, mx: "auto" }}>{body}</Typography>}
      {action && <Box mt={2.5}>{action}</Box>}
    </Box>
  );
}
