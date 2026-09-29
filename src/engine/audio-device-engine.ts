export type AudioBackend = "asio" | "wasapi";
export interface AudioDeviceCapabilities { readonly id: string; readonly name: string; readonly inputs: number; readonly outputs: number; readonly sampleRates: readonly number[]; readonly channels: number; }
export interface AudioDeviceBridge {
  enumerate(): Promise<readonly AudioDeviceCapabilities[]>;
  open(deviceId: string, backend: AudioBackend): Promise<void>;
  close(): Promise<void>;
  readInput(): Promise<Float32Array | null>;
  writeOutput(buffer: Float32Array): Promise<void>;
}
export class AudioDeviceEngine {
  private selected: AudioDeviceCapabilities | null = null;
  private backend: AudioBackend = "wasapi";
  constructor(private readonly bridge: AudioDeviceBridge) {}
  async discover(): Promise<readonly AudioDeviceCapabilities[]> { return this.bridge.enumerate(); }
  async select(deviceId: string, preferred: AudioBackend = "asio"): Promise<AudioDeviceCapabilities> {
    const devices = await this.bridge.enumerate();
    const found = devices.find((device) => device.id === deviceId);
    if (!found) throw new Error(`Audio device "${deviceId}" was not found.`);
    this.selected = found;
    this.backend = preferred === "asio" && found.sampleRates.length > 0 ? "asio" : "wasapi";
    await this.bridge.open(found.id, this.backend);
    return found;
  }
  async readInput(): Promise<Float32Array | null> { return this.bridge.readInput(); }
  async writeOutput(buffer: Float32Array): Promise<void> { return this.bridge.writeOutput(buffer); }
  async close(): Promise<void> { await this.bridge.close(); this.selected = null; }
  getSelected(): AudioDeviceCapabilities | null { return this.selected; }
  getBackend(): AudioBackend { return this.backend; }
}
