import { useState } from "react";
import { useDeepLinkAction } from "../../lib/useDeepLink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField } from "@mui/material";
import { createCredential, extractCredential, fetchCredentials, fetchMyTechnicianProfile } from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { StatusChip } from "../../components/StatusChip";
import { PageHeader } from "../../components/PageHeader";

export function CredentialsPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["my-technician-profile"], queryFn: fetchMyTechnicianProfile });
  const { data: credentials } = useQuery({
    queryKey: ["credentials", profile?.id],
    queryFn: () => fetchCredentials(profile!.id),
    enabled: !!profile,
  });

  const [open, setOpen] = useState(false);
  useDeepLinkAction(() => setOpen(true));
  const [form, setForm] = useState({ name: "", issuer_name: "", credential_number: "", issue_date: "", expiry_date: "" });
  const [file, setFile] = useState<File | null>(null);

  const [scanNote, setScanNote] = useState<{ severity: "info" | "warning"; text: string } | null>(null);

  const scanMutation = useMutation({
    mutationFn: () => extractCredential(file!),
    onSuccess: (read) => {
      if (!read.is_credential_document) {
        setScanNote({ severity: "warning", text: "This file doesn't look like a credential document." });
        return;
      }
      const isoDate = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
      // Only fill blanks - never overwrite something the technician already typed.
      setForm((f) => ({
        name: f.name || read.credential_name || "",
        issuer_name: f.issuer_name || read.issuer_name || "",
        credential_number: f.credential_number || read.credential_number || "",
        issue_date: f.issue_date || isoDate(read.issue_date),
        expiry_date: f.expiry_date || isoDate(read.expiry_date),
      }));
      setScanNote({
        severity: "info",
        text: `Filled in what could be read. Please check every field before uploading.${read.notes ? ` Note: ${read.notes}` : ""}`,
      });
    },
    onError: () => setScanNote(null),
  });

  const mutation = useMutation({
    meta: { success: "Credential uploaded for review" },
    mutationFn: () => {
      const data = new FormData();
      data.append("technician", String(profile!.id));
      data.append("name", form.name);
      data.append("issuer_name", form.issuer_name);
      data.append("credential_number", form.credential_number);
      if (form.issue_date) data.append("issue_date", form.issue_date);
      if (form.expiry_date) data.append("expiry_date", form.expiry_date);
      if (file) data.append("file", file);
      return createCredential(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials", profile?.id] });
      setOpen(false);
      setForm({ name: "", issuer_name: "", credential_number: "", issue_date: "", expiry_date: "" });
      setFile(null);
      setScanNote(null);
    },
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <PageHeader title="Credentials" subtitle="Upload certificates for review and keep them current." mb={0} />
        <Button variant="contained" onClick={() => setOpen(true)}>Upload Credential</Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Issuer</TableCell>
              <TableCell>Expiry</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {credentials?.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.issuer_name}</TableCell>
                <TableCell>{c.expiry_date ?? "-"}</TableCell>
                <TableCell><StatusChip status={c.effective_status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Upload Credential</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField label="Credential Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <TextField label="Issuer" value={form.issuer_name} onChange={(e) => setForm({ ...form, issuer_name: e.target.value })} required />
          <TextField label="Credential Number" value={form.credential_number} onChange={(e) => setForm({ ...form, credential_number: e.target.value })} />
          <TextField label="Issue Date" type="date" slotProps={{ inputLabel: { shrink: true } }} value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
          <TextField label="Expiry Date" type="date" slotProps={{ inputLabel: { shrink: true } }} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          <Button component="label">
            {file ? file.name : "Choose File"}
            <input
              type="file" hidden accept="application/pdf,image/*"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setScanNote(null); scanMutation.reset(); }}
            />
          </Button>
          {file && (
            <Button variant="outlined" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
              {scanMutation.isPending ? "Reading document…" : "Scan with AI to fill the form"}
            </Button>
          )}
          {scanNote && <Alert severity={scanNote.severity}>{scanNote.text}</Alert>}
          {scanMutation.isError && <Alert severity="warning">{getErrorMessage(scanMutation.error)} You can still fill the form in by hand.</Alert>}
          {mutation.isError && <Alert severity="error">{getErrorMessage(mutation.error)}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name || !file}>
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
