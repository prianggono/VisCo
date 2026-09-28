import {
  NativeMediaSourceBridge,
  NativeMediaSourceDescriptor,
  NativeMediaSourceState,
  UnavailableNativeMediaSourceBridge
} from "./native-media-source.js";
import { NativeNdiBridge, UnavailableNativeNdiBridge } from "./ndi-native.js";
import { NativeOmtBridge, UnavailableNativeOmtBridge } from "./omt-native.js";
import { NativeIpCameraBridge, UnavailableNativeIpCameraBridge } from "./ip-camera-native.js";
import { NativeDesktopCaptureBridge, UnavailableNativeDesktopCaptureBridge } from "./desktop-capture-native.js";

export interface NativeMediaBackend {
  readonly generic: NativeMediaSourceBridge;
  readonly ndi: NativeNdiBridge;
  readonly omt: NativeOmtBridge;
  readonly ipCamera: NativeIpCameraBridge;
  readonly desktopCapture: NativeDesktopCaptureBridge;
}

export function createUnavailableNativeMediaBackend(): NativeMediaBackend {
  return {
    generic: new UnavailableNativeMediaSourceBridge(),
    ndi: new UnavailableNativeNdiBridge(),
    omt: new UnavailableNativeOmtBridge(),
    ipCamera: new UnavailableNativeIpCameraBridge(),
    desktopCapture: new UnavailableNativeDesktopCaptureBridge()
  };
}

export function nativeMediaStatusLabel(state: Pick<NativeMediaSourceState, "status" | "error">): string {
  switch (state.status) {
    case "running":
      return "RUNNING";
    case "starting":
      return "STARTING";
    case "stopped":
      return "STOPPED";
    case "error":
      return state.error ? `ERROR · ${state.error}` : "ERROR";
    default:
      return state.error ? `UNAVAILABLE · ${state.error}` : "UNAVAILABLE";
  }
}

export function descriptorForNativeMediaSource(
  sourceId: string,
  protocol: NativeMediaSourceDescriptor["protocol"],
  name: string,
  metadata?: Readonly<Record<string, unknown>>
): NativeMediaSourceDescriptor {
  return {
    sourceId,
    protocol,
    name,
    ...(metadata ? { metadata } : {})
  };
}
