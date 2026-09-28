import { useState, type CSSProperties, type MouseEvent } from "react";
import type { Layer } from "../domain/layer.js";
import type { Source } from "../domain/source.js";

interface DocumentLayerViewProps {
  layer: Layer;
  source: Source;
  style: CSSProperties;
  label: string;
  onPageChange?: (page: number) => void;
}

export function DocumentLayerView({ layer, source, style, label, onPageChange }: DocumentLayerViewProps) {
  const [open, setOpen] = useState(false);
  const page = Math.max(1, source.document?.currentPage ?? 1);
  const totalPages = Math.max(page, source.document?.totalPages ?? page);

  const selectPage = (nextPage: number) => {
    const bounded = Math.max(1, Math.min(totalPages, nextPage));
    onPageChange?.(bounded);
    setOpen(false);
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOpen((value) => !value);
  };

  const frameStyle: CSSProperties = {
    ...style,
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: "auto"
  };

  return (
    <div style={{ ...frameStyle, overflow: "hidden" }} onContextMenu={handleContextMenu} aria-label={layer.name}>
      {source.kind === "pdf" && source.uri ? (
        <iframe
          src={source.uri + "#page=" + page + "&view=Fit"}
          title={layer.name}
          style={{ border: 0, width: "100%", height: "100%", display: "block" }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#fff" }}>
          {source.kind === "powerpoint" ? "POWERPOINT · PAGE " + page : label}
        </div>
      )}

      {open && (
        <div
          style={{ position: "absolute", right: 12, top: 12, zIndex: 9999, maxWidth: "80%", maxHeight: "80%", overflow: "auto", padding: 10, background: "rgba(10,10,10,.94)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6 }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <strong style={{ display: "block", color: "#fff", marginBottom: 8 }}>SHOW PAGE</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(42px, 1fr))", gap: 6 }}>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
              <button key={item} onClick={() => selectPage(item)} style={{ minWidth: 42, minHeight: 34 }}>
                {item}
              </button>
            ))}
          </div>
          {source.document?.totalPages === undefined && (
            <small style={{ display: "block", color: "#aaa", marginTop: 8 }}>Total page belum diketahui oleh document decoder.</small>
          )}
        </div>
      )}
    </div>
  );
}
