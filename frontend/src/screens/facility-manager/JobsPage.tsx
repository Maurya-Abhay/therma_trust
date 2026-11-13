import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Paper, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import { fetchJobs } from "../../api/endpoints";
import { EmptyState } from "../../components/EmptyState";
import { RiskChip } from "../../components/RiskChip";
import { StatusChip } from "../../components/StatusChip";
import { PageLoader } from "../../components/PageLoader";
import { PageHeader } from "../../components/PageHeader";

export function JobsPage() {
  const { data: jobs, isLoading } = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });

  return (
    <Box>
      <PageHeader
        title="Job Requests"
        subtitle="Everything you have raised, with its risk and status."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} component={RouterLink} to="/jobs/new">
            New Job Request
          </Button>
        }
      />

      {isLoading && <PageLoader />}

      {!isLoading && jobs?.length === 0 && (
        <Paper>
          <EmptyState
            icon={WorkRoundedIcon}
            title="No job requests yet"
            body="Raise one when a unit needs attention. The platform rates the risk and ranks qualified technicians."
            action={
              <Button variant="contained" startIcon={<AddRoundedIcon />} component={RouterLink} to="/jobs/new">
                New Job Request
              </Button>
            }
          />
        </Paper>
      )}

      {!!jobs?.length && (
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Facility</TableCell>
              <TableCell>Equipment</TableCell>
              <TableCell>Risk</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs?.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{job.facility_name}</TableCell>
                <TableCell>{job.equipment_name}</TableCell>
                <TableCell><RiskChip level={job.risk_level} /></TableCell>
                <TableCell><StatusChip status={job.status} /></TableCell>
                <TableCell>{job.assignment?.technician_name ?? "-"}</TableCell>
                <TableCell align="right">
                  <Button size="small" component={RouterLink} to={`/jobs/${job.id}`}>View</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      )}
    </Box>
  );
}
