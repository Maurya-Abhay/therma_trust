import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { fetchAllCapabilities, verifyCapability } from "../../api/endpoints";
import { RoleHero } from "../../components/RoleHero";
import { StatusChip } from "../../components/StatusChip";
import { PageLoader } from "../../components/PageLoader";

import { useLabels } from "../../lib/labels";

export function CapabilitiesReviewPage() {
  const labels = useLabels();
  const queryClient = useQueryClient();
  const { data: capabilities, isLoading } = useQuery({ queryKey: ["admin-capabilities"], queryFn: fetchAllCapabilities });

  const mutation = useMutation({
    meta: { success: "Capability updated" },
    mutationFn: ({ id, status }: { id: number; status: string }) => verifyCapability(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-capabilities"] }),
  });

  return (
    <Box>
      <RoleHero role="admin" title="Capability Review" subtitle="Verify or reject declared equipment, refrigerant, and safety capabilities." />

      {isLoading && <PageLoader />}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Technician</TableCell>
              <TableCell>Capability</TableCell>
              <TableCell>Evidence</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {capabilities?.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.technician_name}</TableCell>
                <TableCell>{c.label}</TableCell>
                <TableCell>{labels.evidenceType(c.evidence_type)}</TableCell>
                <TableCell><StatusChip status={c.status} /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="contained" color="success" onClick={() => mutation.mutate({ id: c.id, status: "verified" })}>
                      Verify
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => mutation.mutate({ id: c.id, status: "not_qualified" })}>
                      Not Qualified
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {capabilities?.length === 0 && (
              <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No capabilities declared yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
