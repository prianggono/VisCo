import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Slice, SlicePoint } from "../domain/slice.js";

export interface SliceCanvasProps {
  readonly slice: Slice | null;
  readonly width?: number;
  readonly height?: number;
  readonly guides?: boolean;
  readonly onMovePoint: (index: number, point: SlicePoint) => void;
  readonly onAddPoint: (point: SlicePoint) => void;
  readonly onRemovePoint: (index: number) => void;
}

export function SliceCanvas({ slice, width = 360, height = 200, guides = true, onMovePoint, onAddPoint, onRemovePoint }: SliceCanvasProps) {
  const [zoom, setZoom] = useState(1);
  if (!slice) return <div className="property-empty">Select a Slice to edit mapping.</div>;
  const sx = (width / Math.max(1, slice.transform.width)) * zoom, sy = (height / Math.max(1, slice.transform.height)) * zoom;
  const snap = (value: number, size: number) => Math.round(value / size) * size;
  const toPoint = (clientX: number, clientY: number, rect: DOMRect): SlicePoint => {
    const raw = { x: (clientX - rect.left) / sx + slice.transform.x, y: (clientY - rect.top) / sy + slice.transform.y };
    if (!slice.mapping?.snapToGrid) return raw;
    const grid = Math.max(1, slice.mapping.gridSize ?? 16);
    return { x: snap(raw.x, grid), y: snap(raw.y, grid) };
  };
  const svgPoint = (point: SlicePoint) => ({ x: (point.x - slice.transform.x) * sx, y: (point.y - slice.transform.y) * sy });
  const gridSize = Math.max(1, slice.mapping?.gridSize ?? 16);
  const gridX = Math.max(1, Math.floor(slice.transform.width / gridSize)), gridY = Math.max(1, Math.floor(slice.transform.height / gridSize));
  return (
    <div className="slice-canvas-wrap"><div className="slice-canvas-nav"><button onClick={() => setZoom((v) => Math.max(.5, v - .25))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((v) => Math.min(3, v + .25))}>+</button><button onClick={() => setZoom(1)}>FIT</button></div><svg width={width} height={height} viewBox={"0 0 " + width / zoom + " " + height / zoom} className="slice-editor-canvas"
      onDoubleClick={(event) => onAddPoint(toPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()))}>
      <rect x="0" y="0" width={width} height={height} fill="none" stroke="currentColor" strokeOpacity=".35" />
      {slice.mapping?.snapToGrid && <g className="slice-grid">
        {Array.from({length:Math.min(gridX,128)+1},(_,i)=><line key={`gx-${i}`} x1={i*width/Math.max(1,gridX)} y1="0" x2={i*width/Math.max(1,gridX)} y2={height}/>)}
        {Array.from({length:Math.min(gridY,128)+1},(_,i)=><line key={`gy-${i}`} x1="0" y1={i*height/Math.max(1,gridY)} x2={width} y2={i*height/Math.max(1,gridY)}/>)}
      </g>}
      {guides && <g className="slice-guides"><line x1={width/2} y1="0" x2={width/2} y2={height}/><line x1="0" y1={height/2} x2={width} y2={height/2}/></g>}
      {pointsPolyline(slice, svgPoint)}
      {(slice.mapping?.points ?? []).map((point,index) => { const p=svgPoint(point); return <circle key={index} cx={p.x} cy={p.y} r="6" fill="currentColor"
        onPointerDown={(event: ReactPointerEvent<SVGCircleElement>) => { event.currentTarget.setPointerCapture(event.pointerId); const rect=event.currentTarget.ownerSVGElement?.getBoundingClientRect(); if(!rect)return; const move=(e:PointerEvent)=>onMovePoint(index,toPoint(e.clientX,e.clientY,rect)); const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);}; window.addEventListener("pointermove",move);window.addEventListener("pointerup",up); }}
        onDoubleClick={(event)=>{event.stopPropagation();onRemovePoint(index);}}/>; })}
    </svg></div>
  );
}

function pointsPolyline(slice: Slice, svgPoint: (point: SlicePoint) => {x:number;y:number}) {
  const points=slice.mapping?.points ?? []; if(points.length<2)return null;
  const mapped=points.map((point)=>{const p=svgPoint(point);return `${p.x},${p.y}`;}).join(" ");
  const closed=slice.mapping?.mode==="polygon"||slice.mapping?.mode==="corner-pin";
  return <polyline points={closed&&points.length>2?mapped+" "+mapped.split(" ")[0]:mapped} fill="none" stroke="currentColor"/>;
}
