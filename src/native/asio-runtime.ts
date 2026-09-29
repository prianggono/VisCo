import type {
  NativeAsioDriver,
  NativeAsioStartResult,
  NativeAsioStatus,
  NativeHostHttpBridge
} from "../native/native-host-http.js";

export interface AsioRuntimeSnapshot {
  readonly running: boolean;
  readonly driver: string | null;
  readonly sampleRate: number;
  readonly channels: number;
  readonly bufferFrames: number;
  readonly callbackBlocks: number;
  readonly callbackFrames: number;
  readonly droppedFrames: number;
  readonly overruns: number;
  readonly availableFrames: number;
}

/**
 * Control/status boundary for the native ASIO callback -> AudioEngine path.
 *
 * Sample transport deliberately stays native and real-time safe; this class
 * does not poll PCM through HTTP or allocate inside the ASIO callback.
 */
export class NativeAsioRuntime {
  private currentDriver: string | null = null;

  constructor(private readonly bridge: NativeHostHttpBridge) {}

  async enumerate(): Promise<readonly NativeAsioDriver[]> {
    return this.bridge.asioDrivers();
  }

  async start(driver: string): Promise<NativeAsioStartResult> {
    const result = await this.bridge.asioStart(driver);
    this.currentDriver = result.driver ?? driver;
    return result;
  }

  async stop(): Promise<void> {
    await this.bridge.asioStop();
    this.currentDriver = null;
  }

  async status(): Promise<AsioRuntimeSnapshot> {
    const status: NativeAsioStatus = await this.bridge.asioStatus();
    return {
      ...status,
      driver: this.currentDriver
    };
  }

  getDriver(): string | null {
    return this.currentDriver;
  }
}
