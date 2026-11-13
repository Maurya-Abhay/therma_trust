import { useState } from "react";
import { Box, IconButton, InputAdornment, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { checkPassword } from "../lib/password";

const LEVEL_COLOR = ["inherit", "error", "warning", "success", "success"] as const;

interface PasswordFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Words the password must not contain: email, first name, last name. */
  personal?: string[];
  autoFocus?: boolean;
  /** Overrides the built-in show/hide state, so a confirm box can follow the same toggle. */
  visible?: boolean;
  onToggleVisible?: () => void;
}

/** Password box with show/hide, a strength meter and a live checklist of what is still missing. */
export function PasswordField({ label = "Password", value, onChange, personal = [], autoFocus, visible, onToggleVisible }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const show = visible ?? shown;
  const toggle = onToggleVisible ?? (() => setShown((v) => !v));
  const report = checkPassword(value, personal);

  return (
    <Box>
      <TextField
        label={label}
        type={show ? "text" : "password"}
        fullWidth
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton edge="end" size="small" aria-label={show ? "Hide password" : "Show password"} onClick={toggle}>
                  {show ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      {value.length > 0 && (
        <Box sx={{ mt: 1.25 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <LinearProgress
              variant="determinate"
              value={(report.level / 4) * 100}
              color={LEVEL_COLOR[report.level] === "inherit" ? "primary" : LEVEL_COLOR[report.level]}
              sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
              aria-label="Password strength"
            />
            <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 84, textAlign: "right" }} aria-live="polite">
              {report.label}
            </Typography>
          </Stack>
          <Box component="ul" sx={{ listStyle: "none", m: 0, mt: 1, p: 0, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5 }}>
            {report.rules.map((rule) => (
              <Stack component="li" key={rule.id} direction="row" spacing={0.75} alignItems="center">
                {rule.met ? (
                  <CheckCircleRoundedIcon sx={{ fontSize: 16, color: "success.main" }} />
                ) : (
                  <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                )}
                <Typography variant="caption" sx={{ color: rule.met ? "text.primary" : "text.secondary" }}>
                  {rule.label}
                </Typography>
              </Stack>
            ))}
          </Box>
          {(report.common || report.similar) && (
            <Typography variant="caption" color="error" display="block" sx={{ mt: 0.75 }}>
              {report.common ? "That password is too common." : "Don't use your name or email in the password."}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
