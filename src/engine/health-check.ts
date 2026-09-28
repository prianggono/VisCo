export type HealthStatus = "ok" | "warning" | "error";

export interface HealthCheckItem {
  readonly id: string;
  readonly label: string;
  readonly status: HealthStatus;
  readonly message: string;
}

export interface HealthCheckReport {
  readonly generatedAt: string;
  readonly items: readonly HealthCheckItem[];
}

export function summarizeHealth(items: readonly HealthCheckItem[]): HealthCheckReport {
  return { generatedAt: new Date().toISOString(), items };
}

export function checkUniqueIds(ids: readonly string[], id = "unique-ids"): HealthCheckItem {
  const unique = new Set(ids);
  return unique.size === ids.length
    ? { id, label: "Unique IDs", status: "ok", message: "No duplicate IDs detected." }
    : { id, label: "Unique IDs", status: "error", message: "Duplicate IDs detected." };
}

export function checkRequiredReference(referenceId: string | null | undefined, label: string, id: string): HealthCheckItem {
  return referenceId
    ? { id, label, status: "ok", message: `Reference "${referenceId}" is present.` }
    : { id, label, status: "error", message: `${label} is missing.` };
}

export function checkOutputHealth(enabled: boolean, active: boolean, id = "output"): HealthCheckItem {
  if (!enabled) return { id, label: "Output", status: "warning", message: "Output is disabled." };
  return active
    ? { id, label: "Output", status: "ok", message: "Output is enabled and active." }
    : { id, label: "Output", status: "warning", message: "Output is enabled but not active." };
}
