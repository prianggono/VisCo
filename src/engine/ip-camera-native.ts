import {
  UnavailableNativeMediaSourceBridge,
  type NativeMediaFrame,
  type NativeMediaSourceBridge,
  type NativeMediaSourceDescriptor,
  type NativeMediaSourceState
} from "./native-media-source.js";

export interface IpCameraSourceDescriptor extends NativeMediaSourceDescriptor {
  readonly protocol: "ip-camera";
  readonly uri?: string;
  readonly transport?: "rtsp" | "rtmp" | "srt" | "http";
  readonly username?: string;
}

export interface NativeIpCameraBridge extends NativeMediaSourceBridge {
  discover(): Promise<readonly IpCameraSourceDescriptor[]>;
}

export class UnavailableNativeIpCameraBridge
  extends UnavailableNativeMediaSourceBridge
  implements NativeIpCameraBridge
{
  async discover(): Promise<readonly IpCameraSourceDescriptor[]> {
    return [];
  }

  override async start(source: NativeMediaSourceDescriptor): Promise<NativeMediaSourceState> {
    return super.start({ ...source, protocol: "ip-camera" });
  }

  override async readFrame(sourceId: string): Promise<NativeMediaFrame | null> {
    return super.readFrame(sourceId);
  }
}
