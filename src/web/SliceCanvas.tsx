import type { PointerEvent as ReactPointerEvent } from "react";
import type { Slice, SlicePoint } from "../domain/slice.js";

export interface SliceCanvasProps {
  readonly slice: Slice | null;
  readonly width?: number;
  readonly height?: number;
  readonly onMovePoint: (index: number, point: SlicePoint) => void;
  readonly onAddPoint: (point: SlicePoint) => void;
  readonly onRemovePoint: (index: number) => void;
}

export function SliceCanvas({ slice, width = 360, height = 200, onMovePoint, onAddPoint, onRemovePoint }: SliceCanvasProps) {
  if (!slice) return <div className="property-empty">Select a Slice to edit mapping.</div>;
  const sx = width / Math.max(1, slice.transform.width);
  const sy = height / Math.max(1, slice.transform.height);
  const points = slice.mapping?.points ?? [];
  const toPoint = (event: ReactPointerEvent<SVGSVGElement>): SlicePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / sx + slice.transform.x, y: (event.clientY - rect.top) / sy + slice.transform.y };
  };
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="slice-editor-canvas"
      onDoubleClick={(event) => onAddPoint(toPoint(event))}>
      <rect x="0" y="0" width={width} height={height} fill="none" stroke="currentColor" strokeOpacity=".35" />
      {points.length > 1 && <polyline points={points.map((p) => `${(p.x-slice.transform.x)*sx},${(p.y-slice.transform.y)*sy}`).join(" ")} fill="none" stroke="currentColor" />}
      {points.map((point, index) => (
        <circle key={index} cx={(point.x-slice.transform.x)*sx} cy={(point.y-slice.transform.y)*sy} r="6" fill="currentColor"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const move = (moveEvent: PointerEvent) => onMovePoint(index, toPoint(moveEvent as unknown as React.PointerEvent<SVGSVGElement>));
            const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
            window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
          }}
          onDoubleClick={(event) => { event.stopPropagation(); onRemovePoint(index); }}
        />
      ))}
    </svg>
  );
}
