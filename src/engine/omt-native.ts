import {
  UnavailableNativeMediaSourceBridge,
  type NativeMediaFrame,
  type NativeMediaSourceBridge,
  type NativeMediaSourceDescriptor,
  type NativeMediaSourceState
} from "./native-media-source.js";

export interface OmtSourceDescriptor extends NativeMediaSourceDescriptor {
  readonly protocol: "omt";
  readonly streamName?: string;
  readonly discoveryServer?: string;
  readonly preferredQuality?: "low" | "medium" | "high" | "default";
  readonly preview?: boolean;
}

export interface NativeOmtBridge extends NativeMediaSourceBridge {
  discover(): Promise<readonly OmtSourceDescriptor[]>;
}

export class UnavailableNativeOmtBridge
  extends UnavailableNativeMediaSourceBridge
  implements NativeOmtBridge
{
  async discover(): Promise<readonly OmtSourceDescriptor[]> {
    return [];
  }

  override async start(source: NativeMediaSourceDescriptor): Promise<NativeMediaSourceState> {
    return super.start({ ...source, protocol: "omt" });
  }

  override async readFrame(sourceId: string): Promise<NativeMediaFrame | null> {
    return super.readFrame(sourceId);
  }
}
