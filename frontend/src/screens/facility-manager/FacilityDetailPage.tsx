import { useState } from "react";
import { useDeepLinkAction } from "../../lib/useDeepLink";
import { useLabels } from "../../lib/labels";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { Box, Button, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { fetchEquipment, fetchFacilities } from "../../api/endpoints";
import { DriftWarningBadge } from "../../components/DriftWarningBadge";
import { EquipmentDialog } from "../../components/EquipmentDialog";

export function FacilityDetailPage() {
  const labels = useLabels();
  const { id } = useParams();
  const facilityId = Number(id);

  const { data: facilities } = useQuery({ queryKey: ["facilities"], queryFn: fetchFacilities });
  const facility = facilities?.find((f) => f.id === facilityId);

  const { data: equipment } = useQuery({
    queryKey: ["equipment", facilityId],
    queryFn: () => fetchEquipment(facilityId),
  });
  const [open, setOpen] = useState(false);
  useDeepLinkAction(() => setOpen(true));

  return (
    <Box>
      <Typography variant="h4" mb={1}>{facility?.name ?? "Facility"}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {facility?.address} &middot; {facility?.service_area}
      </Typography>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Equipment</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>Add Equipment</Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Refrigerant</TableCell>
              <TableCell align="right">Charge (kg)</TableCell>
              <TableCell>Criticality</TableCell>
              <TableCell>Condition</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {equipment?.map((eq) => (
              <TableRow key={eq.id}>
                <TableCell>
                  <Button size="small" component={RouterLink} to={`/equipment/${eq.id}`} sx={{ fontWeight: 700 }}>
                    {eq.name}
                  </Button>
                </TableCell>
                <TableCell>{eq.category_display}</TableCell>
                <TableCell>{eq.refrigerant_type_code}</TableCell>
                <TableCell align="right">{eq.refrigerant_charge_kg ?? "—"}</TableCell>
                <TableCell><Chip size="small" label={labels.criticality(eq.criticality)} /></TableCell>
                <TableCell><DriftWarningBadge warnings={eq.drift_warnings} /></TableCell>
                <TableCell align="right">
                  <Button size="small" component={RouterLink} to={`/jobs/new?equipment=${eq.id}&facility=${facilityId}`}>
                    Request Job
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <EquipmentDialog open={open} onClose={() => setOpen(false)} facilityId={facilityId} />
    </Box>
  );
}
