import type { D3D11RenderLayer } from "./d3d11-renderer.js";

export interface NativeRenderStateBridge {
  /**
   * Binds a domain Source id to a native frame producer. This is metadata only;
   * the native SourceRegistry keeps the live frame reference.
   */
  bindRenderSource(sourceId: string, nativeSourceId: "capture" | "network"): Promise<void>;
  /**
   * Sends the current Program/Scene layer metadata without copying pixels.
   */
  setRenderLayers(layers: readonly D3D11RenderLayer[]): Promise<void>;
}
