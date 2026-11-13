"use client";

import dynamic from "next/dynamic";
import { Box, CircularProgress } from "@mui/material";

// The signed-in app is a browser-only React Router app (it reads the URL and
// local storage), so it is loaded client-side only, as its own chunk. Visitors
// to the public pages never download it.
const SpaRoot = dynamic(() => import("./SpaRoot"), {
  ssr: false,
  loading: () => (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <CircularProgress />
    </Box>
  ),
});

export function SpaLoader() {
  return <SpaRoot />;
}
