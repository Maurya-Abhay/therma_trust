"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { Alert, Box, Button, Grid, Link, Stack, TextField, Typography } from "@mui/material";
import { motion } from "framer-motion";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import EngineeringRoundedIcon from "@mui/icons-material/EngineeringRounded";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import { register } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { enterApp } from "../roleHome";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { PasswordField } from "../components/PasswordField";
import { PhoneField } from "../components/PhoneField";
import { checkPassword } from "../lib/password";
import { isPhoneValid } from "../lib/phone";
import { FONT, L } from "./landing/tokens";

const ROLE_OPTIONS = [
  { value: "facility_manager", label: "Facility Manager", hint: "Raise jobs", icon: ApartmentRoundedIcon },
  { value: "technician", label: "Technician", hint: "Do the work", icon: EngineeringRoundedIcon },
  { value: "contractor_manager", label: "Contractor", hint: "Run a team", icon: BusinessCenterRoundedIcon },
] as const;

/** Each role has its own colour on the landing page's badges; the picker reuses it. */
const ROLE_FILL: Record<string, { fill: string; text: string }> = {
  facility_manager: { fill: L.teal, text: "#fff" },
  technician: { fill: L.heat, text: "#fff" },
  contractor_manager: { fill: L.amber, text: L.ink },
};

type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

function isRoleValue(value: string | null): value is RoleValue {
  return ROLE_OPTIONS.some((opt) => opt.value === value);
}

export function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetRole = searchParams.get("role");

  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: (isRoleValue(presetRole) ? presetRole : "facility_manager") as RoleValue,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const passwordOk = checkPassword(form.password, [form.email, form.first_name, form.last_name]).ok;
  const phoneOk = isPhoneValid(form.phone);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phoneOk) return setError("Enter a valid phone number for the country you selected, or leave it blank.");
    if (!passwordOk) return setError("Choose a stronger password: the checklist under the password shows what is missing.");
    setSubmitting(true);
    try {
      await register(form);
      try {
        const user = await login(form.email, form.password);
        enterApp(user.role);
      } catch {
        // The account exists now, so don't report a failed registration (retrying would only say
        // "already exists"); send them to sign in instead.
        router.push("/login?registered=1");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not register. Check your details and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      eyebrow="New account"
      title="Create your account"
      subtitle="Set up your role-specific dashboard in a minute."
    >
      <Box component="form" onSubmit={handleSubmit}>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {error}
          </Alert>
        )}
        <Stack spacing={2}>
          <Box>
            <Typography sx={{ fontFamily: FONT.mono, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 11, color: "text.secondary", mb: 1.25 }}>I am a...</Typography>
            <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={1.5} role="radiogroup" aria-label="Account role">
              {ROLE_OPTIONS.map((opt) => {
                const accent = ROLE_FILL[opt.value];
                const selected = form.role === opt.value;
                const Icon = opt.icon;
                return (
                  <Box
                    key={opt.value}
                    role="radio"
                    aria-checked={selected}
                    tabIndex={0}
                    onClick={() => update("role", opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        update("role", opt.value);
                      }
                    }}
                    sx={{
                      position: "relative",
                      cursor: "pointer",
                      textAlign: "center",
                      p: 1.5,
                      pt: 2,
                      borderRadius: "3px",
                      border: `2px solid ${selected ? L.ink : "rgba(14,23,38,0.4)"}`,
                      bgcolor: selected ? accent.fill : "#fff",
                      color: selected ? accent.text : L.ink,
                      boxShadow: selected ? `4px 4px 0 ${L.ink}` : "none",
                      transform: selected ? "translate(-2px, -2px)" : "none",
                      transition: "all .18s ease",
                      outline: "none",
                      "&:hover": { borderColor: L.ink },
                      "&:focus-visible": { outline: `2px solid ${L.ink}`, outlineOffset: 3 },
                    }}
                  >
                    {selected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        style={{ position: "absolute", top: 6, right: 6, width: 12, height: 12, background: L.ink, display: "grid", placeItems: "center" }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4.2 3.1 6 7 1.6" stroke="#fff" strokeWidth="1.5" fill="none" /></svg>
                      </motion.div>
                    )}
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        mx: "auto",
                        mb: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: L.ink,
                        bgcolor: L.paper,
                        border: `2px solid ${L.ink}`,
                      }}
                    >
                      <Icon fontSize="small" />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.2, color: "inherit" }}>{opt.label}</Typography>
                    <Typography sx={{ fontSize: 11, opacity: 0.72, mt: 0.25, color: "inherit" }}>{opt.hint}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Grid container spacing={2}>
            <Grid size={6}>
              <TextField label="First name" fullWidth value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required />
            </Grid>
            <Grid size={6}>
              <TextField label="Last name" fullWidth value={form.last_name} onChange={(e) => update("last_name", e.target.value)} required />
            </Grid>
          </Grid>
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            required
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <PhoneField label="Phone (optional)" value={form.phone} onChange={(value) => update("phone", value)} />
          <PasswordField
            value={form.password}
            onChange={(value) => update("password", value)}
            personal={[form.email, form.first_name, form.last_name]}
          />
          <Button type="submit" variant="contained" size="large" fullWidth disabled={submitting} sx={{ mt: 1 }}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </Stack>
        <Typography variant="body2" mt={4} textAlign="center" color="text.secondary">
          Already have an account? <Link component={NextLink} href="/login">Sign in</Link>
        </Typography>
      </Box>
    </AuthSplitLayout>
  );
}
