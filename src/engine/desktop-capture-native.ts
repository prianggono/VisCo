import {
  UnavailableNativeMediaSourceBridge,
  type NativeMediaFrame,
  type NativeMediaSourceBridge,
  type NativeMediaSourceDescriptor,
  type NativeMediaSourceState,
  type NativeVideoFormat
} from "./native-media-source.js";

export interface DesktopCaptureSourceDescriptor extends NativeMediaSourceDescriptor {
  readonly protocol: "desktop-capture";
  readonly displayId?: string;
  readonly windowId?: string;
  readonly includeCursor?: boolean;
  readonly format?: NativeVideoFormat;
}

export interface NativeDesktopCaptureBridge extends NativeMediaSourceBridge {
  enumerateTargets(): Promise<readonly DesktopCaptureSourceDescriptor[]>;
}

export class UnavailableNativeDesktopCaptureBridge
  extends UnavailableNativeMediaSourceBridge
  implements NativeDesktopCaptureBridge
{
  async enumerateTargets(): Promise<readonly DesktopCaptureSourceDescriptor[]> {
    return [];
  }

  override async start(source: NativeMediaSourceDescriptor): Promise<NativeMediaSourceState> {
    return super.start({ ...source, protocol: "desktop-capture" });
  }

  override async readFrame(sourceId: string): Promise<NativeMediaFrame | null> {
    return super.readFrame(sourceId);
  }
}
