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
