import type { OutputFrame } from "./output-frame.js";
import type { D3D11RenderFrame } from "../native/d3d11-renderer.js";

/**
 * Converts the engine's immutable OutputFrame into the native D3D11 contract.
 * No rendering is performed here; this is the boundary adapter only.
 */
export function toD3D11RenderFrame(frame: OutputFrame): D3D11RenderFrame {
  return {
    width: frame.source.width,
    height: frame.source.height,
    fps: frame.source.fps,
    layerIds: [...frame.layerIds],
    ...(frame.slices ? {
      slices: frame.slices.map((slice) => ({
        id: slice.id,
        layerIds: [...slice.layerIds],
        transform: { ...slice.transform },
        ...(slice.mapping ? {
          mapping: {
            mode: slice.mapping.mode,
            ...(slice.mapping.points ? { points: slice.mapping.points.map((point) => ({ ...point })) } : {})
          }
        } : {})
      }))
    } : {})
  };
}
