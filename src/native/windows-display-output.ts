export interface WindowsDisplayOutputConfig {
  readonly id: string;
  readonly displayId: string;
  readonly fullscreen: boolean;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
}

export interface WindowsDisplayOutputStatus {
  readonly connected: boolean;
  readonly error: string | null;
}

export interface WindowsDisplayOutputBridge {
  connect(config: WindowsDisplayOutputConfig): Promise<void>;
  disconnect(): Promise<void>;
  present(frame: { readonly width: number; readonly height: number; readonly frameNumber: number }): Promise<void>;
  getStatus(): WindowsDisplayOutputStatus;
}

/**
 * HDMI is represented as a Windows display target.
 * No LED/network protocol is involved in this path.
 */
export class WindowsDisplayOutput {
  readonly kind = "hdmi-display" as const;

  constructor(
    private readonly config: WindowsDisplayOutputConfig,
    private readonly bridge: WindowsDisplayOutputBridge
  ) {}

  connect(): Promise<void> {
    return this.bridge.connect(this.config);
  }

  disconnect(): Promise<void> {
    return this.bridge.disconnect();
  }

  present(frame: { readonly width: number; readonly height: number; readonly frameNumber: number }): Promise<void> {
    if (frame.width <= 0 || frame.height <= 0) throw new Error("Display frame dimensions must be positive.");
    return this.bridge.present(frame);
  }

  getStatus(): WindowsDisplayOutputStatus {
    return this.bridge.getStatus();
  }
}
