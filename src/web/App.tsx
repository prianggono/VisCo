import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { LibraryEngine } from "../engine/library-engine.js";
import type { Source, SourceKind } from "../domain/source.js";

type Layer = { id: string; name: string };
type LibraryItem = Source;
type DeckKind = "visual" | "audio";
type Deck = {
  id: string;
  name: string;
  kind: DeckKind;
  transition: string;
  loop: boolean;
  layers: Layer[];
};

const makeLayers = (): Layer[] =>
  Array.from({ length: 8 }, (_, index) => ({
    id: "layer-" + (index + 1),
    name: "Layer " + (index + 1)
  }));

const initialDecks: Deck[] = [
  { id: "deck-1", name: "Deck 1", kind: "visual", transition: "Fade · 500 ms", loop: true, layers: makeLayers() },
  { id: "deck-2", name: "Deck 2", kind: "visual", transition: "Cut · 0 ms", loop: false, layers: makeLayers() }
];

const inputTypes: Array<{ label: string; kind: SourceKind; accept?: string }> = [
  { label: "Video", kind: "video", accept: "video/*" },
  { label: "Image", kind: "image", accept: "image/*" },
  { label: "Audio", kind: "audio", accept: "audio/*" },
  { label: "Audio Input", kind: "audio-input" },
  { label: "List", kind: "list", accept: ".m3u,.m3u8" },
  { label: "Image Sequence / Stinger", kind: "image-sequence" },
  { label: "PowerPoint", kind: "powerpoint", accept: ".ppt,.pptx" },
  { label: "PDF", kind: "pdf", accept: ".pdf" },
  { label: "Camera", kind: "camera" },
  { label: "NDI / Desktop Capture", kind: "ndi" },
  { label: "IP Camera", kind: "ip-camera" },
  { label: "Colour", kind: "colour" },
  { label: "Timer", kind: "timer" },
  { label: "Title / Lower Third", kind: "title" },
  { label: "Composition", kind: "composition" },
  { label: "Video Delay", kind: "video-delay" },
  { label: "Web Browser", kind: "web-browser" }
];

export function App() {
  const [decks, setDecks] = useState(initialDecks);
  const [program, setProgram] = useState({ deckId: "deck-1", layerId: "layer-1" });
  const [preview, setPreview] = useState({ deckId: "deck-1", layerId: "layer-2" });
  const [selectedLayer, setSelectedLayer] = useState({ deckId: "deck-1", layerId: "layer-2" });
  const [media, setMedia] = useState({ fullscreen: true, stream: true, record: false, virtual: false });
  const [workspace, setWorkspace] = useState({ library: 190, properties: 220 });
  const [faders, setFaders] = useState<Record<string, { master: number; audio: number; opacity: number }>>(
    Object.fromEntries(initialDecks.map((deck) => [deck.id, { master: 100, audio: 100, opacity: 100 }]))
  );
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const libraryEngine = useMemo(() => new LibraryEngine(), []);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingInputKind, setPendingInputKind] = useState<SourceKind | null>(null);
  const [layerMedia, setLayerMedia] = useState<Record<string, string>>({});
  const [columnState, setColumnState] = useState<Record<number, boolean>>({});
  const [openProperty, setOpenProperty] = useState("General");
  const [layerName, setLayerName] = useState("Layer 2");

  const selectPreview = (deckId: string, layerId: string) => {
    setPreview({ deckId, layerId });
    setSelectedLayer({ deckId, layerId });
  };

  const programLayer = (deckId: string, layerId: string) => {
    setProgram({ deckId, layerId });
    setPreview({ deckId, layerId });
    setSelectedLayer({ deckId, layerId });
  };

  const addDeck = (kind: DeckKind) => {
    const number = decks.length + 1;
    const deck: Deck = {
      id: "deck-" + Date.now(),
      name: kind === "audio" ? "Audio Deck " + number : "Deck " + number,
      kind,
      transition: "Fade · 500 ms",
      loop: false,
      layers: makeLayers()
    };
    setDecks((items) => [...items, deck]);
    setFaders((items) => ({ ...items, [deck.id]: { master: 100, audio: 100, opacity: 100 } }));
    setShowAddDeck(false);
  };

  const inferSourceKind = (mime: string, name: string): SourceKind => {
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("audio/")) return "audio";
    if (/\.m3u8?$/i.test(name)) return "list";
    if (/\.pptx?$/i.test(name)) return "powerpoint";
    if (/\.pdf$/i.test(name)) return "pdf";
    return "video";
  };

  const registerFiles = (files: File[], kind?: SourceKind) => {
    const sources = files.map((file, index) => {
      const source: Source = {
        id: "source-" + Date.now() + "-" + index,
        name: file.name,
        kind: kind ?? inferSourceKind(file.type, file.name),
        uri: URL.createObjectURL(file),
        metadata: { fileType: file.type, size: file.size }
      };
      libraryEngine.add(source);
      return source;
    });
    if (sources.length) setLibraryItems((items) => [...items, ...sources]);
  };

  const addInternalInput = (kind: SourceKind) => {
    const source: Source = {
      id: "source-" + Date.now(),
      name: kind === "colour" ? "Colour" : kind === "timer" ? "Timer" : kind,
      kind
    };
    libraryEngine.add(source);
    setLibraryItems((items) => [...items, source]);
    setShowAddInput(false);
  };

  const addInput = (kind: SourceKind, accept?: string) => {
    if (["colour", "timer", "title", "composition", "video-delay", "web-browser", "audio-input", "camera", "ndi", "ip-camera"].includes(kind)) {
      addInternalInput(kind);
      return;
    }
    setPendingInputKind(kind);
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept ?? "";
      fileInputRef.current.click();
    }
  };

  const handleLibraryDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    registerFiles(Array.from(event.dataTransfer.files));
  };

  const handleInputFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) registerFiles(files, pendingInputKind ?? undefined);
    event.target.value = "";
    setPendingInputKind(null);
    setShowAddInput(false);
  };

  const handleLayerDrop = (event: DragEvent<HTMLButtonElement>, deckId: string, layerId: string) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/library-id");
    const item = libraryItems.find((entry) => entry.id === itemId);
    if (item) {
      setLayerMedia((items) => ({ ...items, [deckId + ":" + layerId]: item.id }));
    }
  };

  const openInputDialog = () => setShowAddInput(true);

  const updateFader = (deckId: string, key: "master" | "audio" | "opacity", value: number) => {
    setFaders((items) => ({ ...items, [deckId]: { ...items[deckId], [key]: value } }));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div><strong>VisCo</strong><span>Visual Control & Live Production System</span></div>
        </div>
        <nav className="topnav">
          <button>File</button><button>Edit</button><button>View</button><button>Output</button><button>Settings</button>
        </nav>
        <div className="status"><span className="status-dot" /> SYSTEM READY</div>
      </header>

      <section
        className="workspace"
        style={{ gridTemplateColumns: workspace.library + "px minmax(600px, 1fr) " + workspace.properties + "px" }}
      >
        <aside className="library panel">
          <div className="panel-title"><span>LIBRARY</span></div>
          <div className="search">Search media…</div>
          <div
            className="library-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleLibraryDrop}
          >
            <button className="add-input-button" onClick={openInputDialog}>+ ADD INPUT</button>

            {libraryItems.length === 0 ? (
              <div className="library-empty">Drag & drop files here</div>
            ) : (
              <div className="library-items">
                {libraryItems.map((item) => (
                  <button
                    className="library-item"
                    key={item.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/library-id", item.id)}
                  >
                    <span className="library-icon">{item.name.slice(0, 1).toUpperCase()}</span>
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="center">
          <div className="monitors">
            <div className="monitor">
              <div className="monitor-head"><span>PREVIEW</span><span className="monitor-source">{preview.deckId} / {preview.layerId}</span></div>
              <div className="preview-canvas"><span>PREVIEW</span></div>
            </div>
            <div className="monitor program-monitor">
              <div className="monitor-head"><span>PROGRAM</span><span className="on-air">ON AIR</span></div>
              <div className="program-canvas"><span>PROGRAM</span></div>
            </div>
          </div>

          <div className="decks">
            <div className="deck-toolbar">
              <button className="add-deck-button" onClick={() => setShowAddDeck((value) => !value)}>+ Add Deck</button>
              {showAddDeck && (
                <div className="add-deck-menu">
                  <button onClick={() => addDeck("visual")}><b>Visual Deck</b><small>Video, image, capture & composition</small></button>
                  <button onClick={() => addDeck("audio")}><b>Audio Deck</b><small>Music and background audio</small></button>
                </div>
              )}
            </div>

            <div className="column-header">
              <div className="column-spacer" />
              {Array.from({ length: 8 }, (_, index) => (
                <button
                  key={index}
                  className={columnState[index + 1] ? "column-toggle active" : "column-toggle"}
                  onClick={() => setColumnState((items) => ({ ...items, [index + 1]: !items[index + 1] }))}
                  title={"Toggle column " + (index + 1)}
                >
                  L{index + 1}
                </button>
              ))}
            </div>

            {decks.map((deck) => {
              const values = faders[deck.id];
              return (
                <section className={"deck-row " + (deck.kind === "audio" ? "audio-deck" : "")} key={deck.id}>
                  <div className="deck-rail">
                    <div className="deck-heading">
                      <span>{deck.name}</span>
                      <small>{deck.kind.toUpperCase()}</small>
                    </div>
                    <div className="deck-faders">
                      {([["M", "master"], ["A", "audio"], ["V", "opacity"]] as const).map(([label, key]) => (
                        <label className="fader" key={label}>
                          <span>{label}</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={values[key]}
                            onChange={(event) => updateFader(deck.id, key, Number(event.target.value))}
                            title={label + " fader"}
                          />
                          <small>{values[key]}</small>
                        </label>
                      ))}
                    </div>
                    <div className="deck-actions">
                      <button className="deck-action" title="Deck settings">⚙</button>
                    </div>
                  </div>

                  <div className="layer-strip">
                    {deck.layers.map((layer, index) => {
                      const isProgram = deck.kind === "visual" && program.deckId === deck.id && program.layerId === layer.id;
                      const isPreview = deck.kind === "visual" && preview.deckId === deck.id && preview.layerId === layer.id;
                      const mediaId = layerMedia[deck.id + ":" + layer.id];
                      const mediaName = mediaId ? libraryEngine.get(mediaId).name : undefined;
                      return (
                        <article className={"layer-card " + (isProgram ? "program " : "") + (isPreview ? "preview" : "")} key={layer.id}>
                          <button className={"layer-name " + (isPreview ? "preview-name" : "")} onClick={() => selectPreview(deck.id, layer.id)}>
                            <span>{layer.name}</span>{isPreview && <small>PREVIEW</small>}
                          </button>
                          <button
                            className="layer-box"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleLayerDrop(event, deck.id, layer.id)}
                            onClick={() => deck.kind === "visual" && programLayer(deck.id, layer.id)}
                          >
                            <div className="layer-thumb"><span>{mediaName || (deck.kind === "audio" ? "AUDIO" : layer.name)}</span></div>
                            <div className="layer-tools"><span>◌</span><span className={isProgram ? "eye on" : "eye"}>◉</span></div>
                            <div className="overlay-number">{index + 1}</div>
                            {isProgram && <div className="program-badge">PROGRAM</div>}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <aside className="properties panel">
          <div className="panel-title"><span>PROPERTIES</span><span className="muted">{selectedLayer.layerId}</span></div>
          {["General", "Playback", "Transform", "Layering", "Audio", "Trigger", "Slice", "Advanced"].map((item) => (
            <div className="property-section" key={item}>
              <button className={openProperty === item ? "property-row active" : "property-row"} onClick={() => setOpenProperty(openProperty === item ? "" : item)}>
                <span>{item}</span><span>{openProperty === item ? "⌄" : "›"}</span>
              </button>
              {openProperty === item && (
                <div className="property-content">
                  {item === "General" && <><label>Name<input value={layerName} onChange={(event) => setLayerName(event.target.value)} /></label><label>Type<div className="property-value">Media Layer</div></label></>}
                  {item === "Playback" && <><div className="property-buttons"><button>▶ Play</button><button>Ⅱ Pause</button><button>↻ Loop</button></div><label>Speed<input type="range" min="0" max="200" defaultValue="100" /></label></>}
                  {item === "Transform" && <div className="property-grid">{["X","Y","Scale X","Scale Y","Rotation"].map((field) => <label key={field}>{field}<input type="number" defaultValue={field.includes("Scale") ? 100 : 0} /></label>)}</div>}
                  {item === "Layering" && <div className="property-grid">{["Order","Opacity","Blend"].map((field) => <label key={field}>{field}<input defaultValue={field === "Blend" ? "Normal" : "100"} /></label>)}</div>}
                  {item === "Audio" && <><label>Volume<input type="range" min="0" max="100" defaultValue="100" /></label><label>Pan<input type="range" min="-100" max="100" defaultValue="0" /></label></>}
                  {item === "Trigger" && <div className="property-empty">No triggers assigned to this layer.</div>}
                  {item === "Slice" && <div className="property-buttons"><button>Add Slice</button><button>Reset Slice</button></div>}
                  {item === "Advanced" && <div className="property-empty">Advanced layer options.</div>}
                </div>
              )}
            </div>
          ))}
        </aside>
      </section>

      <footer className="media-bar">
        <div className="output-group">
          <div className="output-control">
            <button className={media.fullscreen ? "output-button enabled" : "output-button"} onClick={() => setMedia({ ...media, fullscreen: !media.fullscreen })}>FULLSCREEN</button>
            <button className="output-gear" title="Fullscreen settings">⚙</button>
          </div>
          <div className="output-control">
            <button className={media.stream ? "output-button enabled" : "output-button"} onClick={() => setMedia({ ...media, stream: !media.stream })}>STREAM</button>
            <button className="output-gear" title="Stream settings">⚙</button>
          </div>
          <div className="output-control">
            <button className={media.record ? "output-button enabled" : "output-button"} onClick={() => setMedia({ ...media, record: !media.record })}>RECORD</button>
            <button className="output-gear" title="Record settings">⚙</button>
          </div>
          <button className={media.virtual ? "output-button enabled" : "output-button"} onClick={() => setMedia({ ...media, virtual: !media.virtual })}>VIRTUAL OUT</button>
        </div>
        <div className="resolution"><span>1920 × 1080</span><span>60 FPS</span></div>
      </footer>

      <div className="resize-handle left-handle" onMouseDown={(event) => {
        const start = event.clientX;
        const startWidth = workspace.library;
        const move = (current: MouseEvent) => setWorkspace((items) => ({ ...items, library: Math.max(150, Math.min(340, startWidth + current.clientX - start)) }));
        const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }} />
      <div className="resize-handle right-handle" onMouseDown={(event) => {
        const start = event.clientX;
        const startWidth = workspace.properties;
        const move = (current: MouseEvent) => setWorkspace((items) => ({ ...items, properties: Math.max(180, Math.min(360, startWidth - (current.clientX - start))) }));
        const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }} />
      {showAddInput && (
        <div className="modal-backdrop" onClick={() => setShowAddInput(false)}>
          <div className="add-input-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><strong>ADD INPUT</strong><span>Select the type of source to add to the Library</span></div><button onClick={() => setShowAddInput(false)}>×</button></div>
            <div className="input-choice-grid">
              {inputTypes.map((item) => (
                <button className="input-choice" key={item.kind} onClick={() => addInput(item.kind, item.accept)}>
                  <strong>{item.label}</strong>
                  <small>{item.accept ? "Add source files to Library" : "Configure source in Properties"}</small>
                </button>
              ))}
              <input ref={fileInputRef} type="file" multiple hidden onChange={handleInputFiles} />
            </div>
            <div className="modal-drop">Or drag files directly into Library</div>
          </div>
        </div>
      )}
    </main>
  );
}
