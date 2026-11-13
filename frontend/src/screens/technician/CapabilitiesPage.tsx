import { useState } from "react";
import { useDeepLinkAction } from "../../lib/useDeepLink";
import { useLabels } from "../../lib/labels";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Table,
  TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { createCapability, fetchCapabilities, fetchChoices, fetchMyTechnicianProfile, fetchRefrigerantTypes } from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { StatusChip } from "../../components/StatusChip";
import { PageHeader } from "../../components/PageHeader";

export function CapabilitiesPage() {
  const labels = useLabels();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["my-technician-profile"], queryFn: fetchMyTechnicianProfile });
  const { data: capabilities } = useQuery({
    queryKey: ["capabilities", profile?.id],
    queryFn: () => fetchCapabilities(profile!.id),
    enabled: !!profile,
  });
  const { data: choices } = useQuery({ queryKey: ["choices"], queryFn: fetchChoices });
  const { data: refrigerants } = useQuery({ queryKey: ["refrigerant-types"], queryFn: fetchRefrigerantTypes });

  const [open, setOpen] = useState(false);
  useDeepLinkAction(() => setOpen(true));
  const [capabilityType, setCapabilityType] = useState<"equipment" | "refrigerant" | "safety">("equipment");
  const [key, setKey] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    meta: { success: "Capability saved" },
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        technician: profile!.id,
        capability_type: capabilityType,
        note,
        evidence_type: "none",
      };
      if (capabilityType === "equipment") payload.equipment_category = key;
      if (capabilityType === "refrigerant") payload.refrigerant_type = Number(key);
      if (capabilityType === "safety") payload.safety_domain = key;
      return createCapability(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capabilities", profile?.id] });
      setOpen(false);
      setKey("");
      setNote("");
    },
  });

  const keyOptions =
    capabilityType === "equipment" ? choices?.equipment_categories ?? []
    : capabilityType === "safety" ? choices?.safety_domains ?? []
    : (refrigerants ?? []).map((r) => ({ value: String(r.id), label: r.code }));

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <PageHeader title="Capability Matrix" subtitle="Declare what you can work on and track its verification." mb={0} />
        <Button variant="contained" onClick={() => setOpen(true)}>Declare Capability</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Declaring a capability marks it Pending until a contractor manager or admin verifies it.
      </Typography>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Capability</TableCell>
              <TableCell>Evidence</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {capabilities?.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{labels.capabilityType(c.capability_type)}</TableCell>
                <TableCell>{c.label}</TableCell>
                <TableCell>{labels.evidenceType(c.evidence_type)}</TableCell>
                <TableCell><StatusChip status={c.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Declare Capability</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            select label="Type" value={capabilityType}
            onChange={(e) => { setCapabilityType(e.target.value as typeof capabilityType); setKey(""); }}
          >
            <MenuItem value="equipment">Equipment</MenuItem>
            <MenuItem value="refrigerant">Refrigerant</MenuItem>
            <MenuItem value="safety">Safety Domain</MenuItem>
          </TextField>
          <TextField select label="Capability" value={key} onChange={(e) => setKey(e.target.value)} required>
            {keyOptions.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
          </TextField>
          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          {mutation.isError && <Alert severity="error">{getErrorMessage(mutation.error)}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !key}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
