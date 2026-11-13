import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import { downloadComplianceReport, fetchRefrigerantDashboard } from "../../api/endpoints";
import { PageLoader } from "../../components/PageLoader";
import { RoleHero } from "../../components/RoleHero";
import { StatCard } from "../../components/StatCard";
import { GroupedBarChart, ThresholdBars } from "../../components/charts";
import { Stagger, StaggerItem } from "../../components/motion";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import RecyclingRoundedIcon from "@mui/icons-material/RecyclingRounded";
import WaterDropRoundedIcon from "@mui/icons-material/WaterDropRounded";
import CloudRoundedIcon from "@mui/icons-material/CloudRounded";

export function DashboardPage() {
  const { data } = useQuery({ queryKey: ["refrigerant-dashboard"], queryFn: () => fetchRefrigerantDashboard() });
  const [exporting, setExporting] = useState(false);

  if (!data) return <PageLoader />;

  async function handleExport() {
    setExporting(true);
    try {
      await downloadComplianceReport();
    } finally {
      setExporting(false);
    }
  }

  return (
    <Box>
      <RoleHero
        role="facility_manager"
        title="Refrigerant Dashboard"
        subtitle="Added, recovered and leaked refrigerant across your equipment."
        action={
          <Button variant="contained" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export Compliance Report"}
          </Button>
        }
      />
      <Alert severity="info" sx={{ mb: 3 }}>{data.note}</Alert>

      <Stagger inView={false} gap={0.09} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20, marginBottom: 28 }}>
        <StaggerItem><StatCard label="Refrigerant Added" value={data.total_added_kg} unit="kg" icon={ScienceRoundedIcon} tone="#2563EB" decimals={1} /></StaggerItem>
        <StaggerItem><StatCard label="Refrigerant Recovered" value={data.total_recovered_kg} unit="kg" icon={RecyclingRoundedIcon} tone="#0D9488" decimals={1} /></StaggerItem>
        <StaggerItem><StatCard label="Estimated Leaked" value={data.leaked_estimate_kg} unit="kg" icon={WaterDropRoundedIcon} tone="#E11D48" decimals={1} /></StaggerItem>
        <StaggerItem><StatCard label="Estimated CO2e" value={data.co2e_estimate_kg} unit="kg CO2e" icon={CloudRoundedIcon} tone="#7C3AED" decimals={0} /></StaggerItem>
      </Stagger>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", lg: "3fr 2fr" }} gap={3} mb={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1">Refrigerant by month</Typography>
          <Typography variant="body2" color="text.secondary" mb={1}>Added to equipment and recovered, last 12 months.</Typography>
          <GroupedBarChart
            aLabel="Added"
            bLabel="Recovered"
            data={(data.monthly ?? []).map((m) => ({
              label: new Date(`${m.month}-01T00:00:00`).toLocaleString("en", { month: "short" }),
              a: m.added_kg,
              b: m.recovered_kg,
            }))}
          />
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1">Leak rate by equipment</Typography>
          <Typography variant="body2" color="text.secondary" mb={2.5}>The dark marker is the flag threshold.</Typography>
          {data.leak_rate_by_equipment.length === 0 ? (
            <Typography color="text.secondary">No equipment with service history yet.</Typography>
          ) : (
            <ThresholdBars
              rows={data.leak_rate_by_equipment.map((r) => ({
                label: r.equipment_name,
                sublabel: r.facility_name,
                value: r.leak_rate_percent,
                threshold: r.threshold_percent,
              }))}
            />
          )}
        </Paper>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" mb={1}>By Refrigerant</Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Refrigerant</TableCell>
              <TableCell align="right">Added (kg)</TableCell>
              <TableCell align="right">Recovered (kg)</TableCell>
              <TableCell align="right">Est. Leaked (kg)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(data.by_refrigerant).map(([code, stats]) => (
              <TableRow key={code}>
                <TableCell>{code}</TableCell>
                <TableCell align="right">{stats.added_kg}</TableCell>
                <TableCell align="right">{stats.recovered_kg}</TableCell>
                <TableCell align="right">{stats.leaked_estimate_kg}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" mb={0.5}>Leak Rate by Equipment</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          Simplified EPA-style estimate: refrigerant added in the last 12 months over full system charge.
          Not a substitute for official EPA Section 608 recordkeeping.
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Equipment</TableCell>
              <TableCell>Facility</TableCell>
              <TableCell align="right">Charge (kg)</TableCell>
              <TableCell align="right">Added, 12mo (kg)</TableCell>
              <TableCell align="right">Leak Rate</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.leak_rate_by_equipment.map((row) => (
              <TableRow key={row.equipment_id}>
                <TableCell>{row.equipment_name}</TableCell>
                <TableCell>{row.facility_name}</TableCell>
                <TableCell align="right">{row.charge_kg ?? "—"}</TableCell>
                <TableCell align="right">{row.added_kg_12mo}</TableCell>
                <TableCell align="right">{row.leak_rate_percent !== null ? `${row.leak_rate_percent}%` : "—"}</TableCell>
                <TableCell>
                  {row.leak_rate_percent === null ? (
                    <Chip size="small" label="Unknown" />
                  ) : row.exceeds_threshold ? (
                    <Chip size="small" color="error" label={`Over ${row.threshold_percent}% threshold`} />
                  ) : (
                    <Chip size="small" color="success" label="Within threshold" />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {data.leak_rate_by_equipment.length === 0 && (
              <TableRow><TableCell colSpan={6}><Typography color="text.secondary">No equipment with service history yet.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
