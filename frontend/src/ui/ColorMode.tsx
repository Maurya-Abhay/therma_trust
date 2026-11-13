"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppTheme, type ColorMode } from "../theme";

const STORAGE_KEY = "tt-color-mode";

interface ColorModeValue {
  mode: ColorMode;
  toggle: () => void;
}

const ColorModeContext = createContext<ColorModeValue>({ mode: "light", toggle: () => {} });

export function ColorModeProvider({ children }: { children: ReactNode }) {
  // Always start light so the server-rendered HTML and the first client render
  // agree; a saved choice is applied right after mount.
  const [mode, setMode] = useState<ColorMode>("light");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light") setMode(saved);
    } catch {
      // storage unavailable: stay on the default
    }
  }, []);

  const toggle = useCallback(() => {
    setMode((current) => {
      const next: ColorMode = current === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // not persisted; still applies for this visit
      }
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  return useContext(ColorModeContext);
}
