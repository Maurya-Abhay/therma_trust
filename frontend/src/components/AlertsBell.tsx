import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Box, Button, Divider, IconButton, Popover, Stack, Typography } from "@mui/material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { fetchAlerts, fetchNotifications, markNotificationsRead } from "../api/endpoints";
import type { AppNotification, ComplianceAlert } from "../types";
import { PushToggle } from "./PushToggle";

const SEVERITY_ICON = {
  critical: <ErrorRoundedIcon color="error" fontSize="small" />,
  warning: <WarningAmberRoundedIcon color="warning" fontSize="small" />,
  info: <InfoOutlinedIcon color="info" fontSize="small" />,
} as const;

function timeAgo(iso: string) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** Bell for two kinds of messages: things that happened (notifications) and things that need attention (alerts). */
export function AlertsBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  // Alerts are computed live on the server, so refresh periodically rather
  // than on every render; a stale minute is fine for compliance reminders.
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // The service worker skips the OS notification when the app is in view and
  // asks us to refresh instead, so the bell updates the moment something arrives.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "notifications-changed") {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [queryClient]);

  const markRead = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = notifications?.unread_count ?? 0;
  const actionable = alerts.filter((a) => a.severity !== "info").length;
  const hasCritical = alerts.some((a) => a.severity === "critical");
  const total = actionable + unread;
  const items = notifications?.results ?? [];

  function openAlert(alert: ComplianceAlert) {
    setAnchor(null);
    navigate(alert.link);
  }

  function openNotification(item: AppNotification) {
    setAnchor(null);
    if (!item.read) markRead.mutate({ ids: [item.id] });
    if (item.link) navigate(item.link);
  }

  return (
    <>
      <IconButton color="inherit" aria-label="Notifications and alerts" onClick={(e) => setAnchor(e.currentTarget)}>
        <Badge badgeContent={total} color={hasCritical ? "error" : "warning"} max={9}>
          <NotificationsRoundedIcon sx={unread > 0 ? { animation: "tt-ring 2.4s ease-in-out 1s 2", transformOrigin: "50% 0" } : undefined} />
        </Badge>
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ width: 400, maxWidth: "92vw", maxHeight: 520, overflowY: "auto" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.25 }}>
            <Typography variant="subtitle1">Notifications</Typography>
            {unread > 0 && (
              <Button size="small" onClick={() => markRead.mutate({ all: true })} disabled={markRead.isPending}>
                Mark all read
              </Button>
            )}
          </Stack>
          <Divider />
          <PushToggle />
          {items.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              Nothing new. Job assignments, reviews and ratings will show up here.
            </Typography>
          )}
          {items.map((item) => (
            <Stack
              key={item.id}
              direction="row"
              spacing={1.5}
              onClick={() => openNotification(item)}
              sx={{
                px: 2,
                py: 1.5,
                cursor: "pointer",
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: item.read ? "transparent" : "action.hover",
                "&:hover": { bgcolor: "action.selected" },
              }}
            >
              <Box
                sx={{ mt: 0.9, width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: item.read ? "transparent" : "primary.main" }}
              />
              <Box flexGrow={1} minWidth={0}>
                <Typography variant="body2" fontWeight={item.read ? 500 : 700}>{item.title}</Typography>
                {item.body && <Typography variant="caption" color="text.secondary" display="block">{item.body}</Typography>}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{timeAgo(item.created_at)}</Typography>
            </Stack>
          ))}

          <Typography variant="subtitle1" sx={{ px: 2, pt: 2, pb: 1 }}>Compliance alerts</Typography>
          <Divider />
          {alerts.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              You're all caught up. Nothing needs attention.
            </Typography>
          )}
          {alerts.map((alert) => (
            <Stack
              key={alert.id}
              direction="row"
              spacing={1.5}
              onClick={() => openAlert(alert)}
              sx={{ px: 2, py: 1.5, cursor: "pointer", borderBottom: 1, borderColor: "divider", "&:hover": { bgcolor: "action.hover" } }}
            >
              <Box sx={{ pt: 0.25 }}>{SEVERITY_ICON[alert.severity]}</Box>
              <Box>
                <Typography variant="body2" fontWeight={600}>{alert.title}</Typography>
                <Typography variant="caption" color="text.secondary">{alert.detail}</Typography>
              </Box>
            </Stack>
          ))}
        </Box>
      </Popover>
    </>
  );
}
