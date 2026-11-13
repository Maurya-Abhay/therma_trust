import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Chip, Link, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { fetchAllCredentials, runCredentialAiCheck, verifyCredential } from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { RoleHero } from "../../components/RoleHero";
import { StatusChip } from "../../components/StatusChip";
import type { Credential } from "../../types";
import { PageLoader } from "../../components/PageLoader";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "document_verified", label: "Document Verified" },
  { value: "issuer_confirmed", label: "Issuer Confirmed" },
  { value: "platform_verified", label: "Platform Verified" },
  { value: "suspended", label: "Suspended" },
  { value: "revoked", label: "Revoked" },
  { value: "rejected", label: "Rejected" },
];

export function CredentialsReviewPage() {
  const queryClient = useQueryClient();
  const { data: credentials, isLoading } = useQuery({ queryKey: ["admin-credentials"], queryFn: fetchAllCredentials });

  const mutation = useMutation({
    meta: { success: "Credential reviewed" },
    mutationFn: ({ id, status }: { id: number; status: string }) => verifyCredential(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-credentials"] }),
  });

  return (
    <Box>
      <RoleHero role="admin" title="Credential Review" subtitle="Move technician credentials through the verification pipeline." />

      {isLoading && <PageLoader />}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Technician</TableCell>
              <TableCell>Credential</TableCell>
              <TableCell>Issuer</TableCell>
              <TableCell>Expiry</TableCell>
              <TableCell>Status</TableCell>
              <TableCell sx={{ minWidth: 260 }}>AI second opinion</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {credentials?.map((c) => (
              <CredentialRow
                key={c.id}
                credential={c}
                onSave={(status) => mutation.mutate({ id: c.id, status })}
                onChecked={() => queryClient.invalidateQueries({ queryKey: ["admin-credentials"] })}
              />
            ))}
            {credentials?.length === 0 && (
              <TableRow><TableCell colSpan={7}><Typography color="text.secondary">No credentials submitted yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

function CredentialRow({
  credential,
  onSave,
  onChecked,
}: {
  credential: Credential;
  onSave: (status: string) => void;
  onChecked: () => void;
}) {
  const check = useMutation({ mutationFn: () => runCredentialAiCheck(credential.id), onSuccess: onChecked });
  const result = credential.ai_check;

  return (
    <TableRow>
      <TableCell>{credential.technician_name}</TableCell>
      <TableCell>
        {credential.name}
        {credential.file && (
          <Typography variant="caption" display="block">
            <Link href={credential.file} target="_blank" rel="noopener noreferrer">View document</Link>
          </Typography>
        )}
      </TableCell>
      <TableCell>{credential.issuer_name}</TableCell>
      <TableCell>{credential.expiry_date ?? "—"}</TableCell>
      <TableCell><StatusChip status={credential.status} /></TableCell>
      <TableCell>
        <Button size="small" variant="outlined" onClick={() => check.mutate()} disabled={check.isPending}>
          {check.isPending ? "Reading…" : result ? "Re-run AI check" : "Run AI check"}
        </Button>
        {check.isError && (
          <Typography variant="caption" color="error" display="block" mt={0.5}>{getErrorMessage(check.error)}</Typography>
        )}
        {result && (
          <Stack spacing={0.5} mt={1}>
            {result.flags.length === 0 ? (
              <Chip size="small" color="success" label="Matches the entered details" sx={{ alignSelf: "flex-start" }} />
            ) : (
              result.flags.map((flag) => (
                <Typography
                  key={flag.code}
                  variant="caption"
                  color={flag.severity === "warning" ? "warning.dark" : "text.secondary"}
                >
                  {flag.severity === "warning" ? "⚠ " : "ℹ "}{flag.message}
                </Typography>
              ))
            )}
            <Typography variant="caption" color="text.secondary">
              Checked {new Date(result.checked_at).toLocaleString()} — a second opinion, not a verdict.
            </Typography>
          </Stack>
        )}
      </TableCell>
      <TableCell align="right">
        <Select
          size="small"
          defaultValue=""
          displayEmpty
          sx={{ minWidth: 180 }}
          onChange={(e) => {
            if (e.target.value) onSave(e.target.value);
          }}
        >
          <MenuItem value="" disabled>Set status…</MenuItem>
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </TableCell>
    </TableRow>
  );
}
