import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { LibraryEngine } from "../engine/library-engine.js";
import { DeckRuntime } from "../engine/deck-runtime.js";
import { OutputEngine } from "../engine/output-engine.js";
import { ProgramEngine } from "../engine/program-engine.js";
import { DeckProgramController } from "../engine/deck-program-controller.js";
import type { Deck as DomainDeck, Layer, Transition } from "../domain/deck.js";
import type { Source, SourceKind } from "../domain/source.js";
type LibraryItem = Source;
type DeckKind = "visual" | "audio";
type Deck = DomainDeck & { kind: DeckKind };

const makeLayers = (): Layer[] =>
  Array.from({ length: 8 }, (_, index) => ({
    id: "layer-" + (index + 1),
    name: "Layer " + (index + 1)
  }));

const initialDecks: Deck[] = [
  { id: "deck-1", name: "Deck 1", kind: "visual", transition: { type: "fade", durationMs: 500 }, loop: true, layers: makeLayers() },
  { id: "deck-2", name: "Deck 2", kind: "visual", transition: { type: "cut", durationMs: 0 }, loop: false, layers: makeLayers() }
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
  const [selectedLayer, setSelectedLayer] = useState({ deckId: "deck-1", layerId: "layer-2" });

  const [workspace, setWorkspace] = useState({ library: 190, properties: 220 });
  const outputEngine = useMemo(() => {
    const engine = new OutputEngine();
    engine.register({ id: "fullscreen", kind: "display", enabled: true });
    engine.register({
      id: "media-output",
      kind: "media",
      enabled: true,
      media: { compositionId: "default", resolution: [1920, 1080], fps: 29.97, streaming: true, recording: false, virtual: false }
    });
    return engine;
  }, []);
  const [, setOutputRevision] = useState(0);

  const deckRuntime = useMemo(() => {
    const runtime = new DeckRuntime();
    initialDecks.forEach((deck) => runtime.register(deck));
    return runtime;
  }, []);
  const [, setRuntimeRevision] = useState(0);
  const programEngine = useMemo(() => new ProgramEngine(), []);
  const deckProgramController = useMemo(() => new DeckProgramController(deckRuntime, programEngine, outputEngine), [deckRuntime, programEngine, outputEngine]);
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const libraryEngine = useMemo(() => new LibraryEngine(), []);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingInputKind, setPendingInputKind] = useState<SourceKind | null>(null);
  const [selectedInputKind, setSelectedInputKind] = useState<SourceKind>("video");
  const [openProperty, setOpenProperty] = useState("General");

  const selectPreview = (deckId: string, layerId: string) => {
    const deck = decks.find((item) => item.id === deckId);
    if (!deck) return;
    deckProgramController.preview(deck, layerId);
    setRuntimeRevision((value) => value + 1);
    setSelectedLayer({ deckId, layerId });
  };

  const programLayer = (deckId: string, layerId: string) => {
    const deck = decks.find((item) => item.id === deckId);
    if (!deck || !deckRuntime.getState(deckId).masterEnabled) return;
    deckProgramController.program(deck, layerId);
    setRuntimeRevision((value) => value + 1);
    setSelectedLayer({ deckId, layerId });
  };

  const getPreviewRef = () => {
    for (const deck of decks) {
      const layerId = deckRuntime.getState(deck.id).previewLayerId;
      if (layerId) return { deckId: deck.id, layerId };
    }
    return { deckId: "", layerId: "" };
  };

  const getProgramRef = () => {
    const state = programEngine.getState("default").source;
    return state ?? { deckId: "", layerId: "" };
  };

  const selectedDeck = decks.find((deck) => deck.id === selectedLayer.deckId);
  const selectedLayerModel = selectedDeck?.layers.find((layer) => layer.id === selectedLayer.layerId);
  const updateSelectedLayer = (patch: Partial<Layer>) => {
    setDecks((current) => current.map((deck) =>
      deck.id !== selectedLayer.deckId
        ? deck
        : {
            ...deck,
            layers: deck.layers.map((layer) =>
              layer.id === selectedLayer.layerId ? { ...layer, ...patch } : layer
            )
          }
    ));
    setRuntimeRevision((value) => value + 1);
  };

  const updateSelectedDocument = (patch: Partial<NonNullable<Source["document"]>>) => {
    if (!selectedLayerModel?.sourceId) return;
    const source = libraryEngine.get(selectedLayerModel.sourceId);
    if (source.kind !== "powerpoint" && source.kind !== "pdf") return;
    libraryEngine.update({ ...source, document: { ...(source.document ?? { currentPage: 1, autoNext: true, durationMs: 5000, autoFirst: false, loop: false }), ...patch } });
    setLibraryItems(libraryEngine.list());
    setRuntimeRevision((value) => value + 1);
  };

  const updateSelectedSourceList = (patch: Partial<NonNullable<Source["list"]>>) => {
    if (!selectedLayerModel?.sourceId) return;
    const source = libraryEngine.get(selectedLayerModel.sourceId);
    if (source.kind !== "list") return;
    libraryEngine.update({ ...source, list: { ...(source.list ?? { itemIds: [], shuffle: false, playOut: true, autoNext: true, autoFirst: false, loop: false, interlaced: false }), ...patch } });
    setLibraryItems(libraryEngine.list());
    setRuntimeRevision((value) => value + 1);
  };

  const updateSelectedPlayback = (patch: Partial<NonNullable<Layer["playback"]>>) => {
    if (!selectedDeck || !selectedLayerModel) return;
    const current = deckRuntime.getState(selectedDeck.id).playback.get(selectedLayerModel.id);
    if (!current) return;
    deckRuntime.setLayerPlayback(selectedDeck.id, selectedLayerModel.id, patch);
    setRuntimeRevision((value) => value + 1);
  };

  const updateSelectedTransform = (patch: Partial<NonNullable<Layer["transform"]>>) => {
    if (!selectedLayerModel) return;
    const transform = {
      x: 0,
      y: 0,
      scaleX: 100,
      scaleY: 100,
      rotation: 0,
      opacity: 100,
      ...selectedLayerModel.transform,
      ...patch
    };
    updateSelectedLayer({ transform });
  };

  const addDeck = (kind: DeckKind) => {
    const number = decks.length + 1;
    const deck: Deck = {
      id: "deck-" + Date.now(),
      name: kind === "audio" ? "Audio Deck " + number : "Deck " + number,
      kind,
      transition: { type: "fade", durationMs: 500 } as Transition,
      loop: false,
      layers: makeLayers()
    };
    setDecks((items) => [...items, deck]);
    deckRuntime.register(deck);
    setShowAddDeck(false);
  };

  const sourceKindIsList = (kind: SourceKind): boolean => kind === "list";
  const sourceKindIsDocument = (kind: SourceKind): boolean => kind === "powerpoint" || kind === "pdf";

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
        metadata: { fileType: file.type, size: file.size },
        ...(sourceKindIsList(kind ?? inferSourceKind(file.type, file.name)) ? {
          list: { itemIds: [], shuffle: false, playOut: true, autoNext: true, autoFirst: false, loop: false, interlaced: false }
        } : {}),
        ...(sourceKindIsDocument(kind ?? inferSourceKind(file.type, file.name)) ? {
          document: { currentPage: 1, autoNext: true, durationMs: 5000, autoFirst: false, loop: false }
        } : {})
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
      setDecks((current) => current.map((deck) =>
        deck.id !== deckId
          ? deck
          : {
              ...deck,
              layers: deck.layers.map((layer) =>
                layer.id === layerId ? { ...layer, sourceId: item.id } : layer
              )
            }
      ));
    }
  };

  const openInputDialog = () => {
    setSelectedInputKind("video");
    setShowAddInput(true);
  };

  const outputState = outputEngine.getState("media-output");
  const mediaSettings = outputState.target.media!;
  const fullscreenState = outputEngine.getState("fullscreen");

  const toggleOutput = (targetId: string) => {
    const state = outputEngine.getState(targetId);
    outputEngine.setEnabled(targetId, !state.target.enabled);
    setOutputRevision((value) => value + 1);
  };

  const toggleMediaFeature = (feature: "stream" | "record" | "virtual") => {
    outputEngine.setMediaFeature("media-output", feature, !mediaSettings[feature === "stream" ? "streaming" : feature === "record" ? "recording" : "virtual"]);
    setOutputRevision((value) => value + 1);
  };

  const updateFader = (deckId: string, key: "master" | "audio" | "opacity", value: number) => {
    if (key === "master") deckRuntime.setMasterEnabled(deckId, value > 0);
    if (key === "audio") deckRuntime.setAudioLevel(deckId, value);
    if (key === "opacity") deckRuntime.setVisualLevel(deckId, value);
    setRuntimeRevision((value) => value + 1);
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
              <div className="monitor-head"><span>PREVIEW</span><span className="monitor-source">{getPreviewRef().deckId} / {getPreviewRef().layerId}</span></div>
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
              {Array.from({ length: 8 }, (_, index) => {
                const column = index + 1;
                const active = decks.some((deck) => deckRuntime.getState(deck.id).columns.get(column));
                return (
                  <div className="column-cell" key={column}>
                    <button
                      className={active ? "column-toggle active" : "column-toggle"}
                      onClick={() => {
                        const enabled = !active;
                        decks.forEach((deck) => {
                          if (deck.layers[column - 1]) {
                            deckRuntime.setColumnEnabled(deck.id, column, enabled);
                            deckRuntime.setLayerPlayback(deck.id, deck.layers[column - 1].id, { playing: enabled });
                          }
                        });
                        setRuntimeRevision((value) => value + 1);
                      }}
                      title={"Toggle Column " + column}
                      aria-label={"Toggle Column " + column}
                    >
                      {active ? "■" : "□"}
                    </button>
                    <span>Column {column}</span>
                  </div>
                );
              })}
            </div>

            {decks.map((deck) => {
              const runtimeState = deckRuntime.getState(deck.id);
              const values = { master: runtimeState.masterEnabled ? 100 : 0, audio: runtimeState.audioLevel, opacity: runtimeState.visualLevel };
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
                      const isProgram = deck.kind === "visual" && getProgramRef().deckId === deck.id && getProgramRef().layerId === layer.id;
                      const isPreview = deck.kind === "visual" && getPreviewRef().deckId === deck.id && getPreviewRef().layerId === layer.id;
                      const mediaName = layer.sourceId && libraryEngine.has(layer.sourceId)
                        ? libraryEngine.get(layer.sourceId).name
                        : undefined;
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
                  {item === "General" && <><label>Name<input value={selectedLayerModel?.name ?? ""} onChange={(event) => updateSelectedLayer({ name: event.target.value })} /></label><label>Type<div className="property-value">{selectedLayerModel?.sourceId && libraryEngine.has(selectedLayerModel.sourceId) ? libraryEngine.get(selectedLayerModel.sourceId).kind : "Media Layer"}</div></label></>}
                  {item === "Document" && (() => {
                    const source = selectedLayerModel?.sourceId && libraryEngine.has(selectedLayerModel.sourceId) ? libraryEngine.get(selectedLayerModel.sourceId) : undefined;
                    if (!source || (source.kind !== "powerpoint" && source.kind !== "pdf")) return <div className="property-empty">Select a PowerPoint or PDF source.</div>;
                    const config = source.document ?? { currentPage: 1, autoNext: true, durationMs: 5000, autoFirst: false, loop: false };
                    return <><div className="property-buttons"><button onClick={() => updateSelectedDocument({ currentPage: Math.max(1, config.currentPage - 1) })}>Previous</button><button onClick={() => updateSelectedDocument({ currentPage: config.currentPage + 1 })}>Next</button><button onClick={() => updateSelectedDocument({ autoNext: !config.autoNext })}>{config.autoNext ? "✓ Auto Next" : "Auto Next"}</button></div><label>Duration (ms)<input type="number" min="0" value={config.durationMs} onChange={(event) => updateSelectedDocument({ durationMs: Number(event.target.value) })} /></label><div className="property-buttons"><button onClick={() => updateSelectedDocument({ autoFirst: !config.autoFirst })}>{config.autoFirst ? "✓ Auto First" : "Auto First"}</button><button onClick={() => updateSelectedDocument({ loop: !config.loop })}>{config.loop ? "✓ Loop" : "Loop"}</button></div><label>Page<input type="number" min="1" value={config.currentPage} onChange={(event) => updateSelectedDocument({ currentPage: Number(event.target.value) })} /></label></>;
                  })()}
                  {item === "List" && (() => {
                    const source = selectedLayerModel?.sourceId && libraryEngine.has(selectedLayerModel.sourceId)
                      ? libraryEngine.get(selectedLayerModel.sourceId)
                      : undefined;
                    if (!source || source.kind !== "list") return <div className="property-empty">Select a List source to edit playlist settings.</div>;
                    const config = source.list ?? { itemIds: [], shuffle: false, playOut: true, autoNext: true, autoFirst: false, loop: false, interlaced: false };
                    return <><div className="property-value">Items: {config.itemIds.length}</div><div className="property-buttons"><button onClick={() => updateSelectedSourceList({ shuffle: !config.shuffle })}>{config.shuffle ? "✓ Shuffle" : "Shuffle"}</button><button onClick={() => updateSelectedSourceList({ autoNext: !config.autoNext })}>{config.autoNext ? "✓ Auto Next" : "Auto Next"}</button><button onClick={() => updateSelectedSourceList({ autoFirst: !config.autoFirst })}>{config.autoFirst ? "✓ Auto First" : "Auto First"}</button><button onClick={() => updateSelectedSourceList({ loop: !config.loop })}>{config.loop ? "✓ Loop" : "Loop"}</button></div><div className="property-buttons"><button onClick={() => updateSelectedSourceList({ playOut: !config.playOut })}>{config.playOut ? "✓ Play Out" : "Play Out"}</button><button onClick={() => updateSelectedSourceList({ interlaced: !config.interlaced })}>{config.interlaced ? "✓ Interlaced" : "Interlaced"}</button></div></>;
                  })()}
                  {item === "Playback" && (() => {
                    const playback = selectedDeck && selectedLayerModel
                      ? deckRuntime.getState(selectedDeck.id).playback.get(selectedLayerModel.id)
                      : undefined;
                    return <><div className="property-buttons">
                      <button onClick={() => updateSelectedPlayback({ playing: true })}>▶ Play</button>
                      <button onClick={() => updateSelectedPlayback({ playing: false })}>Ⅱ Pause</button>
                      <button className={playback?.loop ? "active" : ""} onClick={() => updateSelectedPlayback({ loop: !playback?.loop })}>↻ Loop</button>
                    </div><label>Speed<input type="range" min="0" max="200" value={playback?.speed ?? 100} onChange={(event) => updateSelectedPlayback({ speed: Number(event.target.value) })} /></label><div className="property-value">{playback?.playing ? "PLAYING" : "PAUSED"} · {playback?.speed ?? 100}% · {playback?.loop ? "LOOP" : "NO LOOP"}</div></>;
                  })()}
                  {item === "Transform" && <div className="property-grid">
                    {[
                      ["X", "x", 0], ["Y", "y", 0], ["Scale X", "scaleX", 100], ["Scale Y", "scaleY", 100], ["Rotation", "rotation", 0]
                    ].map(([label, key, fallback]) => <label key={String(key)}>{label}<input type="number" value={Number(selectedLayerModel?.transform?.[key as keyof NonNullable<Layer["transform"]>] ?? fallback)} onChange={(event) => updateSelectedTransform({ [key]: Number(event.target.value) })} /></label>)}
                  </div>}
                  {item === "Layering" && <div className="property-grid">
                    <label>Order<input type="number" value={selectedLayerModel?.order ?? 0} onChange={(event) => updateSelectedLayer({ order: Number(event.target.value) })} /></label>
                    <label>Opacity<input type="number" min="0" max="100" value={selectedLayerModel?.transform?.opacity ?? 100} onChange={(event) => updateSelectedTransform({ opacity: Number(event.target.value) })} /></label>
                    <label>Blend<input value={selectedLayerModel?.blendMode ?? "Normal"} onChange={(event) => updateSelectedLayer({ blendMode: event.target.value })} /></label>
                  </div>}
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
            <button className={fullscreenState.target.enabled ? "output-button enabled" : "output-button"} onClick={() => toggleOutput("fullscreen")}>FULLSCREEN</button>
            <button className="output-gear" title="Fullscreen settings">⚙</button>
          </div>
          <div className="output-control">
            <button className={mediaSettings.streaming ? "output-button enabled" : "output-button"} onClick={() => toggleMediaFeature("stream")}>STREAM</button>
            <button className="output-gear" title="Stream settings">⚙</button>
          </div>
          <div className="output-control">
            <button className={mediaSettings.recording ? "output-button enabled" : "output-button"} onClick={() => toggleMediaFeature("record")}>RECORD</button>
            <button className="output-gear" title="Record settings">⚙</button>
          </div>
          <button className={mediaSettings.virtual ? "output-button enabled" : "output-button"} onClick={() => toggleMediaFeature("virtual")}>VIRTUAL OUT</button>
        </div>
        <div className="resolution"><span>1920 × 1080</span><span>{mediaSettings.fps} FPS</span></div>
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
          <div className="add-input-modal input-select-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><strong>INPUT SELECT</strong><span>Choose a source type, then configure or add it to the Library.</span></div>
              <button onClick={() => setShowAddInput(false)}>×</button>
            </div>
            <div className="input-select-body">
              <div className="input-sidebar">
                <div className="input-group-title">MEDIA</div>
                {inputTypes.filter((item) => ["video","image","audio","audio-input","list","image-sequence","powerpoint","pdf"].includes(item.kind)).map((item) => (
                  <button key={item.kind} className={selectedInputKind === item.kind ? "input-side-item active" : "input-side-item"} onClick={() => setSelectedInputKind(item.kind)}>{item.label}</button>
                ))}
                <div className="input-group-title">LIVE / CAPTURE</div>
                {inputTypes.filter((item) => ["camera","ndi","ip-camera"].includes(item.kind)).map((item) => (
                  <button key={item.kind} className={selectedInputKind === item.kind ? "input-side-item active" : "input-side-item"} onClick={() => setSelectedInputKind(item.kind)}>{item.label}</button>
                ))}
                <div className="input-group-title">GENERATED / INTERNAL</div>
                {inputTypes.filter((item) => ["colour","timer","title","composition","video-delay"].includes(item.kind)).map((item) => (
                  <button key={item.kind} className={selectedInputKind === item.kind ? "input-side-item active" : "input-side-item"} onClick={() => setSelectedInputKind(item.kind)}>{item.label}</button>
                ))}
                <div className="input-group-title">EMBEDDED</div>
                {inputTypes.filter((item) => item.kind === "web-browser").map((item) => (
                  <button key={item.kind} className={selectedInputKind === item.kind ? "input-side-item active" : "input-side-item"} onClick={() => setSelectedInputKind(item.kind)}>{item.label}</button>
                ))}
              </div>
              <div className="input-config">
                {(() => {
                  const selected = inputTypes.find((item) => item.kind === selectedInputKind) ?? inputTypes[0];
                  const fileBased = Boolean(selected.accept);
                  return (
                    <>
                      <div className="input-config-title"><strong>{selected.label}</strong><span>{fileBased ? "File source" : "Source configuration"}</span></div>
                      {fileBased ? (
                        <div className="input-file-config">
                          <div className="input-file-drop">Select one or more source files for the Library.</div>
                          <button className="input-browse" onClick={() => addInput(selected.kind, selected.accept)}>BROWSE FILES</button>
                          <div className="input-config-note">Accepted: {selected.accept}</div>
                        </div>
                      ) : (
                        <div className="input-technical-config">
                          {selected.kind === "camera" && <><label>Device<select defaultValue=""><option value="">Auto Detect</option></select></label><label>Video Format<select defaultValue="auto"><option value="auto">Auto</option></select></label><label>FPS<select defaultValue="auto"><option value="auto">Auto / Best Performance</option></select></label></>}
                          {selected.kind === "ndi" && <><label>Source<select defaultValue=""><option value="">Detect NDI sources on LAN</option></select></label><label>Capture<select defaultValue="desktop"><option value="desktop">Desktop / Window</option></select></label></>}
                          {selected.kind === "ip-camera" && <><label>Protocol<select defaultValue="rtsp"><option value="rtsp">RTSP</option><option value="onvif">ONVIF</option></select></label><label>Address<input placeholder="rtsp://..." /></label><label>Latency<select defaultValue="low"><option value="low">Low Latency</option></select></label></>}
                          {selected.kind === "audio-input" && <><label>Device<select defaultValue=""><option value="">Detect audio devices</option></select></label><label>Channels<select defaultValue="stereo"><option value="mono">Mono</option><option value="stereo">Stereo</option></select></label></>}
                          {selected.kind === "web-browser" && <><label>URL<input placeholder="https://..." /></label><label>Resolution<select defaultValue="auto"><option value="auto">Auto</option></select></label></>}
                          {["colour","timer","title","composition","video-delay"].includes(selected.kind) && <div className="input-config-note">This is an internal VisCo source. Create it first, then configure its detailed properties from the Properties panel.</div>}
                          {["camera","ndi","ip-camera","audio-input","web-browser"].includes(selected.kind) && <div className="input-config-note">Technical settings are retained by the source and can be refined later in Properties.</div>}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="input-select-footer">
              <div className="modal-drop">Files can also be dragged directly into Library.</div>
              <div className="input-select-actions">
                <button className="modal-cancel" onClick={() => setShowAddInput(false)}>CANCEL</button>
                {!inputTypes.find((item) => item.kind === selectedInputKind)?.accept && <button className="modal-add" onClick={() => addInternalInput(selectedInputKind)}>ADD TO LIBRARY</button>}
              </div>
            </div>
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleInputFiles} />
          </div>
        </div>
      )}
    </main>
  );
}
