import { Chip, type ChipProps } from "@mui/material";

const COLOR_MAP: Record<string, ChipProps["color"]> = {
  verified: "success",
  platform_verified: "success",
  issuer_confirmed: "info",
  document_verified: "info",
  approved: "success",
  completed: "success",
  pending: "warning",
  submitted: "warning",
  open: "default",
  assigned: "info",
  in_progress: "info",
  not_qualified: "error",
  expired: "error",
  suspended: "error",
  revoked: "error",
  rejected: "error",
  cancelled: "default",
};

function toLabel(value: string) {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusChip({ status, size = "small" }: { status: string; size?: ChipProps["size"] }) {
  return <Chip label={toLabel(status)} color={COLOR_MAP[status] ?? "default"} size={size} />;
}
