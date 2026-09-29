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
    const sends = [...this.transports.values()].map(async (transport) => {
      try {
        await transport.send(frame);
        return { id: transport.id, ok: true as const };
      } catch (error) {
        return {
          id: transport.id,
          ok: false as const,
          error: error instanceof Error ? error.message : "Output transport failed."
        };
      }
    });
    return Promise.all(sends);
  }

  get(id: string): OutputTransport | null { return this.transports.get(id) ?? null; }
  list(): readonly OutputTransport[] { return [...this.transports.values()]; }
}
