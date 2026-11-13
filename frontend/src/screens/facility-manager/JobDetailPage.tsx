import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Rating, Stack, TextField, Typography,
} from "@mui/material";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import {
  assignJob, downloadServiceReportPdf, fetchJob, fetchJobMatches, fetchServiceReports, approveServiceReport, rejectServiceReport,
  scheduleJob, submitJobFeedback,
} from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { RiskChip } from "../../components/RiskChip";
import { StatusChip } from "../../components/StatusChip";
import { DriftWarningBadge } from "../../components/DriftWarningBadge";
import type { JobMatch } from "../../types";
import axios from "axios";
import { PageLoader } from "../../components/PageLoader";

import { useLabels } from "../../lib/labels";

export function JobDetailPage() {
  const labels = useLabels();
  const { id } = useParams();
  const jobId = Number(id);
  const queryClient = useQueryClient();

  const { data: job } = useQuery({ queryKey: ["job", jobId], queryFn: () => fetchJob(jobId) });
  const { data: matches } = useQuery({
    queryKey: ["job-matches", jobId],
    queryFn: () => fetchJobMatches(jobId),
    enabled: !!job && job.status === "open",
  });
  const { data: reports } = useQuery({
    queryKey: ["service-reports", jobId],
    queryFn: () => fetchServiceReports({ job: jobId }),
    enabled: !!job && job.status !== "open",
  });

  const [scheduleValue, setScheduleValue] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const scheduleMutation = useMutation({
    mutationFn: (value: string | null) => scheduleJob(jobId, value ? new Date(value).toISOString() : null),
    meta: { success: "Schedule saved", toastError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setScheduleValue(null);
    },
  });
  const feedbackMutation = useMutation({
    mutationFn: () => submitJobFeedback(jobId, rating ?? 0, comment),
    meta: { success: "Thanks, your rating was saved", toastError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", jobId] }),
  });
  const pdfMutation = useMutation({
    mutationFn: (reportId: number) => downloadServiceReportPdf(reportId, jobId),
    meta: { toastError: true },
  });

  const [overrideTarget, setOverrideTarget] = useState<JobMatch | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const assignMutation = useMutation({
    meta: { success: "Technician assigned" },
    mutationFn: ({ technicianId, override, reason }: { technicianId: number; override: boolean; reason: string }) =>
      assignJob(jobId, technicianId, override, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setOverrideTarget(null);
      setOverrideReason("");
      setAssignError(null);
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setAssignError(err.response.data.detail);
      } else {
        setAssignError("Could not assign technician.");
      }
    },
  });

  function handleAssignClick(match: JobMatch) {
    setAssignError(null);
    if (!match.is_qualified) {
      setOverrideTarget(match);
      return;
    }
    assignMutation.mutate({ technicianId: match.technician_id, override: false, reason: "" });
  }

  const approveMutation = useMutation({
    meta: { success: "Report approved" },
    mutationFn: (reportId: number) => approveServiceReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-reports", jobId] });
      // Approving completes the job, which is what unlocks the rating form.
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
  const rejectMutation = useMutation({
    meta: { success: "Report sent back to the technician" },
    mutationFn: (reportId: number) => rejectServiceReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-reports", jobId] });
      // Approving completes the job, which is what unlocks the rating form.
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  if (!job) return <PageLoader />;

  return (
    <Box>
      <Typography variant="h4" mb={1}>Job #{job.id}</Typography>
      <Stack direction="row" spacing={1} mb={2}>
        <RiskChip level={job.risk_level} />
        <StatusChip status={job.status} />
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <Typography variant="body1">{job.equipment_name} @ {job.facility_name}</Typography>
        <DriftWarningBadge warnings={job.equipment_drift_warnings} />
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={2}>{job.description}</Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
          <Stack direction="row" spacing={1.25} alignItems="center" flexGrow={1}>
            <EventRoundedIcon color="primary" />
            <Box>
              <Typography variant="subtitle1">Planned for</Typography>
              <Typography variant="body2" color="text.secondary">
                {job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : "No date set yet"}
              </Typography>
            </Box>
          </Stack>
          <TextField
            size="small"
            type="datetime-local"
            label="Change date and time"
            value={scheduleValue ?? ""}
            onChange={(e) => setScheduleValue(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button variant="contained" disabled={!scheduleValue || scheduleMutation.isPending} onClick={() => scheduleMutation.mutate(scheduleValue)}>
            Save
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" mb={1}>Required Capabilities</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {job.required_capabilities.map((req, i) => (
            <Chip key={i} size="small" label={labels.requirement(req)} sx={{ mb: 1 }} />
          ))}
        </Stack>
      </Paper>

      {job.assignment && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1">Assigned Technician</Typography>
          <Typography>{job.assignment.technician_name}</Typography>
          {job.assignment.override_warning && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Assigned despite missing capability warning. Reason: {job.assignment.override_reason}
            </Alert>
          )}
        </Paper>
      )}

      {job.status === "open" && (
        <>
          <Typography variant="h6" mb={2}>Ranked Technician Matches</Typography>
          {assignError && <Alert severity="error" sx={{ mb: 2 }}>{assignError}</Alert>}
          <Stack spacing={2}>
            {matches?.map((m) => (
              <Paper key={m.technician_id} sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="subtitle1">{m.name} {m.contractor && `(${m.contractor})`}</Typography>
                  <Typography variant="body2" color="text.secondary">Score: {m.score}</Typography>
                  {!m.is_qualified && (
                    <Typography variant="body2" color="error">
                      Missing: {m.missing_requirements.map((r) => labels.requirementValue(r)).join(", ")}
                    </Typography>
                  )}
                </Box>
                <Button
                  variant={m.is_qualified ? "contained" : "outlined"}
                  color={m.is_qualified ? "primary" : "warning"}
                  onClick={() => handleAssignClick(m)}
                >
                  {m.is_qualified ? "Assign" : "Assign anyway"}
                </Button>
              </Paper>
            ))}
            {matches?.length === 0 && <Typography color="text.secondary">No available technicians found.</Typography>}
          </Stack>
        </>
      )}

      {reports && reports.length > 0 && (
        <Paper sx={{ p: 2, mt: 3 }}>
          <Typography variant="subtitle1" mb={1}>Service Report</Typography>
          {reports.map((r) => (
            <Box key={r.id}>
              <StatusChip status={r.status} />
              <Typography variant="body2" mt={1}><strong>Fault:</strong> {r.fault_description}</Typography>
              <Typography variant="body2"><strong>Summary:</strong> {r.summary}</Typography>
              <Typography variant="body2">
                Refrigerant ({r.refrigerant_code}): +{r.refrigerant_added_kg}kg added / {r.refrigerant_recovered_kg}kg recovered
              </Typography>
              <Typography variant="body2">Leak test: {r.leak_test_result} &middot; Vacuum: {r.vacuum_result}</Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PictureAsPdfRoundedIcon />}
                sx={{ mt: 1.5 }}
                disabled={pdfMutation.isPending}
                onClick={() => pdfMutation.mutate(r.id)}
              >
                Download PDF
              </Button>
              {r.status === "submitted" && (
                <Stack direction="row" spacing={1} mt={2}>
                  <Button variant="contained" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>Approve</Button>
                  <Button variant="outlined" color="error" onClick={() => rejectMutation.mutate(r.id)} disabled={rejectMutation.isPending}>Reject</Button>
                </Stack>
              )}
              {(approveMutation.isError || rejectMutation.isError) && (
                <Alert severity="error" sx={{ mt: 2 }}>{getErrorMessage(approveMutation.error || rejectMutation.error)}</Alert>
              )}
            </Box>
          ))}
        </Paper>
      )}

      {job.status === "completed" && job.assignment && (
        <Paper sx={{ p: 2.5, mt: 3 }}>
          <Typography variant="subtitle1" mb={1}>How did {job.assignment.technician_name} do?</Typography>
          {job.feedback ? (
            <Stack spacing={0.5}>
              <Rating value={job.feedback.rating} readOnly />
              {job.feedback.comment && <Typography variant="body2" color="text.secondary">{job.feedback.comment}</Typography>}
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Rating value={rating} onChange={(_event, value) => setRating(value)} size="large" />
              <TextField
                size="small"
                label="Comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                inputProps={{ maxLength: 500 }}
              />
              <Box>
                <Button variant="contained" disabled={!rating || feedbackMutation.isPending} onClick={() => feedbackMutation.mutate()}>
                  Submit rating
                </Button>
              </Box>
            </Stack>
          )}
        </Paper>
      )}

      <Dialog open={!!overrideTarget} onClose={() => setOverrideTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Assign underqualified technician?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {overrideTarget?.name} is missing required verified capabilities for this {job.risk_level.replace("_", " ")}-risk job.
            This will be recorded as an audited override.
          </Alert>
          <TextField
            label="Reason for override" fullWidth multiline minRows={2}
            value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideTarget(null)}>Cancel</Button>
          <Button
            variant="contained" color="warning" disabled={!overrideReason}
            onClick={() => overrideTarget && assignMutation.mutate({ technicianId: overrideTarget.technician_id, override: true, reason: overrideReason })}
          >
            Assign Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
