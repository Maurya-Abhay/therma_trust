import { Chip, type ChipProps } from "@mui/material";

const RISK_COLOR: Record<string, ChipProps["color"]> = {
  low: "success",
  medium: "info",
  high: "warning",
  very_high: "error",
  critical: "error",
};

const RISK_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  very_high: "Very High",
  critical: "Critical",
};

export function RiskChip({ level }: { level: string }) {
  return <Chip label={RISK_LABEL[level] ?? level} color={RISK_COLOR[level] ?? "default"} size="small" variant="filled" />;
}
