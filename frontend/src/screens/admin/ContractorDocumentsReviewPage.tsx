import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { fetchAllContractorDocuments, verifyContractorDocument } from "../../api/endpoints";
import { RoleHero } from "../../components/RoleHero";
import { StatusChip } from "../../components/StatusChip";
import { PageLoader } from "../../components/PageLoader";

import { humanise } from "../../lib/labels";

export function ContractorDocumentsReviewPage() {
  const queryClient = useQueryClient();
  const { data: documents, isLoading } = useQuery({ queryKey: ["admin-contractor-documents"], queryFn: fetchAllContractorDocuments });

  const mutation = useMutation({
    meta: { success: "Document reviewed" },
    mutationFn: ({ id, status }: { id: number; status: string }) => verifyContractorDocument(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-contractor-documents"] }),
  });

  return (
    <Box>
      <RoleHero role="admin" title="Contractor Document Review" subtitle="Verify or reject uploaded business documents." />

      {isLoading && <PageLoader />}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Company</TableCell>
              <TableCell>Document Type</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents?.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.company_name}</TableCell>
                <TableCell>{humanise(d.doc_type)}</TableCell>
                <TableCell>{new Date(d.uploaded_at).toLocaleDateString()}</TableCell>
                <TableCell><StatusChip status={d.status} /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="contained" color="success" onClick={() => mutation.mutate({ id: d.id, status: "verified" })}>
                      Verify
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => mutation.mutate({ id: d.id, status: "rejected" })}>
                      Reject
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {documents?.length === 0 && (
              <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No documents uploaded yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
