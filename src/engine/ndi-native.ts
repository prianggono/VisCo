import {
  UnavailableNativeMediaSourceBridge,
  type NativeMediaFrame,
  type NativeMediaSourceBridge,
  type NativeMediaSourceDescriptor,
  type NativeMediaSourceState
} from "./native-media-source.js";

export interface NdiSourceDescriptor extends NativeMediaSourceDescriptor {
  readonly protocol: "ndi";
  readonly sourceName?: string;
  readonly sourceAddress?: string;
  readonly group?: string;
  readonly bandwidth?: "highest" | "lowest" | "metadata-only";
}

export interface NativeNdiBridge extends NativeMediaSourceBridge {
  discover(): Promise<readonly NdiSourceDescriptor[]>;
}

export class UnavailableNativeNdiBridge
  extends UnavailableNativeMediaSourceBridge
  implements NativeNdiBridge
{
  async discover(): Promise<readonly NdiSourceDescriptor[]> {
    return [];
  }

  override async start(source: NativeMediaSourceDescriptor): Promise<NativeMediaSourceState> {
    return super.start({ ...source, protocol: "ndi" });
  }

  override async readFrame(sourceId: string): Promise<NativeMediaFrame | null> {
    return super.readFrame(sourceId);
  }
}
