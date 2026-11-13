import { useCallback, useEffect, useState } from "react";
import { Box, Button, Stack, Switch, Typography } from "@mui/material";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import { fetchPushKey, sendTestPush } from "../api/endpoints";
import { currentSubscription, disablePush, enablePush, needsHomeScreenInstall, pushSupported } from "../lib/push";
import { emitToast } from "../ui/toastBus";

type State = "checking" | "hidden" | "off" | "on" | "blocked";

/** Opt-in for browser alerts on this device. Hidden entirely where push can't work. */
export function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!pushSupported()) return setState("hidden");
    try {
      const key = await fetchPushKey();
      if (!key.enabled) return setState("hidden");
      if (Notification.permission === "denied") return setState("blocked");
      setState((await currentSubscription()) ? "on" : "off");
    } catch {
      // Offline or the server is asleep: don't show a control that can't work right now.
      setState("hidden");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function turnOn() {
    setBusy(true);
    try {
      const result = await enablePush();
      if (result === "enabled") {
        setState("on");
        emitToast("success", "Alerts are on for this device");
        await sendTestPush().catch(() => {});
      } else if (result === "denied") {
        setState(Notification.permission === "denied" ? "blocked" : "off");
        emitToast("warning", "Notifications weren't allowed, so alerts stay off");
      } else {
        setState("hidden");
      }
    } catch {
      emitToast("error", "Couldn't turn on alerts. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      setState("off");
      emitToast("info", "Alerts are off for this device");
    } catch {
      emitToast("error", "Couldn't turn off alerts. Try again when you're online.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking" || state === "hidden") return null;

  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "action.hover" }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <NotificationsActiveRoundedIcon color={state === "on" ? "primary" : "disabled"} fontSize="small" />
        <Box flexGrow={1} minWidth={0}>
          <Typography variant="body2" fontWeight={700}>Alerts on this device</Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {state === "on" && "You'll get new jobs and report decisions even when the app is closed."}
            {state === "off" && (needsHomeScreenInstall()
              ? "On iPhone, add ThermaTrust to your Home Screen first, then turn this on."
              : "Get new jobs and report decisions even when the app is closed.")}
            {state === "blocked" && "Blocked in your browser settings. Allow notifications for this site to turn it on."}
          </Typography>
        </Box>
        {state === "on" && (
          <Switch checked onChange={turnOff} disabled={busy} inputProps={{ "aria-label": "Turn off alerts on this device" }} />
        )}
        {state === "off" && (
          <Button size="small" variant="contained" onClick={turnOn} disabled={busy}>
            Turn on
          </Button>
        )}
      </Stack>
    </Box>
  );
}
