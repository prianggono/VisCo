import { describe, expect, it } from "vitest";
import { getHealthStatus, summarizeHealth } from "../src/engine/health-check.js";

describe("health check", () => {
  it("aggregates an error before warning", () => {
    const report = summarizeHealth([
      { id: "a", label: "Audio", status: "warning", message: "Missing" },
      { id: "b", label: "Output", status: "error", message: "Failed" }
    ]);

    expect(getHealthStatus(report)).toBe("error");
  });

  it("aggregates warning when there are no errors", () => {
    const report = summarizeHealth([
      { id: "a", label: "Audio", status: "warning", message: "Not installed" }
    ]);

    expect(getHealthStatus(report)).toBe("warning");
  });

  it("reports ok when every check is healthy", () => {
    const report = summarizeHealth([
      { id: "a", label: "Audio", status: "ok", message: "Ready" }
    ]);

    expect(getHealthStatus(report)).toBe("ok");
  });
});
