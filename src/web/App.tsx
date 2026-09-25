import { useState } from "react";

type Layer = { id: string; name: string };
type DeckKind = "visual" | "audio";
type Deck = {
  id: string;
  name: string;
  kind: DeckKind;
  transition: string;
  loop: boolean;
  color?: string;
  layers: Layer[];
};

const makeLayers = (): Layer[] =>
  Array.from({ length: 8 }, (_, index) => ({
    id: `layer-${index + 1}`,
    name: `Layer ${index + 1}`
  }));

const initialDecks: Deck[] = [
  { id: "deck-1", name: "Deck 1", kind: "visual", transition: "Fade · 500 ms", loop: true, layers: makeLayers() },
  { id: "deck-2", name: "Deck 2", kind: "visual", transition: "Cut · 0 ms", loop: false, layers: makeLayers() }
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
      id: `deck-${Date.now()}`,
      name: kind === "audio" ? `Audio Deck ${number}` : `Deck ${number}`,
      kind,
      transition: "Fade · 500 ms",
      loop: false,
      layers: makeLayers()
    };
    setDecks([...decks, deck]);
    setFaders({
      ...faders,
      [deck.id]: { master: 100, audio: 100, opacity: 100 }
    });
    setShowAddDeck(false);
  };

  const updateFader = (deckId: string, key: "master" | "audio" | "opacity", value: number) => {
    setFaders({
      ...faders,
      [deckId]: { ...faders[deckId], [key]: value }
    });
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
        style={{ gridTemplateColumns: `${workspace.library}px minmax(600px, 1fr) ${workspace.properties}px` }}
      >
        <aside className="library panel">
          <div className="panel-title"><span>LIBRARY</span><button className="icon-button">+</button></div>
          <div className="search">Search media…</div>
          <div className="library-items">
            {["Video", "Image", "Audio", "Capture", "Composition"].map((item) => (
              <button className="library-item" key={item}><span className="library-icon">{item[0]}</span>{item}</button>
            ))}
          </div>
          <div className="library-add-wrap">
            <button className="add-deck-button" onClick={() => setShowAddDeck(!showAddDeck)}>+ Add Deck</button>
            {showAddDeck && (
              <div className="add-deck-menu">
                <button onClick={() => addDeck("visual")}><b>Visual Deck</b><small>Video, image, capture & composition</small></button>
                <button onClick={() => addDeck("audio")}><b>Audio Deck</b><small>Music and background audio</small></button>
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
            {decks.map((deck) => {
              const values = faders[deck.id];
              return (
                <section className={`deck-row ${deck.kind === "audio" ? "audio-deck" : ""}`} key={deck.id}>
                  <div className="deck-rail">
                    <div className="deck-heading">
                      <span>{deck.name}</span>
                      <small>{deck.kind.toUpperCase()}</small>
                    </div>
                    <div className="deck-faders">
                      {(deck.kind === "visual"
                        ? ([["M", "master"], ["A", "audio"], ["V", "opacity"]] as const)
                        : ([["M", "master"], ["A", "audio"]] as const)
                      ).map(([label, key]) => (
                        <label className="fader" key={label}>
                          <span>{label}</span>
                          <input
                            type="range" min="0" max="100" value={values[key]}
                            onChange={(e) => updateFader(deck.id, key, Number(e.target.value))}
                            title={`${label} fader`}
                          />
                          <small>{values[key]}</small>
                        </label>
                      ))}
                    </div>
                    <div className="deck-actions">
                      <button className="deck-action" title="Play">▶</button>
                      <button className="deck-action" title="Pause">Ⅱ</button>
                      <button className={deck.loop ? "deck-action active" : "deck-action"} title="Loop"
                        onClick={() => setDecks(decks.map((d) => d.id === deck.id ? { ...d, loop: !d.loop } : d))}>↻</button>
                      <button className="deck-action" title="Deck settings">⚙</button>
                    </div>
                  </div>

                  <div className="layer-strip">
                    {deck.layers.map((layer, index) => {
                      const isProgram = deck.kind === "visual" && program.deckId === deck.id && program.layerId === layer.id;
                      const isPreview = deck.kind === "visual" && preview.deckId === deck.id && preview.layerId === layer.id;
                      const selected = selectedLayer.deckId === deck.id && selectedLayer.layerId === layer.id;
                      return (
                        <article className={[`layer-card`, isProgram ? "program" : "", isPreview ? "preview" : "", selected ? "selected" : ""].join(" ")} key={layer.id}>
                          <button className={`layer-name ${isPreview ? "preview-name" : ""}`} onClick={() => selectPreview(deck.id, layer.id)}>
                            <span>{layer.name}</span>{isPreview && <small>PREVIEW</small>}
                          </button>
                          <button className="layer-box" onClick={() => deck.kind === "visual" && programLayer(deck.id, layer.id)}>
                            <div className="layer-thumb"><span>{deck.kind === "audio" ? "AUDIO" : layer.name}</span></div>
                            <div className="layer-tools"><span>◌</span><span className={isProgram ? "eye on" : "eye"}>◉</span></div>
                            <div className="overlay-number">{index + 1}</div>
                            {isProgram && <div className="program-badge">PROGRAM</div>}
                          </button>
                        </article>
                      );
                    })}
                    <button className="add-layer">+</button>
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <aside className="properties panel">
          <div className="panel-title"><span>PROPERTIES</span><span className="muted">{selectedLayer.layerId}</span></div>
          {["General", "Playback", "Transform", "Layering", "Audio", "Trigger", "MIDI", "Slice", "Output", "Advanced"].map((item, index) => (
            <button className={index === 0 ? "property-row active" : "property-row"} key={item}><span>{item}</span><span>›</span></button>
          ))}
        </aside>
      </section>

      <footer className="media-bar">
        <div className="output-group">
          <button className={media.fullscreen ? "output-button enabled" : "output-button"} onClick={() => setMedia({ ...media, fullscreen: !media.fullscreen })}>FULLSCREEN</button>
          <button className={media.stream ? "output-button enabled" : "output-button"} onClick={() => setMedia({ ...media, stream: !media.stream })}>STREAM</button>
          <button className={media.record ? "output-button enabled" : "output-button"} onClick={() => setMedia({ ...media, record: !media.record })}>RECORD</button>
          <button className={media.virtual ? "output-button enabled" : "output-button"} onClick={() => setMedia({ ...media, virtual: !media.virtual })}>VIRTUAL OUT</button>
        </div>
        <div className="output-gear">⚙</div>
        <div className="resolution"><span>1920 × 1080</span><span>60 FPS</span></div>
      </footer>

      <div className="resize-handle left-handle" onMouseDown={(e) => {
        const start = e.clientX; const startWidth = workspace.library;
        const move = (ev: MouseEvent) => setWorkspace((w) => ({ ...w, library: Math.max(150, Math.min(340, startWidth + ev.clientX - start)) }));
        const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      }} />
      <div className="resize-handle right-handle" onMouseDown={(e) => {
        const start = e.clientX; const startWidth = workspace.properties;
        const move = (ev: MouseEvent) => setWorkspace((w) => ({ ...w, properties: Math.max(180, Math.min(360, startWidth - (ev.clientX - start))) }));
        const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      }} />
    </main>
  );
}
