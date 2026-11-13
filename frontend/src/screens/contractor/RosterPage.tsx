import { useState } from "react";
import { focusForm, useDeepLinkAction } from "../../lib/useDeepLink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from "@mui/material";
import {
  addTechnicianToContractor, fetchContractorTechnicians, fetchContractors, fetchTechnicians, removeTechnicianFromContractor,
} from "../../api/endpoints";
import { getErrorMessage } from "../../api/errors";
import { PageHeader } from "../../components/PageHeader";

export function RosterPage() {
  const queryClient = useQueryClient();
  const { data: companies } = useQuery({ queryKey: ["contractors"], queryFn: fetchContractors });
  const company = companies?.[0];

  const { data: roster } = useQuery({
    queryKey: ["contractor-technicians", company?.id],
    queryFn: () => fetchContractorTechnicians(company!.id),
    enabled: !!company,
  });

  const { data: allTechnicians } = useQuery({ queryKey: ["technicians"], queryFn: () => fetchTechnicians() });
  const availableToAdd = allTechnicians?.filter((t) => t.contractor !== company?.id) ?? [];
  const [selectedTechnician, setSelectedTechnician] = useState<number>(0);
  useDeepLinkAction(() => focusForm("roster-add"), !!company);

  const addMutation = useMutation({
    meta: { success: "Technician added to the roster" },
    mutationFn: () => addTechnicianToContractor(company!.id, selectedTechnician),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-technicians", company?.id] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      setSelectedTechnician(0);
    },
  });

  const removeMutation = useMutation({
    meta: { success: "Technician removed from the roster" },
    mutationFn: (technicianId: number) => removeTechnicianFromContractor(company!.id, technicianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-technicians", company?.id] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
    },
  });

  if (!company) {
    return <Typography>Register your company first on the Company page.</Typography>;
  }

  return (
    <Box>
      <PageHeader title="Technician Roster" subtitle="Everyone working under your company, and who you can add." mb={3} />

      <Stack id="roster-add" direction={{ xs: "column", sm: "row" }} spacing={2} mb={3} alignItems={{ xs: "stretch", sm: "center" }}>
        <TextField
          select label="Add technician" sx={{ minWidth: { sm: 280 } }} value={selectedTechnician || ""}
          onChange={(e) => setSelectedTechnician(Number(e.target.value))}
        >
          {availableToAdd.map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.full_name} ({t.email})</MenuItem>
          ))}
        </TextField>
        <Button variant="contained" disabled={!selectedTechnician || addMutation.isPending} onClick={() => addMutation.mutate()}>
          Add to Roster
        </Button>
      </Stack>
      {addMutation.isError && <Alert severity="error" sx={{ mb: 2 }}>{getErrorMessage(addMutation.error)}</Alert>}
      {removeMutation.isError && <Alert severity="error" sx={{ mb: 2 }}>{getErrorMessage(removeMutation.error)}</Alert>}

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Experience</TableCell>
              <TableCell>Available</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roster?.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.full_name}</TableCell>
                <TableCell>{t.email}</TableCell>
                <TableCell>{t.years_experience} yrs</TableCell>
                <TableCell>
                  <Chip size="small" label={t.available ? "Available" : "Unavailable"} color={t.available ? "success" : "default"} />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" color="error" onClick={() => removeMutation.mutate(t.id)}>Remove</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
