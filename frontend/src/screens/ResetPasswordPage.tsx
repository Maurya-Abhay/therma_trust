"use client";

import { useState } from "react";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Alert, Box, Button, Link, Stack, TextField, Typography } from "@mui/material";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { confirmPasswordReset } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { PasswordField } from "../components/PasswordField";
import { checkPassword } from "../lib/password";

export function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const mutation = useMutation({
    mutationFn: () => confirmPasswordReset({ uid, token, password }),
    onSuccess: () => {
      window.setTimeout(() => router.push("/login"), 2200);
    },
  });

  const mismatch = confirm.length > 0 && password !== confirm;
  const passwordOk = checkPassword(password).ok;
  const linkMissing = !uid || !token;

  return (
    <AuthSplitLayout eyebrow="Password reset" title="Choose a new password" subtitle="Pick something you have not used elsewhere. The checklist shows what makes it strong.">
      {mutation.isSuccess ? (
        <Stack spacing={2} alignItems="flex-start">
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
            <TaskAltRoundedIcon />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Password updated</Typography>
          <Typography color="text.secondary">Taking you to sign in...</Typography>
        </Stack>
      ) : (
        <Box
          component="form"
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            if (!mismatch) mutation.mutate();
          }}
        >
          <Stack spacing={2.5}>
            {linkMissing && (
              <Alert severity="warning">
                This page needs the link from your email. <Link component={NextLink} href="/forgot-password">Request a new one</Link>.
              </Alert>
            )}
            {mutation.isError && (
              <Alert severity="error">
                {getErrorMessage(mutation.error)}{" "}
                <Link component={NextLink} href="/forgot-password">Request a new link</Link>
              </Alert>
            )}
            <PasswordField
              label="New password"
              value={password}
              onChange={setPassword}
              autoFocus
              visible={show}
              onToggleVisible={() => setShow((v) => !v)}
            />
            <TextField
              label="Confirm password"
              type={show ? "text" : "password"}
              fullWidth
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={mismatch}
              helperText={mismatch ? "The two passwords do not match" : " "}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={mutation.isPending || linkMissing || !passwordOk || mismatch || confirm.length === 0}
              sx={{ py: 1.5 }}
            >
              {mutation.isPending ? "Saving..." : "Update password"}
            </Button>
          </Stack>
        </Box>
      )}
    </AuthSplitLayout>
  );
}
