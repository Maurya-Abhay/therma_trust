import { useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";

/**
 * Leaves the client-side app for a page that Next.js renders (landing, login, ...).
 * A full navigation is deliberate: those pages live outside this router.
 */
export function HardRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  );
}
