import type { CSSProperties, ReactNode } from "react";
import type { SliceTransform } from "../domain/slice.js";

export interface CompositionSliceViewProps {
  transform: SliceTransform;
  children: ReactNode;
}

export function CompositionSliceView({
  transform,
  children
}: CompositionSliceViewProps) {
  const style: CSSProperties = {
    position: "absolute",
    left: transform.x,
    top: transform.y,
    width: transform.width,
    height: transform.height,
    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg)`,
    overflow: "hidden"
  };

  return <div style={style}>{children}</div>;
}
