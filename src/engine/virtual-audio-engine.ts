import {
  DEFAULT_VIRTUAL_AUDIO_CONFIG,
  type VirtualAudioChannel,
  type VirtualAudioConfig,
  type VirtualAudioEndpoint
} from "../domain/virtual-audio.js";

export interface VirtualAudioBackend {
  readonly platform: "browser" | "windows";
  isAvailable(): boolean;
  start(endpoint: VirtualAudioEndpoint): Promise<void>;
  stop(endpoint: VirtualAudioEndpoint): Promise<void>;
}

/**
 * Native boundary for VisCo Virtual Audio.
 *
 * This engine owns lifecycle/configuration only. It deliberately does not
 * pretend to create a Windows audio driver from browser JavaScript.
 */
export class VirtualAudioEngine {
  private config: VirtualAudioConfig;
  private readonly running = new Set<string>();

  constructor(
    config: VirtualAudioConfig = DEFAULT_VIRTUAL_AUDIO_CONFIG,
    private readonly backend?: VirtualAudioBackend
  ) {
    this.config = config;
  }

  getConfig(): VirtualAudioConfig {
    return this.config;
  }

  setEnabled(enabled: boolean): VirtualAudioConfig {
    this.config = { ...this.config, enabled };
    return this.config;
  }

  getEndpoint(channel: VirtualAudioChannel): VirtualAudioEndpoint {
    const endpoint = this.config.endpoints.find((item) => item.channel === channel);
    if (!endpoint) throw new Error(`Virtual Audio ${channel} is not configured.`);
    return endpoint;
  }

  isAvailable(): boolean {
    return Boolean(this.backend?.isAvailable());
  }

  isRunning(channel: VirtualAudioChannel): boolean {
    return this.running.has(this.getEndpoint(channel).id);
  }

  async start(channel: VirtualAudioChannel): Promise<void> {
    if (!this.config.enabled) throw new Error("VisCo Virtual Audio is disabled.");
    const endpoint = this.getEndpoint(channel);
    if (!endpoint.enabled) throw new Error(`Virtual Audio ${channel} is disabled.`);
    if (!this.backend) throw new Error("VisCo Virtual Audio native backend is not installed.");
    if (!this.backend.isAvailable()) throw new Error("VisCo Virtual Audio native backend is unavailable.");
    await this.backend.start(endpoint);
    this.running.add(endpoint.id);
  }

  async stop(channel: VirtualAudioChannel): Promise<void> {
    const endpoint = this.getEndpoint(channel);
    if (!this.backend) {
      this.running.delete(endpoint.id);
      return;
    }
    await this.backend.stop(endpoint);
    this.running.delete(endpoint.id);
  }
}
