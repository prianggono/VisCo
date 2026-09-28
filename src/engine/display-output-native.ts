import {
  UnavailableNativeOutputBridge,
  type NativeOutputBridge,
  type NativeOutputDescriptor,
  type NativeOutputState
} from "./native-output.js";

export interface DisplayOutputDescriptor extends NativeOutputDescriptor {
  readonly protocol: "display";
  readonly displayId?: string;
  readonly width?: number;
  readonly height?: number;
  readonly refreshRate?: number;
}

export interface NativeDisplayOutputBridge extends NativeOutputBridge {
  enumerateDisplays(): Promise<readonly DisplayOutputDescriptor[]>;
}

export class UnavailableNativeDisplayOutputBridge
  extends UnavailableNativeOutputBridge
  implements NativeDisplayOutputBridge
{
  async enumerateDisplays(): Promise<readonly DisplayOutputDescriptor[]> {
    return [];
  }

  override async start(output: NativeOutputDescriptor): Promise<NativeOutputState> {
    return super.start({ ...output, protocol: "display" });
  }
}
