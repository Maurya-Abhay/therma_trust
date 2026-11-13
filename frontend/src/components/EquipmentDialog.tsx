import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField,
} from "@mui/material";
import { createEquipment, fetchChoices, fetchRefrigerantTypes } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import type { Facility } from "../types";

const EMPTY = { facility: 0, name: "", category: "", refrigerant_type: 0, capacity: "", refrigerant_charge_kg: "", criticality: "medium" };

interface EquipmentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fixed when opened from one facility's page; otherwise the person picks from `facilities`. */
  facilityId?: number;
  facilities?: Facility[];
}

/** The Add Equipment form, shared by the Equipment section and each facility's page. */
export function EquipmentDialog({ open, onClose, facilityId, facilities = [] }: EquipmentDialogProps) {
  const queryClient = useQueryClient();
  const { data: choices } = useQuery({ queryKey: ["choices"], queryFn: fetchChoices });
  const { data: refrigerants } = useQuery({ queryKey: ["refrigerant-types"], queryFn: fetchRefrigerantTypes });
  const [form, setForm] = useState(EMPTY);

  const targetFacility = facilityId ?? (form.facility || (facilities.length === 1 ? facilities[0].id : 0));

  const mutation = useMutation({
    meta: { success: "Equipment added" },
    mutationFn: () =>
      createEquipment({
        name: form.name,
        category: form.category,
        refrigerant_type: form.refrigerant_type,
        capacity: form.capacity,
        criticality: form.criticality,
        facility: targetFacility,
        refrigerant_charge_kg: form.refrigerant_charge_kg || null,
      }),
    onSuccess: () => {
      // The ["equipment"] prefix covers one facility's list and the all-equipment list; facilities show a count.
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      setForm(EMPTY);
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Equipment</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
        {facilityId === undefined && (
          <TextField
            select label="Facility" value={targetFacility || ""} required
            onChange={(e) => setForm({ ...form, facility: Number(e.target.value) })}
          >
            {facilities.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
          </TextField>
        )}
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <TextField select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
          {choices?.equipment_categories.map((c) => (
            <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select label="Refrigerant" value={form.refrigerant_type || ""}
          onChange={(e) => setForm({ ...form, refrigerant_type: Number(e.target.value) })} required
        >
          {refrigerants?.map((r) => (
            <MenuItem key={r.id} value={r.id}>{r.code} (GWP {r.gwp})</MenuItem>
          ))}
        </TextField>
        <TextField label="Capacity (e.g. 50 TR)" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        <TextField
          label="Refrigerant Charge (kg)"
          type="number"
          value={form.refrigerant_charge_kg}
          onChange={(e) => setForm({ ...form, refrigerant_charge_kg: e.target.value })}
          helperText="Full system charge, used to calculate the EPA-style leak rate from service history (up to 2 decimals)"
        />
        <TextField select label="Criticality" value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
          {choices?.criticalities.map((c) => (
            <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
          ))}
        </TextField>
        {mutation.isError && <Alert severity="error">{getErrorMessage(mutation.error)}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !targetFacility || !form.name.trim() || !form.category || !form.refrigerant_type}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
