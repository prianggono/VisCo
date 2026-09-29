import { describe, expect, it } from "vitest";
import { OutputTransportRegistry, type OutputTransport } from "../src/engine/output-transport.js";
import { ResilientFrameSourceManager } from "../src/engine/resilient-frame-source.js";
import { resolveMediaCompatibility, type MediaCompatibilityCache } from "../src/engine/media-compatibility-cache.js";
import { ControlMappingEngine } from "../src/engine/control-mapping.js";
import { SourcePlaybackEngine } from "../src/engine/source-playback.js";
import { createArtNetFrame, ArtNetLedOutput, type ArtNetLedOutputBridge } from "../src/native/artnet-led-output.js";
import { WindowsDisplayOutput, type WindowsDisplayOutputBridge } from "../src/native/windows-display-output.js";
import { D3D11RendererRuntime, type D3D11RendererBridge } from "../src/native/d3d11-renderer.js";
import { WindowsMediaOutput, type MediaOutputBridge } from "../src/native/media-output.js";
import { VirtualOutput, type VirtualOutputBridge } from "../src/native/virtual-output.js";
import { WindowsVideoRuntime, type WindowsVideoCaptureBridge } from "../src/native/windows-video-runtime.js";
import { NativeMediaDecoder, type NativeMediaDecoderBridge } from "../src/native/media-decoder.js";
import { NativeNetworkFrameSource, type NetworkFrameSourceBridge } from "../src/native/network-frame-source.js";

describe("runtime contracts", () => {
  it("isolates a failed output transport", async () => {
    const registry = new OutputTransportRegistry();
    const make = (id: string, fail: boolean): OutputTransport => ({
      id, kind: "display",
      async connect() {}, async disconnect() {},
      async send() { if (fail) throw new Error("boom"); },
      getStatus: () => ({ connected: !fail, error: fail ? "boom" : null })
    });
    registry.register(make("ok", false));
    registry.register(make("bad", true));
    const result = await registry.send({
      source: { compositionId: "c", width: 1920, height: 1080, fps: 30, frameNumber: 1 },
      sceneId: "s", layerIds: []
    });
    expect(result).toEqual([
      { id: "ok", ok: true },
      { id: "bad", ok: false, error: "boom" }
    ]);
  });

  it("keeps a missing frame provider recoverable", async () => {
    const manager = new ResilientFrameSourceManager([]);
    const state = await manager.attach({ id: "cam-1", name: "Camera", kind: "camera", transport: "native" });
    expect(state.available).toBe(false);
    expect(state.error).toContain("No frame source provider");
    expect((await manager.retry()).available).toBe(false);
  });

  it("caches compatibility resolution without blocking native media", async () => {
    const store = new Map<string, any>();
    const cache: MediaCompatibilityCache = {
      get: async (uri) => store.get(uri) ?? null,
      put: async (entry) => { store.set(entry.sourceUri, entry); },
      remove: async (uri) => { store.delete(uri); }
    };
    const native = await resolveMediaCompatibility("file://native.mp4", true, cache);
    expect(native.cachedUri).toBe(native.sourceUri);
    const first = await resolveMediaCompatibility("file://legacy.mov", false, cache);
    const second = await resolveMediaCompatibility("file://legacy.mov", false, cache);
    expect(second.cachedUri).toBe(first.cachedUri);
    expect(store.size).toBe(1);
  });

  it("supports multiple enabled control bindings for the same input", () => {
    const mapping = new ControlMappingEngine();
    const action = { type: "program" as const, target: { deckId: "d", layerId: "l" } };
    mapping.register({ id: "a", input: { kind: "keyboard", code: "F1" }, action, enabled: true });
    mapping.register({ id: "b", input: { kind: "keyboard", code: "F1" }, action, enabled: true });
    expect(mapping.match({ kind: "keyboard", code: "F1" }).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("clamps playback seeking and rejects invalid speed", () => {
    const playback = new SourcePlaybackEngine();
    playback.register("source-1", 1000);
    expect(playback.seek("source-1", 1500).positionMs).toBe(1000);
    expect(() => playback.setSpeed("source-1", 0)).toThrow();
  });

  it("validates Art-Net payload boundaries", async () => {
    let sent = false;
    const bridge: ArtNetLedOutputBridge = {
      async connect() {}, async disconnect() {},
      async send() { sent = true; },
      getStatus: () => ({ connected: true, error: null })
    };
    const output = new ArtNetLedOutput({ id: "led", host: "127.0.0.1", universe: 0 }, bridge);
    await output.send(createArtNetFrame(0, new Uint8Array(512)));
    expect(sent).toBe(true);
    expect(() => output.send(createArtNetFrame(0, new Uint8Array(513)))).toThrow();
  });

  it("guards the D3D11 native renderer boundary", async () => {
    let rendered = false;
    const bridge: D3D11RendererBridge = {
      async initialize() { return { backend: "d3d11", maxTextureSize: 8192, supportsVideo: true, supportsCompute: true }; },
      async render() { rendered = true; },
      async resize() {},
      async flush() {},
      async dispose() {}
    };
    const runtime = new D3D11RendererRuntime(bridge);
    await expect(runtime.render({ width: 1920, height: 1080, fps: 30, layerIds: [] })).rejects.toThrow();
    await runtime.initialize();
    await runtime.render({ width: 1920, height: 1080, fps: 30, layerIds: ["layer-1"] });
    expect(rendered).toBe(true);
    await expect(runtime.render({ width: 9000, height: 1080, fps: 30, layerIds: [] })).rejects.toThrow();
    await runtime.dispose();
  });

  it("validates stream/record/virtual media output configuration", async () => {
    let submitted = false;
    const bridge: MediaOutputBridge = {
      async connect() {}, async disconnect() {},
      async submit() { submitted = true; },
      getStatus: () => ({ connected: true, running: true, frames: 1, error: null })
    };
    const output = new WindowsMediaOutput({ id: "stream", kind: "stream", width: 1920, height: 1080, fps: 30, destination: "rtmp://example" }, bridge);
    await output.submit({ width: 1920, height: 1080, frameNumber: 1, compositionId: "comp-1" });
    expect(submitted).toBe(true);
    expect(() => new WindowsMediaOutput({ id: "", kind: "record", width: 1920, height: 1080, fps: 30 }, bridge)).toThrow();
  });

  it("guards native media decoder lifecycle", async () => {
    let opened = false;
    const bridge: NativeMediaDecoderBridge = {
      async open() { opened = true; }, async close() { opened = false; },
      async play() {}, async pause() {}, async seek() {},
      async read() { return null; },
      getStatus: () => ({ opened, playing: false, durationMs: null, positionMs: 0, error: null })
    };
    const decoder = new NativeMediaDecoder(bridge);
    await expect(decoder.play()).rejects.toThrow();
    await decoder.open({ uri: "file://clip.mp4", backend: "media-foundation" });
    expect(decoder.getStatus().opened).toBe(true);
    await decoder.close();
    expect(decoder.getStatus().opened).toBe(false);
  });


  it("protects referenced library media and supports search/sort", async () => {
    const { LibraryEngine } = await import("../src/engine/library-engine.js");
    const library = new LibraryEngine([{ id: "b", name: "Beta", kind: "video" }, { id: "a", name: "Alpha", kind: "image" }]);
    expect(library.search("alp").map((item) => item.id)).toEqual(["a"]);
    expect(library.sort("name").map((item) => item.id)).toEqual(["a", "b"]);
    expect(library.canRemove("a", [{ id: "layer-1", name: "Layer", sourceId: "a" }])).toBe(false);
    expect(() => library.removeIfUnused("a", [{ id: "layer-1", name: "Layer", sourceId: "a" }])).toThrow(/still used/);
    library.removeIfUnused("a", []);
    expect(library.has("a")).toBe(false);
  });

  it("keeps NDI, OMT and IP camera behind one native network boundary", async () => {
    const bridge: NetworkFrameSourceBridge = {
      async probe() { return { available: true }; },
      async create(device) { return { id: device.id, device, async start() {}, async stop() {}, getStatus: () => ({ id: device.id, running: false, frameCount: 0, lastFrameTimestampUs: null }), subscribe: () => () => undefined }; }
    };
    const source = new NativeNetworkFrameSource(bridge);
    for (const kind of ["ndi", "omt", "ip-camera"] as const) {
      const device = { id: kind + "-1", name: kind, kind, transport: "network" as const };
      expect(source.supports(device)).toBe(true);
      expect((await source.probe(device)).available).toBe(true);
      expect((await source.create(device)).id).toBe(device.id);
    }
  });

  it("selects and safely closes Windows camera/capture devices", async () => {
    let opened = false;
    const bridge: WindowsVideoCaptureBridge = {
      async enumerate(kind) { return [{ device: { id: "cam-1", name: "Camera", kind, transport: "native" } }]; },
      async open() { opened = true; },
      async close() { opened = false; },
      async read() { return null; },
      getStatus: () => ({ running: opened, connected: true, frames: 0, error: null })
    };
    const runtime = new WindowsVideoRuntime(bridge);
    await runtime.select("camera", "cam-1");
    await runtime.open({ device: { id: "cam-1", name: "Camera", kind: "camera", transport: "native" } });
    expect(runtime.getStatus().running).toBe(true);
    await runtime.close();
    expect(runtime.getStatus().running).toBe(false);
  });

  it("keeps virtual output separate from physical display output", async () => {
    let submitted = false;
    const bridge: VirtualOutputBridge = {
      async connect() {}, async disconnect() {},
      async submit() { submitted = true; },
      getStatus: () => ({ connected: true, running: true, error: null })
    };
    const output = new VirtualOutput({ id: "virtual", name: "VisCo Virtual", width: 1280, height: 720, fps: 30 }, bridge);
    await output.submit({ source: { compositionId: "comp-1", width: 1280, height: 720, fps: 30, frameNumber: 1 }, sceneId: "scene-3", layerIds: [] });
    expect(submitted).toBe(true);
  });

  it("keeps HDMI output as a separate display transport", async () => {
    let presented = false;
    const bridge: WindowsDisplayOutputBridge = {
      async connect() {}, async disconnect() {},
      async present() { presented = true; },
      getStatus: () => ({ connected: true, error: null })
    };
    const output = new WindowsDisplayOutput(
      { id: "display-1", displayId: "DISPLAY1", fullscreen: true, width: 1920, height: 1080, fps: 30 },
      bridge
    );
    await output.present({ width: 1920, height: 1080, frameNumber: 1 });
    expect(presented).toBe(true);
    expect(() => output.present({ width: 0, height: 1080, frameNumber: 2 })).toThrow();
  });
});
