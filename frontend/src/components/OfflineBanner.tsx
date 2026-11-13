import { Alert, Box, Button, Snackbar, Stack } from "@mui/material";
import { useOffline } from "../offline/OfflineContext";

export function OfflineBanner() {
  const { online, syncing, pending, notice, clearNotice, syncNow, discard } = useOffline();
  const waiting = pending.filter((item) => !item.error);
  const rejected = pending.filter((item) => item.error);

  return (
    <>
      {(!online || pending.length > 0) && (
        <Stack spacing={0.5} sx={{ position: "sticky", top: 0, zIndex: 10 }}>
          {!online && (
            <Alert severity="warning" variant="filled" sx={{ borderRadius: 0 }}>
              You're offline. You can keep working - reports are saved on this device and sent automatically when you're back online.
            </Alert>
          )}
          {waiting.length > 0 && (
            <Alert
              severity="info"
              sx={{ borderRadius: 0 }}
              action={
                <Button color="inherit" size="small" disabled={!online || syncing} onClick={() => void syncNow()}>
                  {syncing ? "Sending…" : "Send now"}
                </Button>
              }
            >
              {waiting.length} report{waiting.length === 1 ? "" : "s"} waiting to send: {waiting.map((item) => item.label).join(", ")}
            </Alert>
          )}
          {rejected.map((item) => (
            <Alert
              key={item.id}
              severity="error"
              sx={{ borderRadius: 0 }}
              action={
                <Box>
                  <Button color="inherit" size="small" disabled={!online || syncing} onClick={() => void syncNow(true)}>
                    Retry
                  </Button>
                  <Button color="inherit" size="small" onClick={() => void discard(item.id!)}>
                    Discard
                  </Button>
                </Box>
              }
            >
              {item.label} couldn't be sent: {item.error}
            </Alert>
          ))}
        </Stack>
      )}
      <Snackbar open={!!notice} autoHideDuration={6000} onClose={clearNotice} message={notice} />
    </>
  );
}
