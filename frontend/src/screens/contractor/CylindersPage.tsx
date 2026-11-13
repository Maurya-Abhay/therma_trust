import { useState } from "react";
import { useDeepLinkAction } from "../../lib/useDeepLink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem,
  Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import {
  createCylinder, fetchContractors, fetchCylinderHistory, fetchCylinders, fetchRefrigerantTypes,
} from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { RoleHero } from "../../components/RoleHero";
import type { RefrigerantCylinder } from "../../types";

const KIND_LABELS = { supply: "Supply", recovery: "Recovery" } as const;
const TRANSACTION_LABELS = { initial_fill: "Initial fill", draw: "Drawn for job", recovery: "Recovered from job" } as const;

const EMPTY_FORM = { serial_number: "", refrigerant_type: 0, kind: "supply", capacity_kg: "", current_kg: "0" };

export function CylindersPage() {
  const queryClient = useQueryClient();
  const { data: companies } = useQuery({ queryKey: ["contractors"], queryFn: fetchContractors });
  const company = companies?.[0];
  const { data: cylinders } = useQuery({ queryKey: ["cylinders"], queryFn: fetchCylinders });
  const { data: refrigerants } = useQuery({ queryKey: ["refrigerant-types"], queryFn: fetchRefrigerantTypes });

  const [open, setOpen] = useState(false);
  useDeepLinkAction(() => setOpen(true), !!company);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selected, setSelected] = useState<RefrigerantCylinder | null>(null);

  const { data: history } = useQuery({
    queryKey: ["cylinder-history", selected?.id],
    queryFn: () => fetchCylinderHistory(selected!.id),
    enabled: !!selected,
  });

  const createMutation = useMutation({
    meta: { success: "Cylinder registered" },
    mutationFn: () => createCylinder({ ...form, company: company!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cylinders"] });
      setOpen(false);
      setForm(EMPTY_FORM);
    },
  });

  if (!company) {
    return <Typography>Register your company first on the Company page.</Typography>;
  }

  const totalHeld = (cylinders ?? []).reduce((sum, c) => sum + Number(c.current_kg), 0);

  return (
    <Box>
      <RoleHero
        role="contractor_manager"
        title="Refrigerant Cylinders"
        subtitle="Every kilogram in and out of your cylinders, tied to the job it was used on."
        stats={[
          { label: "Cylinders", value: cylinders?.length ?? 0 },
          { label: "Refrigerant on hand (kg)", value: totalHeld.toFixed(2) },
        ]}
        action={
          <Button variant="contained" onClick={() => setOpen(true)}>
            Register Cylinder
          </Button>
        }
      />

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Serial</TableCell>
              <TableCell>Refrigerant</TableCell>
              <TableCell>Type</TableCell>
              <TableCell sx={{ minWidth: 200 }}>Fill level</TableCell>
              <TableCell align="right">History</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cylinders?.map((c) => {
              const percent = Math.min(100, (Number(c.current_kg) / Number(c.capacity_kg)) * 100);
              return (
                <TableRow key={c.id}>
                  <TableCell>{c.serial_number}</TableCell>
                  <TableCell>{c.refrigerant_type_code}</TableCell>
                  <TableCell>
                    <Chip size="small" label={KIND_LABELS[c.kind]} color={c.kind === "supply" ? "primary" : "default"} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{c.current_kg} / {c.capacity_kg} kg</Typography>
                    <LinearProgress variant="determinate" value={percent} sx={{ height: 6, borderRadius: 3 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setSelected(c)}>View ledger</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {cylinders?.length === 0 && (
              <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No cylinders registered yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Register Cylinder</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField label="Serial number" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} required />
          <TextField select label="Refrigerant" value={form.refrigerant_type || ""} onChange={(e) => setForm({ ...form, refrigerant_type: Number(e.target.value) })} required>
            {refrigerants?.map((r) => <MenuItem key={r.id} value={r.id}>{r.code}</MenuItem>)}
          </TextField>
          <TextField
            select label="Cylinder type" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
            helperText="Supply cylinders are drawn from; recovery cylinders only receive recovered gas"
          >
            <MenuItem value="supply">Supply (new refrigerant)</MenuItem>
            <MenuItem value="recovery">Recovery (recovered refrigerant)</MenuItem>
          </TextField>
          <TextField label="Capacity (kg)" type="number" value={form.capacity_kg} onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })} required />
          <TextField label="Current amount (kg)" type="number" value={form.current_kg} onChange={(e) => setForm({ ...form, current_kg: e.target.value })} />
          {createMutation.isError && <Alert severity="error">{getErrorMessage(createMutation.error)}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained" onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.serial_number || !form.refrigerant_type || !form.capacity_kg}
          >
            Register
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle>Ledger — {selected?.serial_number}</DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Event</TableCell>
                <TableCell align="right">Amount (kg)</TableCell>
                <TableCell align="right">Balance (kg)</TableCell>
                <TableCell>Job</TableCell>
                <TableCell>Technician</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                  <TableCell>{TRANSACTION_LABELS[t.kind]}</TableCell>
                  <TableCell align="right">{t.kind === "draw" ? `-${t.amount_kg}` : `+${t.amount_kg}`}</TableCell>
                  <TableCell align="right">{t.balance_after_kg}</TableCell>
                  <TableCell>{t.job ? `#${t.job}` : "—"}</TableCell>
                  <TableCell>{t.technician_name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
