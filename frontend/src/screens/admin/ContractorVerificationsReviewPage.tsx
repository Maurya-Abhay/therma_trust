import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { fetchContractors, verifyContractorCompany } from "../../api/endpoints";
import { RoleHero } from "../../components/RoleHero";
import { StatusChip } from "../../components/StatusChip";
import { PageLoader } from "../../components/PageLoader";

export function ContractorVerificationsReviewPage() {
  const queryClient = useQueryClient();
  const { data: contractors, isLoading } = useQuery({ queryKey: ["admin-contractors"], queryFn: fetchContractors });

  const mutation = useMutation({
    meta: { success: "Company status updated" },
    mutationFn: ({ id, status }: { id: number; status: string }) => verifyContractorCompany(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-contractors"] }),
  });

  return (
    <Box>
      <RoleHero role="admin" title="Contractor Verification" subtitle="Verify or suspend contractor companies on the platform." />

      {isLoading && <PageLoader />}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Company</TableCell>
              <TableCell>Service Area</TableCell>
              <TableCell>Technicians</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contractors?.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.service_area}</TableCell>
                <TableCell>{c.technician_count}</TableCell>
                <TableCell><StatusChip status={c.verification_status} /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="contained" color="success" onClick={() => mutation.mutate({ id: c.id, status: "verified" })}>
                      Verify
                    </Button>
                    <Button size="small" variant="outlined" color="warning" onClick={() => mutation.mutate({ id: c.id, status: "suspended" })}>
                      Suspend
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {contractors?.length === 0 && (
              <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No contractor companies registered yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
