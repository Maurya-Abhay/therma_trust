import { Link as RouterLink, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import WaterDropRoundedIcon from "@mui/icons-material/WaterDropRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import { downloadEquipmentLabel, fetchEquipmentHistory } from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { useAuth } from "../../auth/AuthContext";
import { EmptyState } from "../../components/EmptyState";
import { PageLoader } from "../../components/PageLoader";
import { RiskChip } from "../../components/RiskChip";
import { StatCard } from "../../components/StatCard";
import { StatusChip } from "../../components/StatusChip";

export function EquipmentPage() {
  const { id } = useParams();
  const equipmentId = Number(id);
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["equipment-history", equipmentId],
    queryFn: () => fetchEquipmentHistory(equipmentId),
    enabled: !!equipmentId,
  });
  const label = useMutation({ mutationFn: () => downloadEquipmentLabel(equipmentId) });

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <Alert severity="error">This equipment could not be found.</Alert>;

  const { equipment, leak_rate: leak } = data;
  const canRequestJob = user?.role === "facility_manager";

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} mb={3}>
        <Box>
          <Typography variant="h4">{equipment.name}</Typography>
          <Typography color="text.secondary">
            {data.facility_name} &middot; {equipment.category_display} &middot; {equipment.refrigerant_type_code}
            {equipment.capacity ? ` · ${equipment.capacity}` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<QrCode2RoundedIcon />} onClick={() => label.mutate()} disabled={label.isPending}>
            {label.isPending ? "Preparing..." : "Print QR label"}
          </Button>
          {canRequestJob && (
            <Button variant="contained" component={RouterLink} to={`/jobs/new?equipment=${equipment.id}&facility=${equipment.facility}`}>
              Request job
            </Button>
          )}
        </Stack>
      </Stack>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(3, 1fr)" }} gap={2.5} mb={3}>
        <StatCard
          label="Leak rate (12 months)"
          value={leak.leak_rate_percent ?? 0}
          unit="%"
          decimals={1}
          icon={WaterDropRoundedIcon}
          tone={leak.exceeds_threshold ? "#E11D48" : "#0D9488"}
          hint={
            leak.leak_rate_percent === null
              ? leak.note ?? "No charge recorded"
              : leak.exceeds_threshold
                ? `Over the ${leak.threshold_percent}% flag`
                : `Within the ${leak.threshold_percent}% flag`
          }
        />
        <StatCard label="Refrigerant added (12 months)" value={leak.added_kg_12mo} unit="kg" decimals={1} icon={ScienceRoundedIcon} tone="#2563EB" />
        <StatCard label="Jobs on record" value={data.jobs.length} icon={WorkRoundedIcon} tone="#7C3AED" />
      </Box>

      {label.isError && <Alert severity="error" sx={{ mb: 2 }}>{getErrorMessage(label.error)}</Alert>}

      <Typography variant="h6" mb={1.5}>Jobs</Typography>
      <Paper sx={{ mb: 3 }}>
        {data.jobs.length === 0 ? (
          <EmptyState title="No jobs yet" body="Jobs raised for this equipment will be listed here." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Job</TableCell>
                <TableCell>Raised</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Scheduled</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    {canRequestJob ? (
                      <Button size="small" component={RouterLink} to={`/jobs/${job.id}`}>#{job.id}</Button>
                    ) : (
                      <>#{job.id}</>
                    )}
                    <Typography variant="body2" color="text.secondary">{job.description}</Typography>
                  </TableCell>
                  <TableCell>{new Date(job.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><RiskChip level={job.risk_level} /></TableCell>
                  <TableCell><StatusChip status={job.status} /></TableCell>
                  <TableCell>{job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : "Not scheduled"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Typography variant="h6" mb={1.5}>Service reports</Typography>
      <Paper>
        {data.reports.length === 0 ? (
          <EmptyState title="No service reports yet" body="Refrigerant added or recovered on this unit will appear here." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Technician</TableCell>
                <TableCell align="right">Added (kg)</TableCell>
                <TableCell align="right">Recovered (kg)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Summary</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{r.technician}</TableCell>
                  <TableCell align="right">{r.refrigerant_added_kg}</TableCell>
                  <TableCell align="right">{r.refrigerant_recovered_kg}</TableCell>
                  <TableCell><StatusChip status={r.status} /></TableCell>
                  <TableCell>{r.summary || <Chip size="small" label="No summary" />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
