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
  return {
    generatedAt: new Date().toISOString(),
    items
  };
}

export function getHealthStatus(report: HealthCheckReport): HealthStatus {
  if (report.items.some((item) => item.status === "error")) return "error";
  if (report.items.some((item) => item.status === "warning")) return "warning";
  return "ok";
}
