"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import axios from "axios";
import { Alert, Box, Button, IconButton, InputAdornment, Link, Stack, TextField, Typography } from "@mui/material";
import { motion } from "framer-motion";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useAuth } from "../auth/AuthContext";
import { enterApp } from "../roleHome";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { Stagger, StaggerItem } from "../components/motion";
import { getErrorMessage } from "../api/errors";
import { isUnreachable } from "../offline/connectivity";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sent here by the register page when the account was created but the automatic sign-in didn't go through.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("registered")) {
      setNotice("Your account is ready. Sign in with the email and password you just chose.");
    }
  }, []);

  // A sleeping free-tier server can take up to a minute; say so instead of leaving a silent spinner.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!submitting) return;
    const timer = window.setTimeout(() => setSlow(true), 4000);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [submitting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      enterApp(user.role);
    } catch (err) {
      // Only a rejection from the server means wrong credentials. A sleeping free-tier host or a
      // dropped connection must not read as "wrong password", or people reset a good password.
      if (isUnreachable(err)) {
        setError("We couldn't reach the server. It may be waking up, so wait about 30 seconds and try again.");
      } else if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError(getErrorMessage(err, "Could not sign in. Please try again."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout eyebrow="Sign in" title="Welcome back" subtitle="Sign in to pick up right where you left off.">
      <Box component="form" onSubmit={handleSubmit}>
        {notice && !error && (
          <Alert severity="success" sx={{ mb: 2.5 }}>
            {notice}
          </Alert>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }} transition={{ duration: 0.45 }}>
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          </motion.div>
        )}
        <Stagger inView={false} gap={0.08}>
          <Stack spacing={2.5}>
            <StaggerItem>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                // Phone keyboards capitalise the first letter of a field; email addresses aren't written that way.
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <MailOutlineRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </StaggerItem>
            <StaggerItem>
              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </StaggerItem>
            <StaggerItem>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={submitting}
                endIcon={!submitting && <ArrowForwardRoundedIcon />}
                sx={{ py: 1.5 }}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </StaggerItem>
            {slow && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Alert severity="info" sx={{ fontSize: 13.5 }}>
                  Waking up the server. The first sign-in after a quiet spell can take up to a minute.
                </Alert>
              </motion.div>
            )}
          </Stack>
        </Stagger>
        <Typography variant="body2" mt={3.5} textAlign="center">
          <Link component={NextLink} href="/forgot-password">Forgot your password?</Link>
        </Typography>
        <Typography variant="body2" mt={1.5} textAlign="center" color="text.secondary">
          No account? <Link component={NextLink} href="/register">Create one</Link>
        </Typography>
      </Box>
    </AuthSplitLayout>
  );
}
