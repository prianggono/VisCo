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
  const toPoint = (clientX: number, clientY: number, rect: DOMRect): SlicePoint => ({
    x: (clientX - rect.left) / sx + slice.transform.x,
    y: (clientY - rect.top) / sy + slice.transform.y
  });
  const svgPoint = (point: SlicePoint) => ({
    x: (point.x - slice.transform.x) * sx,
    y: (point.y - slice.transform.y) * sy
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="slice-editor-canvas"
      onDoubleClick={(event) => onAddPoint(toPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()))}>
      <rect x="0" y="0" width={width} height={height} fill="none" stroke="currentColor" strokeOpacity=".35" />
      {pointsPolyline(slice, svgPoint)}
      {(slice.mapping?.points ?? []).map((point, index) => {
        const p = svgPoint(point);
        return <circle key={index} cx={p.x} cy={p.y} r="6" fill="currentColor"
          onPointerDown={(event: ReactPointerEvent<SVGCircleElement>) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
            if (!rect) return;
            const move = (moveEvent: PointerEvent) => onMovePoint(index, toPoint(moveEvent.clientX, moveEvent.clientY, rect));
            const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
            window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
          }}
          onDoubleClick={(event) => { event.stopPropagation(); onRemovePoint(index); }}
        />;
      })}
    </svg>
  );
}

function pointsPolyline(slice: Slice, svgPoint: (point: SlicePoint) => { x: number; y: number }) {
  const points = slice.mapping?.points ?? [];
  if (points.length < 2) return null;
  return <polyline points={points.map((point) => { const p=svgPoint(point); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke="currentColor" />;
}
