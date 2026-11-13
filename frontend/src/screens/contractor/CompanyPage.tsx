import { useState } from "react";
import { useDeepLinkAction } from "../../lib/useDeepLink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import {
  createContractor, fetchContractorCompliance, fetchContractorDocuments, fetchContractors, uploadContractorDocument,
} from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { StatusChip } from "../../components/StatusChip";
import { RoleHero } from "../../components/RoleHero";
import { OnboardingCard } from "../../components/OnboardingCard";

const DOC_TYPES = [
  { value: "business_registration", label: "Business Registration" },
  { value: "insurance", label: "Insurance" },
  { value: "safety_policy", label: "Safety Policy" },
  { value: "other", label: "Other" },
];

import { humanise } from "../../lib/labels";

export function CompanyPage() {
  const queryClient = useQueryClient();
  const { data: companies } = useQuery({ queryKey: ["contractors"], queryFn: fetchContractors });
  const company = companies?.[0];

  const [createForm, setCreateForm] = useState({ name: "", registration_number: "", service_area: "", response_time_commitment: "" });
  const createMutation = useMutation({
    meta: { success: "Company registered" },
    mutationFn: () => createContractor(createForm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contractors"] }),
  });

  const { data: documents } = useQuery({
    queryKey: ["contractor-documents", company?.id],
    queryFn: () => fetchContractorDocuments(company!.id),
    enabled: !!company,
  });

  const { data: compliance } = useQuery({
    queryKey: ["contractor-compliance", company?.id],
    queryFn: () => fetchContractorCompliance(company!.id),
    enabled: !!company,
  });

  const [docOpen, setDocOpen] = useState(false);
  useDeepLinkAction(() => setDocOpen(true), !!company);
  const [docType, setDocType] = useState("business_registration");
  const [file, setFile] = useState<File | null>(null);
  const uploadMutation = useMutation({
    meta: { success: "Document uploaded" },
    mutationFn: () => uploadContractorDocument(company!.id, docType, file!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-documents", company?.id] });
      setDocOpen(false);
      setFile(null);
    },
  });

  if (!company) {
    return (
      <Box maxWidth={500}>
        <Typography variant="h4" mb={3}>Register Your Company</Typography>
        <Paper sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField label="Company Name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          <TextField label="Registration Number" value={createForm.registration_number} onChange={(e) => setCreateForm({ ...createForm, registration_number: e.target.value })} />
          <TextField label="Service Area (city/zone)" value={createForm.service_area} onChange={(e) => setCreateForm({ ...createForm, service_area: e.target.value })} required />
          <TextField label="Response Time Commitment" value={createForm.response_time_commitment} onChange={(e) => setCreateForm({ ...createForm, response_time_commitment: e.target.value })} placeholder="e.g. 4 hours" />
          <Button variant="contained" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !createForm.name}>
            Register Company
          </Button>
          {createMutation.isError && <Alert severity="error">{getErrorMessage(createMutation.error)}</Alert>}
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <RoleHero
        role="contractor_manager"
        title={company.name}
        subtitle={company.service_area}
        stats={
          compliance
            ? [
                { label: "Compliance score", value: `${compliance.score} / 100` },
                { label: "Technicians on roster", value: compliance.technician_count },
                { label: "Capabilities verified", value: `${compliance.capability_verified_rate}%` },
              ]
            : undefined
        }
        action={<StatusChip status={company.verification_status} />}
      />
      <OnboardingCard />


      {company.verification_status !== "verified" && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Your company is pending verification. An admin reviews uploaded documents before marking it verified.
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Documents</Typography>
        <Button variant="contained" onClick={() => setDocOpen(true)}>Upload Document</Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Uploaded</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents?.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{humanise(d.doc_type)}</TableCell>
                <TableCell><StatusChip status={d.status} /></TableCell>
                <TableCell>{new Date(d.uploaded_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={docOpen} onClose={() => setDocOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField select label="Document Type" value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>
          <Button component="label">
            {file ? file.name : "Choose File"}
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Button>
          {uploadMutation.isError && <Alert severity="error">{getErrorMessage(uploadMutation.error)}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending || !file}>
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
