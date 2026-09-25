import { useState } from "react";

type Layer = {
  id: string;
  name: string;
};

type Deck = {
  id: string;
  name: string;
  transition: string;
  loop: boolean;
  layers: Layer[];
};

const makeLayers = (): Layer[] =>
  Array.from({ length: 8 }, (_, index) => ({
    id: `layer-${index + 1}`,
    name: `Layer ${index + 1}`
  }));

const decks: Deck[] = [
  { id: "deck-1", name: "Deck 1", transition: "Fade · 500 ms", loop: true, layers: makeLayers() },
  { id: "deck-2", name: "Deck 2", transition: "Cut · 0 ms", loop: false, layers: makeLayers() }
];

export function App() {
  const [program, setProgram] = useState({ deckId: "deck-1", layerId: "layer-1" });
  const [preview, setPreview] = useState({ deckId: "deck-1", layerId: "layer-2" });
  const [media, setMedia] = useState({ stream: true, record: false, virtual: false });
  const [selectedLayer, setSelectedLayer] = useState({ deckId: "deck-1", layerId: "layer-2" });
  const [loops, setLoops] = useState<Record<string, boolean>>(
    Object.fromEntries(decks.map((deck) => [deck.id, deck.loop]))
  );

  const selectPreview = (deckId: string, layerId: string) => {
    setPreview({ deckId, layerId });
    setSelectedLayer({ deckId, layerId });
  };

  const programLayer = (deckId: string, layerId: string) => {
    setProgram({ deckId, layerId });
    setPreview({ deckId, layerId });
    setSelectedLayer({ deckId, layerId });
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>VisCo</strong>
            <span>Visual Control & Live Production System</span>
          </div>
        </div>
        <nav className="topnav">
          <button>File</button><button>Edit</button><button>View</button>
          <button>Output</button><button>Settings</button>
        </nav>
        <div className="status"><span className="status-dot" /> SYSTEM READY</div>
      </header>

      <section className="workspace">
        <aside className="library panel">
          <div className="panel-title"><span>LIBRARY</span><button className="icon-button">+</button></div>
          <div className="search">Search media…</div>
          <div className="library-items">
            {["Video", "Image", "Audio", "Capture", "Composition"].map((item) => (
              <button className="library-item" key={item}>
                <span className="library-icon">{item[0]}</span>{item}
              </button>
            ))}
          </div>
        </aside>

        <section className="center">
          <div className="monitors">
            <div className="monitor">
              <div className="monitor-head">
                <span>PREVIEW</span>
                <span className="monitor-source">{preview.deckId} / {preview.layerId}</span>
              </div>
              <div className="preview-canvas"><span>PREVIEW</span></div>
            </div>
            <div className="monitor program-monitor">
              <div className="monitor-head"><span>PROGRAM</span><span className="on-air">ON AIR</span></div>
              <div className="program-canvas"><span>PROGRAM</span></div>
            </div>
          </div>

          <div className="transition-bar">
            <span className="transition-label">TRANSITION</span>
            <span className="transition-select">Fade ▾</span>
            <span className="transition-label">DURATION</span>
            <span className="duration">500 ms</span>
            <button className="transition-button">Cut</button>
            <button className="transition-button active">Auto</button>
            <div className="transition-slider"><span /></div>
            <span className="transition-label">BPM</span>
            <span className="duration">120</span>
            <button className="transition-button">TAP</button>
            <button className="toggle-button">LINK</button>
          </div>

          <div className="decks">
            {decks.map((deck) => (
              <section className="deck-row" key={deck.id}>
                <div className="deck-rail">
                  <div className="deck-title">{deck.name}</div>
                  <button className="deck-control">A</button>
                  <button className="deck-control">M</button>
                  <button className="deck-control">V</button>
                  <button
                    className={loops[deck.id] ? "deck-control loop active" : "deck-control loop"}
                    title="Loop"
                    onClick={() => setLoops({ ...loops, [deck.id]: !loops[deck.id] })}
                  >↻</button>
                  <button className="deck-control">⚙</button>
                </div>

                <div className="layer-strip">
                  {deck.layers.map((layer) => {
                    const isProgram = program.deckId === deck.id && program.layerId === layer.id;
                    const isPreview = preview.deckId === deck.id && preview.layerId === layer.id;
                    const selected = selectedLayer.deckId === deck.id && selectedLayer.layerId === layer.id;

                    return (
                      <article
                        className={[
                          "layer-card",
                          isProgram ? "program" : "",
                          isPreview ? "preview" : "",
                          selected ? "selected" : ""
                        ].join(" ")}
                        key={layer.id}
                      >
                        <button className="layer-name" onClick={() => selectPreview(deck.id, layer.id)}>
                          <span>{layer.name}</span>
                          {isPreview && <small>PREVIEW</small>}
                        </button>
                        <button className="layer-box" onClick={() => programLayer(deck.id, layer.id)}>
                          <div className="layer-thumb"><span>{layer.name}</span></div>
                          <div className="layer-tools">
                            <span>◌</span>
                            <span className={isProgram ? "eye on" : "eye"}>◉</span>
                          </div>
                          {isProgram && <div className="program-badge">PROGRAM</div>}
                        </button>
                      </article>
                    );
                  })}
                  <button className="add-layer">+</button>
                </div>
              </section>
            ))}
          </div>
        </section>

        <aside className="properties panel">
          <div className="panel-title">
            <span>PROPERTIES</span>
            <span className="muted">{selectedLayer.layerId}</span>
          </div>
          {["General", "Playback", "Transform", "Layering", "Audio", "Trigger", "MIDI", "Slice", "Output", "Advanced"].map((item, index) => (
            <button className={index === 0 ? "property-row active" : "property-row"} key={item}>
              <span>{item}</span><span>›</span>
            </button>
          ))}
        </aside>
      </section>

      <footer className="media-bar">
        <div className="media-target"><span className="footer-label">DISPLAY</span><span className="pill enabled">PROGRAM</span></div>
        <div className="media-target">
          <span className="footer-label">MEDIA OUTPUT</span>
          <button className={media.stream ? "pill enabled" : "pill"} onClick={() => setMedia({ ...media, stream: !media.stream })}>STREAM</button>
          <button className={media.record ? "pill enabled" : "pill"} onClick={() => setMedia({ ...media, record: !media.record })}>RECORD</button>
          <button className={media.virtual ? "pill enabled" : "pill"} onClick={() => setMedia({ ...media, virtual: !media.virtual })}>VIRTUAL</button>
        </div>
        <div className="resolution"><span>1920 × 1080</span><span>60 FPS</span></div>
      </footer>
    </main>
  );
}
