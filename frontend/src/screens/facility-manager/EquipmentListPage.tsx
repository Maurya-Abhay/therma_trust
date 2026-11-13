import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Box, Button, Chip, InputAdornment, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AcUnitRoundedIcon from "@mui/icons-material/AcUnitRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { fetchAllEquipment, fetchFacilities } from "../../api/endpoints";
import { DriftWarningBadge } from "../../components/DriftWarningBadge";
import { EmptyState } from "../../components/EmptyState";
import { EquipmentDialog } from "../../components/EquipmentDialog";
import { PageHeader } from "../../components/PageHeader";
import { PageLoader } from "../../components/PageLoader";
import { useDeepLinkAction } from "../../lib/useDeepLink";
import { useLabels } from "../../lib/labels";

/** Every unit across all facilities, with its own Add Equipment button and a shortcut to request a job. */
export function EquipmentListPage() {
  const labels = useLabels();
  const { data: facilities, isLoading: loadingFacilities } = useQuery({ queryKey: ["facilities"], queryFn: fetchFacilities });
  const { data: equipment, isLoading } = useQuery({ queryKey: ["equipment", "all"], queryFn: fetchAllEquipment });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [facilityFilter, setFacilityFilter] = useState(0);
  // The get-started checklist links here with ?add=1; wait for facilities so the form has something to pick.
  useDeepLinkAction(() => setOpen(true), !loadingFacilities && (facilities?.length ?? 0) > 0);

  const facilityName = useMemo(() => new Map((facilities ?? []).map((f) => [f.id, f.name])), [facilities]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (equipment ?? []).filter(
      (eq) =>
        (!facilityFilter || eq.facility === facilityFilter) &&
        (!q || `${eq.name} ${eq.category_display} ${eq.refrigerant_type_code}`.toLowerCase().includes(q))
    );
  }, [equipment, search, facilityFilter]);

  if (isLoading || loadingFacilities) return <PageLoader />;

  const noFacilities = (facilities?.length ?? 0) === 0;

  return (
    <Box>
      <PageHeader
        title="Equipment"
        subtitle="Every unit across your facilities. Add equipment here, or open one to see its leak rate and history."
        action={
          !noFacilities && (
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setOpen(true)}>
              Add Equipment
            </Button>
          )
        }
      />

      {noFacilities ? (
        <Paper>
          <EmptyState
            icon={AcUnitRoundedIcon}
            title="Add a facility first"
            body="Equipment belongs to a facility, so create one before registering units."
            action={<Button variant="contained" component={RouterLink} to="/facilities?add=1">Add Facility</Button>}
          />
        </Paper>
      ) : (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
            <TextField
              size="small" placeholder="Search by name, type or refrigerant" value={search}
              onChange={(e) => setSearch(e.target.value)} sx={{ flexGrow: 1, maxWidth: { sm: 360 } }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
            />
            {(facilities?.length ?? 0) > 1 && (
              <TextField
                select size="small" label="Facility" value={facilityFilter}
                onChange={(e) => setFacilityFilter(Number(e.target.value))} sx={{ minWidth: 220 }}
              >
                <MenuItem value={0}>All facilities</MenuItem>
                {facilities!.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
              </TextField>
            )}
          </Stack>

          <Paper>
            {rows.length === 0 ? (
              <EmptyState
                icon={AcUnitRoundedIcon}
                title={(equipment?.length ?? 0) === 0 ? "No equipment yet" : "Nothing matches your search"}
                body={(equipment?.length ?? 0) === 0 ? "Register your first unit to start tracking leak rate and raising jobs." : "Try a different word or facility."}
                action={
                  (equipment?.length ?? 0) === 0 && (
                    <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setOpen(true)}>Add Equipment</Button>
                  )
                }
              />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Facility</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Refrigerant</TableCell>
                    <TableCell align="right">Charge (kg)</TableCell>
                    <TableCell>Criticality</TableCell>
                    <TableCell>Condition</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((eq) => (
                    <TableRow key={eq.id} hover>
                      <TableCell>
                        <Button size="small" component={RouterLink} to={`/equipment/${eq.id}`} sx={{ fontWeight: 700 }}>{eq.name}</Button>
                      </TableCell>
                      <TableCell>{facilityName.get(eq.facility) ?? "-"}</TableCell>
                      <TableCell>{eq.category_display}</TableCell>
                      <TableCell>{eq.refrigerant_type_code}</TableCell>
                      <TableCell align="right">{eq.refrigerant_charge_kg ?? "—"}</TableCell>
                      <TableCell><Chip size="small" label={labels.criticality(eq.criticality)} /></TableCell>
                      <TableCell><DriftWarningBadge warnings={eq.drift_warnings} /></TableCell>
                      <TableCell align="right">
                        <Button size="small" component={RouterLink} to={`/jobs/new?equipment=${eq.id}&facility=${eq.facility}`}>
                          Request Job
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </>
      )}

      <EquipmentDialog open={open} onClose={() => setOpen(false)} facilities={facilities ?? []} />
    </Box>
  );
}
