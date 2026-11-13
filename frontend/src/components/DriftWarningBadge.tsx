import { Chip, Tooltip } from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { DriftWarning } from "../types";

export function DriftWarningBadge({ warnings }: { warnings: DriftWarning[] | undefined }) {
  if (!warnings || warnings.length === 0) return null;

  const tooltip = warnings
    .map((w) => `${w.metric}: ${w.direction} across last 3 services (${w.values.join(" → ")})`)
    .join("\n");

  return (
    <Tooltip title={tooltip} slotProps={{ tooltip: { sx: { whiteSpace: "pre-line" } } }}>
      <Chip
        size="small"
        color="warning"
        icon={<WarningAmberRoundedIcon />}
        label="Needs inspection"
      />
    </Tooltip>
  );
}
