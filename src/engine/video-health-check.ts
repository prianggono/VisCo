import type { HealthCheckItem } from "./health-check.js";
import type { NativeVirtualVideoBridge } from "./virtual-video-native.js";

export async function checkVisCoVirtualVideo(
  bridge: NativeVirtualVideoBridge
): Promise<HealthCheckItem> {
  try {
    const state = await bridge.refresh();

    return {
      id: "visco-virtual-video",
      label: "VisCo Virtual Video",
      status: state.status === "running" || state.status === "stopped" ? "ok" : "warning",
      message: state.error ?? `Native backend status: ${state.status}.`
    };
  } catch (error) {
    return {
      id: "visco-virtual-video",
      label: "VisCo Virtual Video",
      status: "error",
      message: error instanceof Error ? error.message : "Virtual Video health check failed."
    };
  }
}
