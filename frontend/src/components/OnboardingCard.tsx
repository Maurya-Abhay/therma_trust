import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, IconButton, LinearProgress, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { motion } from "framer-motion";
import { fetchOnboarding } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { EASE } from "./motion";
import { FONT, L, lineColor } from "../screens/landing/tokens";

/** A short get-started checklist. Hides itself when finished or dismissed. */
export function OnboardingCard() {
  const { user } = useAuth();
  const key = user ? `tt-onboarding-dismissed-${user.id}` : "";
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!key) return;
    try {
      setDismissed(window.localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);

  // Always re-check when the card appears or the tab regains focus: finishing a task on another
  // page should show as ticked the moment you come back, not 30 seconds later.
  const { data } = useQuery({
    queryKey: ["onboarding"],
    queryFn: fetchOnboarding,
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  if (!data || data.total === 0 || data.completed >= data.total || dismissed) return null;

  const percent = Math.round((data.completed / data.total) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      <Paper sx={{ mb: 3, p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "3px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              bgcolor: L.teal,
              border: 2,
              borderColor: lineColor,
            }}
          >
            <RocketLaunchRoundedIcon fontSize="small" />
          </Box>
          <Box flexGrow={1}>
            <Typography sx={{ fontFamily: FONT.serif, fontSize: 28, lineHeight: 1.05 }}>Get started</Typography>
            <Typography variant="body2" color="text.secondary">
              {data.completed} of {data.total} done. Tap a task to go straight to it.
            </Typography>
          </Box>
          <Tooltip title="Hide this checklist" arrow>
            <IconButton
              aria-label="Hide checklist"
              size="small"
              onClick={() => {
                setDismissed(true);
                try {
                  window.localStorage.setItem(key, "1");
                } catch {
                  // not persisted; hidden for this visit
                }
              }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <LinearProgress variant="determinate" value={percent} sx={{ mb: 2, "& .MuiLinearProgress-bar": { bgcolor: L.teal } }} />
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={1}>
          {data.steps.map((step) => (
            <Stack
              key={step.id}
              component={RouterLink}
              to={step.link}
              direction="row"
              spacing={1.25}
              alignItems="center"
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: "3px",
                textDecoration: "none",
                cursor: "pointer",
                border: 2,
                borderColor: step.done ? "transparent" : "divider",
                color: step.done ? "text.secondary" : "text.primary",
                transition: "background-color .15s, border-color .15s, transform .15s",
                "&:hover": { bgcolor: "action.hover", borderColor: lineColor, transform: "translateX(2px)" },
                "&:hover .go": { opacity: 1, transform: "translateX(0)" },
                "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
              }}
              aria-label={step.done ? `${step.title} (done). Open` : `${step.title}. Go to it`}
            >
              {/* Keyed on `done` so the tick pops in the moment a step completes. */}
              <motion.span
                key={step.done ? "done" : "todo"}
                initial={step.done ? { scale: 0.3, rotate: -40 } : false}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 18 }}
                style={{ display: "inline-flex" }}
              >
                {step.done ? (
                  <CheckCircleRoundedIcon sx={{ color: "success.main" }} fontSize="small" />
                ) : (
                  <RadioButtonUncheckedRoundedIcon sx={{ color: "text.disabled" }} fontSize="small" />
                )}
              </motion.span>
              <Typography
                sx={{ fontWeight: 600, fontSize: 14.5, flexGrow: 1, textDecoration: step.done ? "line-through" : "none" }}
              >
                {step.title}
              </Typography>
              {!step.done && (
                <ArrowForwardRoundedIcon
                  className="go"
                  fontSize="small"
                  sx={{ color: "primary.main", opacity: 0.55, transform: "translateX(-4px)", transition: "all .15s" }}
                />
              )}
            </Stack>
          ))}
        </Box>
      </Paper>
    </motion.div>
  );
}
