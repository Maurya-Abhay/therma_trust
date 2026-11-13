"use client";

import { useState } from "react";
import NextLink from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Alert, Box, Button, InputAdornment, Link, Stack, TextField, Typography } from "@mui/material";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import { requestPasswordReset } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import { AuthSplitLayout } from "../components/AuthSplitLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const mutation = useMutation({ mutationFn: () => requestPasswordReset(email.trim()) });

  return (
    <AuthSplitLayout eyebrow="Password help" title="Forgot your password?" subtitle="Enter your email and we will send you a link to choose a new one.">
      {mutation.isSuccess ? (
        <Stack spacing={2.5} alignItems="flex-start">
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "3px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              bgcolor: "#0D9488",
              border: "2px solid #0E1726",
              boxShadow: "4px 4px 0 #0E1726",
            }}
          >
            <MarkEmailReadRoundedIcon />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Check your inbox</Typography>
          <Typography color="text.secondary">
            If <b>{email}</b> has an account, a reset link is on its way. It can take a minute, and it is worth
            checking spam.
          </Typography>
          <Link component={NextLink} href="/login">Back to sign in</Link>
        </Stack>
      ) : (
        <Box
          component="form"
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Stack spacing={2.5}>
            {mutation.isError && <Alert severity="error">{getErrorMessage(mutation.error)}</Alert>}
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            <Button type="submit" variant="contained" size="large" fullWidth disabled={mutation.isPending || !email} sx={{ py: 1.5 }}>
              {mutation.isPending ? "Sending..." : "Send reset link"}
            </Button>
            <Typography variant="body2" textAlign="center" color="text.secondary">
              Remembered it? <Link component={NextLink} href="/login">Sign in</Link>
            </Typography>
          </Stack>
        </Box>
      )}
    </AuthSplitLayout>
  );
}
