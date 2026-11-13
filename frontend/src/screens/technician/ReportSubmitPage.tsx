import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Checkbox, FormControlLabel, Grid, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { createServiceReport, fetchCylinders, fetchJob, fetchRefrigerantTypes, fetchServiceReports } from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { StatusChip } from "../../components/StatusChip";
import { isUnreachable } from "../../offline/connectivity";
import { useOffline } from "../../offline/OfflineContext";
import { PageLoader } from "../../components/PageLoader";

const RESULT_OPTIONS = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "not_applicable", label: "Not Applicable" },
];

export function ReportSubmitPage() {
  const { id } = useParams();
  const jobId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueReport, pending } = useOffline();

  const { data: job } = useQuery({ queryKey: ["job", jobId], queryFn: () => fetchJob(jobId) });
  const { data: reports } = useQuery({ queryKey: ["service-reports", jobId], queryFn: () => fetchServiceReports({ job: jobId }) });
  const { data: refrigerants } = useQuery({ queryKey: ["refrigerant-types"], queryFn: fetchRefrigerantTypes });
  const { data: cylinders } = useQuery({ queryKey: ["cylinders"], queryFn: fetchCylinders });

  const existingReport = reports?.[0];

  const [form, setForm] = useState({
    fault_description: "", refrigerant_type: 0, refrigerant_added_kg: "0", refrigerant_recovered_kg: "0",
    leak_test_result: "pass", vacuum_result: "pass", parts_replaced: "", summary: "",
    suction_pressure: "", discharge_pressure: "", superheat: "", subcooling: "", amps: "",
    added_from_cylinder: 0, recovered_into_cylinder: 0,
    lockout_tagout: false, ppe_used: false, area_secured: false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        job: jobId,
        fault_description: form.fault_description,
        diagnostic_readings: {
          suction_pressure: form.suction_pressure,
          discharge_pressure: form.discharge_pressure,
          superheat: form.superheat,
          subcooling: form.subcooling,
          amps: form.amps,
        },
        refrigerant_type: form.refrigerant_type,
        refrigerant_added_kg: form.refrigerant_added_kg,
        refrigerant_recovered_kg: form.refrigerant_recovered_kg,
        added_from_cylinder: form.added_from_cylinder || null,
        recovered_into_cylinder: form.recovered_into_cylinder || null,
        leak_test_result: form.leak_test_result,
        vacuum_result: form.vacuum_result,
        parts_replaced: form.parts_replaced,
        safety_checklist: {
          lockout_tagout: form.lockout_tagout,
          ppe_used: form.ppe_used,
          area_secured: form.area_secured,
        },
        summary: form.summary,
      };
      try {
        await createServiceReport(payload);
      } catch (error) {
        // Server unreachable (offline, or a gateway error from a sleeping host):
        // keep the technician's work on the device instead of losing it. A real
        // rejection (400/403/500) is still an error they need to see and fix.
        if (isUnreachable(error)) {
          await enqueueReport(jobId, payload, `Job #${jobId} - ${job?.equipment_name ?? "service report"}`);
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-reports", jobId] });
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      navigate("/my-jobs");
    },
  });

  if (!job) return <PageLoader />;

  const matching = (cylinders ?? []).filter((c) => c.refrigerant_type === form.refrigerant_type);
  const supplyCylinders = matching.filter((c) => c.kind === "supply");
  const recoveryCylinders = matching.filter((c) => c.kind === "recovery");

  if (!existingReport && pending.some((item) => item.jobId === jobId)) {
    return (
      <Box maxWidth={600}>
        <Typography variant="h4" mb={2}>Service Report</Typography>
        <Alert severity="info">
          This report is saved on your device and will be sent automatically as soon as you're back online.
        </Alert>
      </Box>
    );
  }

  if (existingReport) {
    return (
      <Box maxWidth={600}>
        <Typography variant="h4" mb={2}>Service Report</Typography>
        <Paper sx={{ p: 3 }}>
          <StatusChip status={existingReport.status} />
          <Typography mt={2}><strong>Fault:</strong> {existingReport.fault_description}</Typography>
          <Typography><strong>Summary:</strong> {existingReport.summary}</Typography>
          <Typography>
            Refrigerant ({existingReport.refrigerant_code}): +{existingReport.refrigerant_added_kg}kg / -{existingReport.refrigerant_recovered_kg}kg
          </Typography>
          {(existingReport.added_from_cylinder_serial || existingReport.recovered_into_cylinder_serial) && (
            <Typography>
              Cylinders: {existingReport.added_from_cylinder_serial ? `drawn from ${existingReport.added_from_cylinder_serial}` : ""}
              {existingReport.added_from_cylinder_serial && existingReport.recovered_into_cylinder_serial ? " · " : ""}
              {existingReport.recovered_into_cylinder_serial ? `recovered into ${existingReport.recovered_into_cylinder_serial}` : ""}
            </Typography>
          )}
          <Typography>Leak test: {existingReport.leak_test_result} &middot; Vacuum: {existingReport.vacuum_result}</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box maxWidth={700}>
      <Typography variant="h4" mb={1}>Submit Service Report</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Job #{job.id} &middot; {job.equipment_name} @ {job.facility_name}
      </Typography>

      <Paper sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField label="Fault Description" multiline minRows={2} value={form.fault_description} onChange={(e) => setForm({ ...form, fault_description: e.target.value })} required />

        <Typography variant="subtitle2">Diagnostic Readings</Typography>
        <Grid container spacing={2}>
          <Grid size={6}><TextField label="Suction Pressure" fullWidth value={form.suction_pressure} onChange={(e) => setForm({ ...form, suction_pressure: e.target.value })} /></Grid>
          <Grid size={6}><TextField label="Discharge Pressure" fullWidth value={form.discharge_pressure} onChange={(e) => setForm({ ...form, discharge_pressure: e.target.value })} /></Grid>
          <Grid size={6}><TextField label="Superheat" fullWidth value={form.superheat} onChange={(e) => setForm({ ...form, superheat: e.target.value })} /></Grid>
          <Grid size={6}><TextField label="Subcooling" fullWidth value={form.subcooling} onChange={(e) => setForm({ ...form, subcooling: e.target.value })} /></Grid>
          <Grid size={6}><TextField label="Compressor Amps" fullWidth value={form.amps} onChange={(e) => setForm({ ...form, amps: e.target.value })} /></Grid>
        </Grid>

        <Typography variant="subtitle2">Refrigerant</Typography>
        <TextField select label="Refrigerant Type" value={form.refrigerant_type || ""} onChange={(e) => setForm({ ...form, refrigerant_type: Number(e.target.value), added_from_cylinder: 0, recovered_into_cylinder: 0 })} required>
          {refrigerants?.map((r) => <MenuItem key={r.id} value={r.id}>{r.code}</MenuItem>)}
        </TextField>
        <Grid container spacing={2}>
          <Grid size={6}><TextField label="Added (kg)" fullWidth value={form.refrigerant_added_kg} onChange={(e) => setForm({ ...form, refrigerant_added_kg: e.target.value })} /></Grid>
          <Grid size={6}><TextField label="Recovered (kg)" fullWidth value={form.refrigerant_recovered_kg} onChange={(e) => setForm({ ...form, refrigerant_recovered_kg: e.target.value })} /></Grid>
          <Grid size={6}>
            <TextField
              select fullWidth label="Added from cylinder (optional)" value={form.added_from_cylinder || ""}
              onChange={(e) => setForm({ ...form, added_from_cylinder: Number(e.target.value) })}
              helperText="Logs the gas against a supply cylinder for chain of custody"
            >
              <MenuItem value="">None</MenuItem>
              {supplyCylinders.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.serial_number} — {c.current_kg} kg left</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={6}>
            <TextField
              select fullWidth label="Recovered into cylinder (optional)" value={form.recovered_into_cylinder || ""}
              onChange={(e) => setForm({ ...form, recovered_into_cylinder: Number(e.target.value) })}
              helperText="Logs recovered gas against a recovery cylinder"
            >
              <MenuItem value="">None</MenuItem>
              {recoveryCylinders.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.serial_number} — {c.current_kg}/{c.capacity_kg} kg</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid size={6}>
            <TextField select fullWidth label="Leak Test Result" value={form.leak_test_result} onChange={(e) => setForm({ ...form, leak_test_result: e.target.value })}>
              {RESULT_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={6}>
            <TextField select fullWidth label="Vacuum Result" value={form.vacuum_result} onChange={(e) => setForm({ ...form, vacuum_result: e.target.value })}>
              {RESULT_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>

        <TextField label="Parts Replaced" value={form.parts_replaced} onChange={(e) => setForm({ ...form, parts_replaced: e.target.value })} />

        <Typography variant="subtitle2">Safety Checklist</Typography>
        <Stack direction="row" spacing={2}>
          <FormControlLabel control={<Checkbox checked={form.lockout_tagout} onChange={(e) => setForm({ ...form, lockout_tagout: e.target.checked })} />} label="Lockout/Tagout" />
          <FormControlLabel control={<Checkbox checked={form.ppe_used} onChange={(e) => setForm({ ...form, ppe_used: e.target.checked })} />} label="PPE Used" />
          <FormControlLabel control={<Checkbox checked={form.area_secured} onChange={(e) => setForm({ ...form, area_secured: e.target.checked })} />} label="Area Secured" />
        </Stack>

        <TextField label="Summary" multiline minRows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} required />

        <Button
          variant="contained" onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.fault_description || !form.refrigerant_type || !form.summary}
        >
          Submit & Sign
        </Button>
        {mutation.isError && <Alert severity="error">{getErrorMessage(mutation.error)}</Alert>}
      </Paper>
    </Box>
  );
}
