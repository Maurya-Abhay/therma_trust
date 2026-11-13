import { useMutation, useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { fetchAdminDashboard, verifyAuditLog } from "../../api/endpoints";
import { RoleHero } from "../../components/RoleHero";
import { PageLoader } from "../../components/PageLoader";
import { StatCard } from "../../components/StatCard";
import { Stagger, StaggerItem } from "../../components/motion";
import type { ElementType } from "react";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import GppGoodRoundedIcon from "@mui/icons-material/GppGoodRounded";

function PendingCard({ label, value, to, icon }: { label: string; value: number; to: string; icon: ElementType }) {
  return (
    <Box component={RouterLink} to={to} sx={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
      <StatCard label={label} value={value} icon={icon} tone={value > 0 ? "#F59E0B" : "#64748B"} hint={value > 0 ? "Needs review" : "All clear"} />
    </Box>
  );
}

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: fetchAdminDashboard });
  const verifyMutation = useMutation({ mutationFn: verifyAuditLog });

  const totalPending =
    (data?.pending_credentials ?? 0) +
    (data?.pending_capabilities ?? 0) +
    (data?.pending_contractor_documents ?? 0) +
    (data?.pending_contractor_verifications ?? 0);

  return (
    <Box>
      <RoleHero
        role="admin"
        title="Admin Dashboard"
        subtitle={
          totalPending > 0
            ? `${totalPending} item${totalPending === 1 ? "" : "s"} waiting across the platform.`
            : "Nothing waiting on review right now."
        }
        stats={
          data
            ? [
                { label: "Technicians", value: data.total_technicians },
                { label: "Facilities", value: data.total_facilities },
                { label: "Jobs", value: data.total_jobs },
              ]
            : undefined
        }
      />

      {isLoading && <PageLoader />}

      {data && (
        <>
          <Stagger inView={false} gap={0.09} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 32 }}>
            <StaggerItem style={{ height: "100%" }}><PendingCard label="Pending Credentials" value={data.pending_credentials} to="/admin/credentials" icon={VerifiedUserRoundedIcon} /></StaggerItem>
            <StaggerItem style={{ height: "100%" }}><PendingCard label="Pending Capabilities" value={data.pending_capabilities} to="/admin/capabilities" icon={ConstructionRoundedIcon} /></StaggerItem>
            <StaggerItem style={{ height: "100%" }}><PendingCard label="Contractor Documents" value={data.pending_contractor_documents} to="/admin/contractor-documents" icon={DescriptionRoundedIcon} /></StaggerItem>
            <StaggerItem style={{ height: "100%" }}><PendingCard label="Contractor Verification" value={data.pending_contractor_verifications} to="/admin/contractor-verifications" icon={GppGoodRoundedIcon} /></StaggerItem>
          </Stagger>

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">Recent Activity (Audit Log)</Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? "Checking…" : "Verify integrity"}
            </Button>
          </Box>

          {verifyMutation.data && (
            <Alert severity={verifyMutation.data.valid ? "success" : "error"} sx={{ mb: 2 }}>
              {verifyMutation.data.valid
                ? `Chain intact — all ${verifyMutation.data.checked_count} entries verified, no tampering detected.`
                : `Chain broken at entry #${verifyMutation.data.broken_at_id} — this entry or one before it was altered outside the app.`}
            </Alert>
          )}

          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Actor</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Object</TableCell>
                  <TableCell>When</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.recent_audit_log.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.actor ?? "system"}</TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>{entry.object_type} #{entry.object_id}</TableCell>
                    <TableCell>{new Date(entry.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {data.recent_audit_log.length === 0 && (
                  <TableRow><TableCell colSpan={4}><Typography color="text.secondary">No activity yet.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
