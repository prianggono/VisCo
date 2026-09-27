import type { CSSProperties, ReactNode } from "react";
import type { Composition } from "../domain/composition.js";
import { getDefaultSliceTransform, type SliceTransform } from "../domain/slice.js";

export interface CompositionSliceViewProps {
  transform?: SliceTransform;
  composition?: Composition;
  children: ReactNode;
}

/**
 * A Slice defaults to the full Composition canvas.
 * Explicit transform values still allow later mapping/cropping workflows.
 */
export function CompositionSliceView({
  transform,
  composition,
  children
}: CompositionSliceViewProps) {
  const resolved = transform ?? (composition ? getDefaultSliceTransform(composition) : undefined);
  if (!resolved) return <>{children}</>;

  const style: CSSProperties = {
    position: "absolute",
    left: resolved.x,
    top: resolved.y,
    width: resolved.width,
    height: resolved.height,
    transform: `translate(-50%, -50%) rotate(${resolved.rotation}deg)`,
    overflow: "hidden"
  };

  return <div style={style}>{children}</div>;
}
