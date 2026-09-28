import {
  UnavailableNativeOutputBridge,
  type NativeOutputBridge
} from "./native-output.js";
import {
  NativeDisplayOutputBridge,
  UnavailableNativeDisplayOutputBridge
} from "./display-output-native.js";
import {
  NativeLedOutputBridge,
  UnavailableNativeLedOutputBridge
} from "./led-output-native.js";
import {
  NativeStreamOutputBridge,
  UnavailableNativeStreamOutputBridge
} from "./stream-output-native.js";
import {
  NativeRecordOutputBridge,
  UnavailableNativeRecordOutputBridge
} from "./record-output-native.js";
import type { NativeVirtualVideoBridge } from "./virtual-video-native.js";
import { UnavailableNativeVirtualVideoBridge } from "./virtual-video-native.js";

export interface NativeOutputBackend {
  readonly generic: NativeOutputBridge;
  readonly display: NativeDisplayOutputBridge;
  readonly led: NativeLedOutputBridge;
  readonly stream: NativeStreamOutputBridge;
  readonly record: NativeRecordOutputBridge;
  readonly virtualVideo: NativeVirtualVideoBridge;
}

export function createUnavailableNativeOutputBackend(): NativeOutputBackend {
  return {
    generic: new UnavailableNativeOutputBridge(),
    display: new UnavailableNativeDisplayOutputBridge(),
    led: new UnavailableNativeLedOutputBridge(),
    stream: new UnavailableNativeStreamOutputBridge(),
    record: new UnavailableNativeRecordOutputBridge(),
    virtualVideo: new UnavailableNativeVirtualVideoBridge()
  };
}
