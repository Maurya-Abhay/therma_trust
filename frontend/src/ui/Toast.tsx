"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Alert, Snackbar } from "@mui/material";
import { subscribeToasts, type ToastMessage } from "./toastBus";

/** Shows one toast at a time; a new one replaces the current one. */
export function ToastHost({ children }: { children?: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => subscribeToasts(setToast), []);

  return (
    <>
      {children}
      <Snackbar
        key={toast?.id}
        open={!!toast}
        autoHideDuration={4500}
        onClose={(_event, reason) => {
          if (reason !== "clickaway") setToast(null);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ width: "100%", boxShadow: "0 18px 40px -16px rgba(0,0,0,0.5)", border: 0 }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
