import { useState } from "react";

type Layer = {
  id: string;
  name: string;
};

type Deck = {
  id: string;
  name: string;
  transition: string;
  layers: Layer[];
};

const decks: Deck[] = [
  {
    id: "deck-1",
    name: "Deck 1",
    transition: "Fade · 500 ms",
    layers: [
      { id: "layer-1", name: "Layer 1" },
      { id: "layer-2", name: "Layer 2" },
      { id: "layer-3", name: "Layer 3" },
      { id: "layer-4", name: "Layer 4" }
    ]
  },
  {
    id: "deck-2",
    name: "Deck 2",
    transition: "Cut · 0 ms",
    layers: [
      { id: "layer-1", name: "Layer 1" },
      { id: "layer-2", name: "Layer 2" },
      { id: "layer-3", name: "Layer 3" },
      { id: "layer-4", name: "Layer 4" }
    ]
  }
];

export function App() {
  const [program, setProgram] = useState({ deckId: "deck-1", layerId: "layer-1" });
  const [preview, setPreview] = useState({ deckId: "deck-1", layerId: "layer-2" });
  const [selectedDeck, setSelectedDeck] = useState("deck-1");
  const [media, setMedia] = useState({
    stream: true,
    record: false,
    virtual: false
  });

  const deck = decks.find((item) => item.id === selectedDeck) ?? decks[0];

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
          <button>File</button>
          <button>Edit</button>
          <button>View</button>
          <button>Output</button>
          <button>Settings</button>
        </nav>
        <div className="status">
          <span className="status-dot" /> SYSTEM READY
        </div>
      </header>

      <section className="workspace">
        <aside className="library panel">
          <div className="panel-title">
            <span>LIBRARY</span>
            <button className="icon-button">+</button>
          </div>
          <div className="search">Search media…</div>
          <div className="library-items">
            {["Video", "Image", "Audio", "Capture", "Composition"].map((item) => (
              <button className="library-item" key={item}>
                <span className="library-icon">{item[0]}</span>
                {item}
              </button>
            ))}
          </div>
        </aside>

        <section className="center">
          <div className="monitors">
            <div className="monitor">
              <div className="monitor-head">
                <span>PREVIEW</span>
                <span className="monitor-source">
                  {preview.deckId} / {preview.layerId}
                </span>
              </div>
              <div className="preview-canvas">
                <span>PREVIEW</span>
              </div>
            </div>
            <div className="monitor program-monitor">
              <div className="monitor-head">
                <span>PROGRAM</span>
                <span className="on-air">ON AIR</span>
              </div>
              <div className="program-canvas">
                <span>PROGRAM</span>
              </div>
            </div>
          </div>

          <div className="deck-toolbar">
            <div className="deck-tabs">
              {decks.map((item) => (
                <button
                  className={item.id === selectedDeck ? "deck-tab active" : "deck-tab"}
                  key={item.id}
                  onClick={() => setSelectedDeck(item.id)}
                >
                  {item.name}
                </button>
              ))}
              <button className="deck-add">+</button>
            </div>
            <span className="transition-info">Transition: {deck.transition}</span>
          </div>

          <div className="layers panel">
            <div className="panel-title">
              <span>{deck.name.toUpperCase()} · LAYERS</span>
              <span className="hint">Name = Preview · Box = Program</span>
            </div>
            <div className="layer-grid">
              {deck.layers.map((layer) => {
                const isProgram = program.deckId === deck.id && program.layerId === layer.id;
                const isPreview = preview.deckId === deck.id && preview.layerId === layer.id;

                return (
                  <article className={isProgram ? "layer-card program" : isPreview ? "layer-card preview" : "layer-card"} key={layer.id}>
                    <button
                      className="layer-name"
                      onClick={() => setPreview({ deckId: deck.id, layerId: layer.id })}
                    >
                      {layer.name}
                      {isPreview && <span>PREVIEW</span>}
                    </button>
                    <button
                      className="layer-box"
                      onClick={() => {
                        setProgram({ deckId: deck.id, layerId: layer.id });
                        setPreview({ deckId: deck.id, layerId: layer.id });
                      }}
                    >
                      <div className="layer-thumb">
                        <span>{layer.name}</span>
                      </div>
                      {isProgram && <div className="program-badge">PROGRAM</div>}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="properties panel">
          <div className="panel-title">
            <span>PROPERTIES</span>
            <span className="muted">Layer 2</span>
          </div>
          {["General", "Playback", "Transform", "Layering", "Audio", "Trigger", "MIDI", "Slice", "Output", "Advanced"].map((item, index) => (
            <button className={index === 0 ? "property-row active" : "property-row"} key={item}>
              <span>{item}</span>
              <span>›</span>
            </button>
          ))}
        </aside>
      </section>

      <footer className="media-bar">
        <div className="media-target">
          <span className="footer-label">DISPLAY</span>
          <span className="pill enabled">PROGRAM</span>
        </div>
        <div className="media-target">
          <span className="footer-label">MEDIA OUTPUT</span>
          <button className={media.stream ? "pill enabled" : "pill"} onClick={() => setMedia({ ...media, stream: !media.stream })}>STREAM</button>
          <button className={media.record ? "pill enabled" : "pill"} onClick={() => setMedia({ ...media, record: !media.record })}>RECORD</button>
          <button className={media.virtual ? "pill enabled" : "pill"} onClick={() => setMedia({ ...media, virtual: !media.virtual })}>VIRTUAL</button>
        </div>
        <div className="resolution">
          <span>1920 × 1080</span>
          <span>60 FPS</span>
        </div>
      </footer>
    </main>
  );
}
