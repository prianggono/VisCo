import type { OutputFrame } from "./output-frame.js";

export type OutputTransportKind = "display" | "media" | "virtual";

export interface OutputTransportStatus {
  readonly connected: boolean;
  readonly error: string | null;
}

export interface OutputTransport {
  readonly id: string;
  readonly kind: OutputTransportKind;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: OutputFrame): Promise<void>;
  getStatus(): OutputTransportStatus;
}

/** Registry isolates one failed output transport from other outputs. */
export class OutputTransportRegistry {
  private readonly transports = new Map<string, OutputTransport>();

  register(transport: OutputTransport): void {
    if (this.transports.has(transport.id)) throw new Error(`Output transport "${transport.id}" is already registered.`);
    this.transports.set(transport.id, transport);
  }

  async send(frame: OutputFrame): Promise<readonly { id: string; ok: boolean; error?: string }[]> {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const transport of this.transports.values()) {
      try {
        await transport.send(frame);
        results.push({ id: transport.id, ok: true });
      } catch (error) {
        results.push({ id: transport.id, ok: false, error: error instanceof Error ? error.message : "Output transport failed." });
      }
    }
    return results;
  }

  get(id: string): OutputTransport | null { return this.transports.get(id) ?? null; }
  list(): readonly OutputTransport[] { return [...this.transports.values()]; }
}
