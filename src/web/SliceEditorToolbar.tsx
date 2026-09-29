import { useState } from "react";
import { setSliceEditorTool, type SliceEditorState, type SliceEditorTool } from "../engine/slice-editor.js";

export function useSliceEditorTool(): [SliceEditorState, (tool: SliceEditorTool) => void] {
  const [state, setState] = useState<SliceEditorState>({ tool: "move-pick", selectedPointIndex: null });
  return [state, (tool) => setState((current) => setSliceEditorTool(current, tool))];
}

export function SliceEditorToolbar({
  tool,
  onToolChange
}: {
  readonly tool: SliceEditorTool;
  readonly onToolChange: (tool: SliceEditorTool) => void;
}) {
  return (
    <div className="slice-editor-toolbar" role="toolbar" aria-label="Slice Editor Tools">
      <button
        className={tool === "move-pick" ? "slice-tool active" : "slice-tool"}
        title="Move / Pick"
        aria-label="Move / Pick"
        onClick={() => onToolChange("move-pick")}
      >
        ↖
      </button>
      <button
        className={tool === "pen" ? "slice-tool active" : "slice-tool"}
        title="Pen / Edit: add and edit points"
        aria-label="Pen / Edit"
        onClick={() => onToolChange("pen")}
      >
        ✒
      </button>
    </div>
  );
}
