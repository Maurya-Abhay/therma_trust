import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { fetchCapabilities, fetchContractorTechnicians, fetchContractors, verifyCapability } from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { StatusChip } from "../../components/StatusChip";
import type { CapabilitySkill } from "../../types";
import { PageHeader } from "../../components/PageHeader";

interface Row extends CapabilitySkill {
  technician_name: string;
}

import { useLabels } from "../../lib/labels";

export function TeamCapabilitiesPage() {
  const labels = useLabels();
  const queryClient = useQueryClient();
  const { data: companies } = useQuery({ queryKey: ["contractors"], queryFn: fetchContractors });
  const company = companies?.[0];

  const { data: roster } = useQuery({
    queryKey: ["contractor-technicians", company?.id],
    queryFn: () => fetchContractorTechnicians(company!.id),
    enabled: !!company,
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["team-capabilities", company?.id, roster?.map((t) => t.id)],
    queryFn: async (): Promise<Row[]> => {
      const perTechnician = await Promise.all(
        roster!.map(async (t) => {
          const capabilities = await fetchCapabilities(t.id);
          return capabilities.map((c) => ({ ...c, technician_name: t.full_name }));
        })
      );
      return perTechnician.flat();
    },
    enabled: !!roster && roster.length > 0,
  });

  const verifyMutation = useMutation({
    meta: { success: "Capability updated" },
    mutationFn: ({ id, status }: { id: number; status: string }) => verifyCapability(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-capabilities", company?.id] }),
  });

  if (!company) {
    return <Typography>Register your company first on the Company page.</Typography>;
  }

  const pendingCount = rows?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <Box>
      <PageHeader title="Team Capabilities" subtitle="Verify what your technicians say they can do." mb={3} />
      <Typography variant="body2" color="text.secondary" mb={3}>
        {pendingCount > 0
          ? `${pendingCount} capability declaration${pendingCount === 1 ? "" : "s"} waiting on your review.`
          : "Nothing waiting on review right now."}
      </Typography>

      {verifyMutation.isError && <Alert severity="error" sx={{ mb: 2 }}>{getErrorMessage(verifyMutation.error)}</Alert>}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Technician</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Capability</TableCell>
              <TableCell>Evidence</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.technician_name}</TableCell>
                <TableCell>{labels.capabilityType(r.capability_type)}</TableCell>
                <TableCell>{r.label}</TableCell>
                <TableCell>{labels.evidenceType(r.evidence_type)}</TableCell>
                <TableCell><StatusChip status={r.status} /></TableCell>
                <TableCell align="right">
                  {r.status === "pending" && (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small" variant="contained"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate({ id: r.id, status: "verified" })}
                      >
                        Verify
                      </Button>
                      <Button
                        size="small" color="error"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate({ id: r.id, status: "not_qualified" })}
                      >
                        Reject
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && rows?.length === 0 && (
              <TableRow><TableCell colSpan={6}><Typography color="text.secondary">No capabilities declared by your roster yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
