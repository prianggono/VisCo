import {
  UnavailableNativeOutputBridge,
  type NativeOutputBridge,
  type NativeOutputDescriptor,
  type NativeOutputState
} from "./native-output.js";

export interface StreamOutputDescriptor extends NativeOutputDescriptor {
  readonly protocol: "stream";
  readonly server: string;
  readonly key: string;
  readonly codec: string;
  readonly bitrate: number | "auto";
}

export interface NativeStreamOutputBridge extends NativeOutputBridge {
  enumerateEncoders(): Promise<readonly string[]>;
}

export class UnavailableNativeStreamOutputBridge
  extends UnavailableNativeOutputBridge
  implements NativeStreamOutputBridge
{
  async enumerateEncoders(): Promise<readonly string[]> {
    return [];
  }

  override async start(output: NativeOutputDescriptor): Promise<NativeOutputState> {
    return super.start({ ...output, protocol: "stream" });
  }
}
