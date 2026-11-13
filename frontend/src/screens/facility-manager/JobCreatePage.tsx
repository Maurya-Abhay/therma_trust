import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, MenuItem, Paper, TextField } from "@mui/material";
import { createJob, fetchChoices, fetchEquipment, fetchFacilities } from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { PageHeader } from "../../components/PageHeader";

export function JobCreatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const { data: facilities } = useQuery({ queryKey: ["facilities"], queryFn: fetchFacilities });
  const { data: choices } = useQuery({ queryKey: ["choices"], queryFn: fetchChoices });

  const [facilityId, setFacilityId] = useState<number>(Number(params.get("facility")) || 0);
  const { data: equipment } = useQuery({
    queryKey: ["equipment", facilityId],
    queryFn: () => fetchEquipment(facilityId),
    enabled: !!facilityId,
  });

  const [form, setForm] = useState({
    equipment: Number(params.get("equipment")) || 0,
    description: "",
    urgency: "scheduled",
    scheduled_for: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      createJob({
        facility: facilityId,
        equipment: form.equipment,
        description: form.description,
        urgency: form.urgency,
        scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
      }),
    meta: { success: "Job request created" },
    onSuccess: (job) => navigate(`/jobs/${job.id}`),
  });

  return (
    <Box maxWidth={500}>
      <PageHeader title="New Job Request" subtitle="Describe the problem. The platform rates the risk and finds qualified technicians." mb={3} />
      <Paper sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          select label="Facility" value={facilityId || ""}
          onChange={(e) => { setFacilityId(Number(e.target.value)); setForm({ ...form, equipment: 0 }); }}
        >
          {facilities?.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
        </TextField>
        <TextField
          select label="Equipment" value={form.equipment || ""} disabled={!facilityId}
          onChange={(e) => setForm({ ...form, equipment: Number(e.target.value) })}
        >
          {equipment?.map((eq) => <MenuItem key={eq.id} value={eq.id}>{eq.name} ({eq.category_display})</MenuItem>)}
        </TextField>
        <TextField
          select label="Urgency" value={form.urgency}
          onChange={(e) => setForm({ ...form, urgency: e.target.value })}
        >
          {choices?.urgencies.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
        </TextField>
        <TextField
          label="Planned date and time (optional)"
          type="datetime-local"
          value={form.scheduled_for}
          onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
          helperText="Shows on the calendar for you and the assigned technician"
        />
        <TextField
          label="Description" multiline minRows={3} value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <Button
          variant="contained" onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !facilityId || !form.equipment || !form.description}
        >
          Submit Job Request
        </Button>
        {mutation.isError && <Alert severity="error">{getErrorMessage(mutation.error)}</Alert>}
      </Paper>
    </Box>
  );
}
