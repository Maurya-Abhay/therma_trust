import { useEffect, useState } from "react";
import { focusForm, useDeepLinkAction } from "../../lib/useDeepLink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, FormControlLabel, Paper, Snackbar, Stack, Switch, TextField, Typography } from "@mui/material";
import {
  fetchMyTechnicianProfile, publicPassportPdfUrl, publicQrImageUrl, publicVerifyUrl, updateTechnicianProfile,
} from "../../api/endpoints";
import { RoleHero } from "../../components/RoleHero";
import { PageLoader } from "../../components/PageLoader";
import { OnboardingCard } from "../../components/OnboardingCard";

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError: profileLoadError } = useQuery({
    queryKey: ["my-technician-profile"],
    queryFn: fetchMyTechnicianProfile,
  });

  const [form, setForm] = useState({ service_area: "", years_experience: 0, available: true, bio: "" });

  useEffect(() => {
    if (profile) {
      setForm({
        service_area: profile.service_area,
        years_experience: profile.years_experience,
        available: profile.available,
        bio: profile.bio,
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () => updateTechnicianProfile(profile!.id, form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-technician-profile"] }),
  });

  const [linkCopied, setLinkCopied] = useState(false);
  useDeepLinkAction(() => focusForm("profile-form"), !!profile);

  if (isLoading) return <PageLoader />;
  if (profileLoadError) return <Alert severity="error">Could not load your technician profile. Try refreshing the page.</Alert>;
  if (!profile) return <Alert severity="warning">No technician profile found for this account.</Alert>;

  return (
    <Box maxWidth={560}>
      <RoleHero
        role="technician"
        title={profile.full_name}
        subtitle={`${profile.contractor_name ?? "No contractor assigned"} · ${profile.service_area || "No service area set"}`}
        stats={[
          { label: "Years experience", value: profile.years_experience },
          { label: "Status", value: profile.available ? "Available" : "Unavailable" },
          ...(profile.average_rating !== null
            ? [{ label: `Rating (${profile.rating_count} job${profile.rating_count === 1 ? "" : "s"})`, value: `${profile.average_rating} / 5` }]
            : []),
        ]}
      />
      <OnboardingCard />


      <Paper id="profile-form" sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Service Area (city/zone)" value={form.service_area}
          onChange={(e) => setForm({ ...form, service_area: e.target.value })}
        />
        <TextField
          label="Years of Experience" type="number" value={form.years_experience}
          onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })}
        />
        <TextField
          label="Bio" multiline minRows={3} value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <FormControlLabel
          control={<Switch checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />}
          label="Available for new jobs"
        />
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
        {mutation.isError && (
          <Alert severity="error">Could not save your profile. Please try again.</Alert>
        )}
      </Paper>

      <Snackbar
        open={mutation.isSuccess}
        autoHideDuration={3000}
        onClose={() => mutation.reset()}
        message="Profile saved"
      />

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="subtitle1" mb={1}>Public Verification</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Share this link or QR code with a client or facility manager — it shows only your
          verified credentials and capabilities, nothing pending.
        </Typography>
        <Stack direction="row" spacing={3} alignItems="center">
          <Box component="img" src={publicQrImageUrl(profile.public_token)} alt="Verification QR code" width={120} height={120} />
          <Stack spacing={1} alignItems="flex-start">
            <Button
              variant="outlined"
              onClick={() => {
                navigator.clipboard.writeText(publicVerifyUrl(profile.public_token));
                setLinkCopied(true);
              }}
            >
              Copy verification link
            </Button>
            <Button variant="contained" href={publicPassportPdfUrl(profile.public_token)} target="_blank" rel="noopener noreferrer">
              Download passport (PDF)
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Snackbar
        open={linkCopied}
        autoHideDuration={2500}
        onClose={() => setLinkCopied(false)}
        message="Link copied"
      />
    </Box>
  );
}
