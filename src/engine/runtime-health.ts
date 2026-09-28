import type { HealthCheckItem } from "./health-check.js";

export function checkDeviceAvailability(available: boolean, label = "Device", id = "device"): HealthCheckItem {
  return available
    ? { id, label, status: "ok", message: "Device is available." }
    : { id, label, status: "warning", message: "Device is unavailable; output/input should remain isolated." };
}

export function checkMediaPlayable(playable: boolean, label = "Media", id = "media"): HealthCheckItem {
  return playable
    ? { id, label, status: "ok", message: "Media is playable." }
    : { id, label, status: "error", message: "Media is not playable by the selected pipeline." };
}
