import {
  UnavailableNativeOutputBridge,
  type NativeOutputBridge,
  type NativeOutputDescriptor,
  type NativeOutputState
} from "./native-output.js";

export interface RecordOutputDescriptor extends NativeOutputDescriptor {
  readonly protocol: "record";
  readonly targetFolder: string;
  readonly codec: string;
  readonly bitrate: number | "auto";
  readonly segmentMinutes: number | "custom";
}

export interface NativeRecordOutputBridge extends NativeOutputBridge {
  enumerateCodecs(): Promise<readonly string[]>;
}

export class UnavailableNativeRecordOutputBridge
  extends UnavailableNativeOutputBridge
  implements NativeRecordOutputBridge
{
  async enumerateCodecs(): Promise<readonly string[]> {
    return [];
  }

  override async start(output: NativeOutputDescriptor): Promise<NativeOutputState> {
    return super.start({ ...output, protocol: "record" });
  }
}
