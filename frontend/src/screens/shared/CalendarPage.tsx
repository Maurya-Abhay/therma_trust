import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, IconButton, Paper, Stack, Typography } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import { fetchScheduledJobs } from "../../api/endpoints";
import { useAuth } from "../../auth/AuthContext";
import { EmptyState } from "../../components/EmptyState";
import { PageLoader } from "../../components/PageLoader";
import type { JobRequest } from "../../types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RISK_COLOR: Record<string, string> = {
  low: "#0D9488",
  medium: "#3E7CB1",
  high: "#E8A317",
  very_high: "#F2542D",
  critical: "#7A220C",
};

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function jobLink(job: JobRequest, role: string | undefined) {
  if (role === "technician") return `/my-jobs/${job.id}/report`;
  if (role === "facility_manager") return `/jobs/${job.id}`;
  return null;
}

export function CalendarPage() {
  const { user } = useAuth();
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // The grid starts on the Monday on or before the 1st and always shows 6 weeks.
  const gridStart = useMemo(() => {
    const start = new Date(cursor);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    return start;
  }, [cursor]);
  const days = useMemo(
    () => Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)),
    [gridStart]
  );
  const from = days[0].toISOString();
  const to = new Date(days[41].getFullYear(), days[41].getMonth(), days[41].getDate() + 1).toISOString();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["calendar", from, to],
    queryFn: () => fetchScheduledJobs(from, to),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, JobRequest[]>();
    for (const job of jobs ?? []) {
      if (!job.scheduled_for) continue;
      const key = dayKey(new Date(job.scheduled_for));
      map.set(key, [...(map.get(key) ?? []), job]);
    }
    for (const list of map.values()) list.sort((a, b) => (a.scheduled_for! < b.scheduled_for! ? -1 : 1));
    return map;
  }, [jobs]);

  const monthLabel = cursor.toLocaleString("en", { month: "long", year: "numeric" });
  const todayKey = dayKey(today);
  const inMonth = (d: Date) => d.getMonth() === cursor.getMonth();
  const monthJobs = days.filter(inMonth).flatMap((d) => byDay.get(dayKey(d)) ?? []);

  function chip(job: JobRequest) {
    const color = RISK_COLOR[job.risk_level] ?? "#0E1726";
    const time = new Date(job.scheduled_for!).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
    const body = (
      <Box
        sx={{
          px: 0.75,
          py: 0.4,
          borderRadius: 1.25,
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.25,
          color: "text.primary",
          bgcolor: `${color}22`,
          borderLeft: `3px solid ${color}`,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={`${time} · ${job.equipment_name} · ${job.facility_name}`}
      >
        {time} {job.equipment_name}
      </Box>
    );
    const link = jobLink(job, user?.role);
    return link ? (
      <Box key={job.id} component={RouterLink} to={link} sx={{ textDecoration: "none", display: "block" }}>
        {body}
      </Box>
    ) : (
      <Box key={job.id}>{body}</Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" useFlexGap spacing={1.5}>
        <Box>
          <Typography variant="h4">Calendar</Typography>
          <Typography color="text.secondary">
            {monthJobs.length === 0 ? "Nothing scheduled this month." : `${monthJobs.length} scheduled job${monthJobs.length === 1 ? "" : "s"} this month.`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="outlined" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</Button>
          <IconButton aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeftRoundedIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 800, minWidth: 150, textAlign: "center" }}>{monthLabel}</Typography>
          <IconButton aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRightRoundedIcon />
          </IconButton>
        </Stack>
      </Stack>

      {isLoading && <PageLoader rows={2} />}

      {/* Month grid (tablet and up) */}
      <Paper sx={{ display: { xs: "none", md: "block" }, overflow: "hidden" }}>
        <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "action.hover" }}>
          {WEEKDAYS.map((d) => (
            <Typography key={d} sx={{ p: 1.25, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "text.secondary", textTransform: "uppercase" }}>
              {d}
            </Typography>
          ))}
        </Box>
        <Box display="grid" gridTemplateColumns="repeat(7, 1fr)">
          {days.map((day, index) => {
            const key = dayKey(day);
            const list = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <Box
                key={key}
                sx={{
                  minHeight: 118,
                  p: 1,
                  borderRight: (index + 1) % 7 === 0 ? 0 : 1,
                  borderBottom: index >= 35 ? 0 : 1,
                  borderColor: "divider",
                  opacity: inMonth(day) ? 1 : 0.45,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                }}
              >
                <Box
                  sx={{
                    alignSelf: "flex-start",
                    minWidth: 26,
                    height: 26,
                    px: 0.75,
                    borderRadius: 99,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 800,
                    color: isToday ? "#fff" : "text.primary",
                    bgcolor: isToday ? "primary.dark" : "transparent",
                  }}
                >
                  {day.getDate()}
                </Box>
                {list.slice(0, 3).map(chip)}
                {list.length > 3 && (
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>+{list.length - 3} more</Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Agenda (phones) */}
      <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
        {monthJobs.length === 0 && !isLoading && (
          <Paper>
            <EmptyState
              icon={EventBusyRoundedIcon}
              title="No scheduled jobs this month"
              body="Jobs appear here once a date and time are set on them."
            />
          </Paper>
        )}
        {days
          .filter((d) => inMonth(d) && (byDay.get(dayKey(d))?.length ?? 0) > 0)
          .map((day) => (
            <Paper key={dayKey(day)} sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>
                {day.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "short" })}
                {dayKey(day) === todayKey ? " · Today" : ""}
              </Typography>
              <Stack spacing={0.75}>{(byDay.get(dayKey(day)) ?? []).map(chip)}</Stack>
            </Paper>
          ))}
      </Stack>

      <Stack direction="row" spacing={2.5} mt={2.5} flexWrap="wrap" useFlexGap>
        {Object.entries({ low: "Low", medium: "Medium", high: "High", very_high: "Very high", critical: "Critical" }).map(([k, label]) => (
          <Stack key={k} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: RISK_COLOR[k] }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>{label} risk</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
