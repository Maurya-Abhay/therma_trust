import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, MenuItem, TextField, Typography,
} from "@mui/material";
import { createFacility, fetchFacilities } from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { RoleHero } from "../../components/RoleHero";
import { PhoneField } from "../../components/PhoneField";
import { isPhoneValid } from "../../lib/phone";
import { useDeepLinkAction } from "../../lib/useDeepLink";
import { useAuth } from "../../auth/AuthContext";
import type { Facility } from "../../types";
import { PageLoader } from "../../components/PageLoader";
import { OnboardingCard } from "../../components/OnboardingCard";

const SEGMENTS = [
  { value: "cold_storage", label: "Cold Storage" },
  { value: "supermarket_refrigeration", label: "Supermarket Refrigeration" },
  { value: "other", label: "Other" },
];

import { humanise } from "../../lib/labels";

export function FacilitiesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: facilities, isLoading } = useQuery({ queryKey: ["facilities"], queryFn: fetchFacilities });
  const totalEquipment = facilities?.reduce((sum, f) => sum + f.equipment_count, 0) ?? 0;
  const [open, setOpen] = useState(false);
  useDeepLinkAction(() => setOpen(true));
  const [form, setForm] = useState({
    name: "", segment: "cold_storage", address: "", service_area: "", contact_name: "", contact_phone: "",
  });

  const mutation = useMutation({
    meta: { success: "Facility created" },
    mutationFn: () => createFacility(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      setOpen(false);
      setForm({ name: "", segment: "cold_storage", address: "", service_area: "", contact_name: "", contact_phone: "" });
    },
  });

  return (
    <Box>
      <RoleHero
        role="facility_manager"
        title={`Welcome back${user?.first_name ? `, ${user.first_name}` : ""}`}
        subtitle="Your facilities, equipment, and job risk at a glance."
        stats={[
          { label: "Facilities", value: facilities?.length ?? 0 },
          { label: "Equipment items", value: totalEquipment },
        ]}
        action={
          <Button variant="contained" onClick={() => setOpen(true)}>
            Add Facility
          </Button>
        }
      />
      <OnboardingCard />


      {isLoading && <PageLoader />}

      <Grid container spacing={2}>
        {facilities?.map((f: Facility) => (
          <Grid key={f.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardActionArea component={RouterLink} to={`/facilities/${f.id}`}>
                <CardContent>
                  <Typography variant="h6">{f.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {humanise(f.segment)} &middot; {f.service_area}
                  </Typography>
                  <Typography variant="body2" mt={1}>
                    {f.equipment_count} equipment item(s)
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Facility</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <TextField select label="Segment" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
            {SEGMENTS.map((s) => (
              <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          <TextField label="Service Area (city/zone)" value={form.service_area} onChange={(e) => setForm({ ...form, service_area: e.target.value })} required />
          <TextField label="Contact Name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <PhoneField label="Contact phone" value={form.contact_phone} onChange={(value) => setForm({ ...form, contact_phone: value })} />
          {mutation.isError && <Alert severity="error">{getErrorMessage(mutation.error)}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !isPhoneValid(form.contact_phone)}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
