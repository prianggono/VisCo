import { describe, expect, it } from "vitest";
import { OutputTransportRegistry, type OutputTransport } from "../src/engine/output-transport.js";
import { ResilientFrameSourceManager } from "../src/engine/resilient-frame-source.js";
import { resolveMediaCompatibility, type MediaCompatibilityCache } from "../src/engine/media-compatibility-cache.js";
import { ControlMappingEngine } from "../src/engine/control-mapping.js";
import { SourcePlaybackEngine } from "../src/engine/source-playback.js";
import { createArtNetFrame, ArtNetLedOutput, type ArtNetLedOutputBridge } from "../src/native/artnet-led-output.js";
import { WindowsDisplayOutput, type WindowsDisplayOutputBridge } from "../src/native/windows-display-output.js";
import { D3D11RendererRuntime, type D3D11RendererBridge } from "../src/native/d3d11-renderer.js";

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
