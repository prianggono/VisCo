import {
  UnavailableNativeOutputBridge,
  type NativeOutputBridge,
  type NativeOutputDescriptor,
  type NativeOutputState
} from "./native-output.js";

export interface LedOutputDescriptor extends NativeOutputDescriptor {
  readonly protocol: "led";
  readonly deviceId: string;
  readonly width: number;
  readonly height: number;
  readonly pixelFormat?: string;
}

export interface NativeLedOutputBridge extends NativeOutputBridge {
  enumerateDevices(): Promise<readonly LedOutputDescriptor[]>;
}

export class UnavailableNativeLedOutputBridge
  extends UnavailableNativeOutputBridge
  implements NativeLedOutputBridge
{
  async enumerateDevices(): Promise<readonly LedOutputDescriptor[]> {
    return [];
  }

  override async start(output: NativeOutputDescriptor): Promise<NativeOutputState> {
    return super.start({ ...output, protocol: "led" });
  }
}
