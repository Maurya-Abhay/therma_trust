import { useQuery } from "@tanstack/react-query";
import { fetchChoices, fetchRefrigerantTypes } from "../api/endpoints";
import type { Option } from "../types";

/** "ammonia_system" -> "Ammonia system": the fallback when a code has no official label. */
export function humanise(value: string | null | undefined) {
  if (!value) return "";
  const spaced = value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface Requirement {
  capability_type: string;
  key: string | number;
}

/**
 * Turns the codes the API sends ("high", "equipment", "ammonia_safety", refrigerant id 6) into the
 * names people read ("High", "Equipment", "Ammonia Safety", "R-717"). Uses the same lists that fill
 * the dropdowns, so a label can never differ from what the form showed.
 */
export function useLabels() {
  const { data: choices } = useQuery({ queryKey: ["choices"], queryFn: fetchChoices, staleTime: 5 * 60_000 });
  const { data: refrigerants } = useQuery({ queryKey: ["refrigerant-types"], queryFn: fetchRefrigerantTypes, staleTime: 5 * 60_000 });

  const find = (options: Option[] | undefined, value: string) => options?.find((o) => o.value === value)?.label ?? humanise(value);

  const requirementValue = (req: Requirement) => {
    if (req.capability_type === "equipment") return find(choices?.equipment_categories, String(req.key));
    if (req.capability_type === "refrigerant") {
      return refrigerants?.find((r) => r.id === Number(req.key))?.code ?? `Refrigerant ${req.key}`;
    }
    return find(choices?.safety_domains, String(req.key));
  };

  return {
    capabilityType: (value: string) => find(choices?.capability_types, value),
    criticality: (value: string) => find(choices?.criticalities, value),
    urgency: (value: string) => find(choices?.urgencies, value),
    evidenceType: (value: string) => find(choices?.evidence_types, value),
    /** "Ammonia System" for an equipment requirement, "R-717" for a refrigerant one, and so on. */
    requirementValue,
    /** "Safety: Ammonia Safety" */
    requirement: (req: Requirement) => `${find(choices?.capability_types, req.capability_type)}: ${requirementValue(req)}`,
  };
}
