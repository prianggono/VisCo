export interface D3D11RendererCapabilities {
  readonly backend: "d3d11";
  readonly maxTextureSize: number;
  readonly supportsVideo: boolean;
  readonly supportsCompute: boolean;
}

export interface D3D11RenderFrame {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly layerIds: readonly string[];
}

/** Native boundary only; implementation belongs to the Windows host. */
export interface D3D11RendererBridge {
  initialize(): Promise<D3D11RendererCapabilities>;
  render(frame: D3D11RenderFrame): Promise<void>;
  resize(width: number, height: number): Promise<void>;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}
