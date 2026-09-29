export interface D3D11RendererCapabilities {
  readonly backend: "d3d11";
  readonly maxTextureSize: number;
  readonly supportsVideo: boolean;
  readonly supportsCompute: boolean;
}

export interface D3D11RenderSlice {
  readonly id: string;
  readonly layerRefs: readonly { readonly deckId: string; readonly layerId: string }[];
  readonly transform: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotation: number;
    readonly scaleX?: number;
    readonly scaleY?: number;
    readonly cropLeft?: number;
    readonly cropTop?: number;
    readonly cropRight?: number;
    readonly cropBottom?: number;
  };
  readonly mapping?: {
    readonly mode: "rectangle" | "corner-pin" | "bezier" | "polygon";
    readonly points?: readonly { readonly x: number; readonly y: number }[];
  };
}

export interface D3D11RenderLayer {
  readonly id: string;
  readonly sourceId?: string | null;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly opacity: number;
  readonly order: number;
}

export interface D3D11RenderFrame {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly layerIds: readonly string[];
  readonly layers?: readonly D3D11RenderLayer[];
  readonly slices?: readonly D3D11RenderSlice[];
}

/**
 * Validates the renderer contract before crossing the native boundary.
 * VisCo intentionally targets 30 FPS by default; the host may reject
 * unsupported rates rather than silently changing the project configuration.
 */
export function validateD3D11RenderFrame(frame: D3D11RenderFrame, capabilities?: D3D11RendererCapabilities): void {
  if (!Number.isInteger(frame.width) || frame.width <= 0) throw new Error("D3D11 frame width must be a positive integer.");
  if (!Number.isInteger(frame.height) || frame.height <= 0) throw new Error("D3D11 frame height must be a positive integer.");
  if (!Number.isFinite(frame.fps) || frame.fps <= 0 || frame.fps > 120) throw new Error("D3D11 frame FPS must be between 1 and 120.");
  if (capabilities && (frame.width > capabilities.maxTextureSize || frame.height > capabilities.maxTextureSize)) {
    throw new Error("D3D11 frame exceeds the native texture-size capability.");
  }
  if (frame.layerIds.some((id) => !id.trim())) throw new Error("D3D11 frame contains an invalid layer id.");
  if (frame.slices?.some((slice) => !slice.id.trim() || slice.layerRefs.some((ref) => !ref.deckId.trim() || !ref.layerId.trim()))) {
    throw new Error("D3D11 frame contains an invalid Slice mapping.");
  }
}

export class D3D11RendererRuntime {
  private capabilities: D3D11RendererCapabilities | null = null;
  private initialized = false;

  constructor(private readonly bridge: D3D11RendererBridge) {}

  async initialize(): Promise<D3D11RendererCapabilities> {
    const capabilities = await this.bridge.initialize();
    if (capabilities.backend !== "d3d11") throw new Error("Unexpected renderer backend.");
    if (!Number.isFinite(capabilities.maxTextureSize) || capabilities.maxTextureSize <= 0) {
      throw new Error("Invalid D3D11 texture-size capability.");
    }
    this.capabilities = capabilities;
    this.initialized = true;
    return capabilities;
  }

  async render(frame: D3D11RenderFrame): Promise<void> {
    if (!this.initialized || !this.capabilities) throw new Error("D3D11 renderer is not initialized.");
    validateD3D11RenderFrame(frame, this.capabilities);
    await this.bridge.render(frame);
  }

  async resize(width: number, height: number): Promise<void> {
    if (!this.initialized || !this.capabilities) throw new Error("D3D11 renderer is not initialized.");
    validateD3D11RenderFrame({ width, height, fps: 30, layerIds: [] }, this.capabilities);
    await this.bridge.resize(width, height);
  }

  async flush(): Promise<void> {
    if (!this.initialized) throw new Error("D3D11 renderer is not initialized.");
    await this.bridge.flush();
  }

  async dispose(): Promise<void> {
    if (!this.initialized) return;
    try {
      await this.bridge.dispose();
    } finally {
      this.initialized = false;
      this.capabilities = null;
    }
  }

  getCapabilities(): D3D11RendererCapabilities | null {
    return this.capabilities;
  }
}

/** Native boundary: the Windows host supplies the actual Direct3D 11 implementation. */
export interface D3D11RendererBridge {
  initialize(): Promise<D3D11RendererCapabilities>;
  render(frame: D3D11RenderFrame): Promise<void>;
  resize(width: number, height: number): Promise<void>;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}
