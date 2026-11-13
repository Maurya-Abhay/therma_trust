import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import {
  fetchCylinders, fetchJob, fetchJobs, fetchRefrigerantTypes, fetchServiceReports,
} from "../../api/endpoints";
import { useOffline } from "../../offline/OfflineContext";
import { RiskChip } from "../../components/RiskChip";
import { StatusChip } from "../../components/StatusChip";
import { PageLoader } from "../../components/PageLoader";
import { PageHeader } from "../../components/PageHeader";

export function MyJobsPage() {
  const queryClient = useQueryClient();
  const { pending } = useOffline();
  const { data: jobs, isLoading } = useQuery({ queryKey: ["my-jobs"], queryFn: () => fetchJobs() });

  // Warm everything the report form needs while there's signal, so a
  // technician can still open and fill it in a plant room without any.
  // (The service worker keeps these responses for offline use.)
  useEffect(() => {
    if (!jobs) return;
    const assigned = jobs.filter((job) => job.status === "assigned");
    if (assigned.length === 0) return;
    void queryClient.prefetchQuery({ queryKey: ["refrigerant-types"], queryFn: fetchRefrigerantTypes });
    void queryClient.prefetchQuery({ queryKey: ["cylinders"], queryFn: fetchCylinders });
    assigned.forEach((job) => {
      void queryClient.prefetchQuery({ queryKey: ["job", job.id], queryFn: () => fetchJob(job.id) });
      void queryClient.prefetchQuery({ queryKey: ["service-reports", job.id], queryFn: () => fetchServiceReports({ job: job.id }) });
    });
  }, [jobs, queryClient]);

  return (
    <Box>
      <PageHeader title="My Jobs" subtitle="Jobs assigned to you." mb={3} />
      {isLoading && <PageLoader />}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Facility</TableCell>
              <TableCell>Equipment</TableCell>
              <TableCell>Risk</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs?.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{job.facility_name}</TableCell>
                <TableCell>{job.equipment_name}</TableCell>
                <TableCell><RiskChip level={job.risk_level} /></TableCell>
                <TableCell>
                  <StatusChip status={job.status} />
                  {pending.some((item) => item.jobId === job.id) && (
                    <Chip size="small" color="warning" label="Waiting to send" sx={{ ml: 1 }} />
                  )}
                </TableCell>
                <TableCell align="right">
                  {job.status === "assigned" && (
                    <Button size="small" component={RouterLink} to={`/my-jobs/${job.id}/report`}>
                      Submit Report
                    </Button>
                  )}
                  {(job.status === "in_progress" || job.status === "completed") && (
                    <Button size="small" component={RouterLink} to={`/my-jobs/${job.id}/report`}>
                      View Report
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
