import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { LibraryEngine } from "../engine/library-engine.js";
import { DeckRuntime } from "../engine/deck-runtime.js";
import { OutputEngine } from "../engine/output-engine.js";
import { ProgramEngine } from "../engine/program-engine.js";
import { DeckProgramController } from "../engine/deck-program-controller.js";
import { AudioEngine } from "../domain/audio.js";
import { AudioOutputRouter } from "../engine/audio-output-router.js";
import { useSliceEditorTool, SliceEditorToolbar } from "./SliceEditorToolbar.js";
import { patchLayerTransform, setLayerScale } from "../engine/layer-transform.js";
import { compositeLayer, compositeProgram } from "../engine/compositor.js";
import { TriggerEngine, type TriggerAction } from "../engine/trigger-engine.js";
import { SceneRuntime } from "../engine/scene-runtime.js";
import { resolveAdvancedOutput } from "../engine/advanced-output.js";
import { addSlicePoint, moveSlicePoint, removeSlicePoint, patchSliceMapping } from "../engine/slice-editor.js";
import { GroupEngine } from "../engine/group-engine.js";
import { SliceCanvas } from "./SliceCanvas.js";
import type { Group } from "../domain/group.js";
import { createProjectSnapshot, serializeProject, parseProject } from "../engine/project-persistence.js";
import { DeviceDiscoveryEngine, NativeDeviceDiscoveryProvider } from "../engine/device-discovery.js";
import { NativeHostHttpBridge } from "../native/native-host-http.js";
import { sourceKindForDevice, type DiscoveredDevice } from "../domain/device.js";
import type { Deck as DomainDeck, Layer, Transition } from "../domain/deck.js";
import type { Slice } from "../domain/slice.js";
import type { Composition } from "../domain/composition.js";
import type { Scene } from "../domain/scene.js";
import type { Source, SourceKind } from "../domain/source.js";
type LibraryItem = Source;
type DeckKind = "visual" | "audio";
type Deck = DomainDeck & { kind: DeckKind };

const makeLayers = (deckKey: string): Layer[] =>
  Array.from({ length: 8 }, (_, index) => ({
    id: deckKey + "-layer-" + (index + 1),
    name: "Layer " + (index + 1)
  }));

const initialDecks: Deck[] = [
  { id: "deck-1", name: "Deck 1", kind: "visual", transition: { type: "fade", durationMs: 500 }, loop: true, layers: makeLayers("deck-1") },
  { id: "deck-2", name: "Deck 2", kind: "visual", transition: { type: "cut", durationMs: 0 }, loop: false, layers: makeLayers("deck-2") }
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
  { label: "Camera / Webcam", kind: "camera" },
  { label: "Video Capture", kind: "video-capture" },
  { label: "NDI", kind: "ndi" },
  { label: "OMT", kind: "omt" },
  { label: "Desktop Capture", kind: "desktop-capture" },
  { label: "IP Camera", kind: "ip-camera" },
  { label: "Colour", kind: "colour" },
  { label: "Timer", kind: "timer" },
  { label: "Title / Lower Third", kind: "title" },
  { label: "Composition", kind: "composition" },
  { label: "Video Delay", kind: "video-delay" },
];

export function App() {
  const [decks, setDecks] = useState(initialDecks);
  const [compositions, setCompositions] = useState<Composition[]>([{
    id: "default", name: "Default Composition",
    format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 },
    deckIds: initialDecks.map((deck) => deck.id), groupIds: [], sliceIds: ["slice-default"], locked: false
  }]);
  const [selectedLayer, setSelectedLayer] = useState({ deckId: "deck-1", layerId: "deck-1-layer-2" });
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState({ library: 190, properties: 220 });
  const outputEngine = useMemo(() => {
    const engine = new OutputEngine();
    engine.register({ id: "display-1", kind: "display", enabled: true, compositionId: "default" });
    engine.register({ id: "display-2", kind: "display", enabled: true, compositionId: "default" });
    engine.register({
      id: "production",
      kind: "media",
      enabled: true,
      compositionId: "default",
      media: { compositionId: "default", resolution: [1920, 1080], fps: 30, streaming: true, recording: false, virtual: false }
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
  const audioEngine = useMemo(() => {
    const engine = new AudioEngine();
    initialDecks.filter((deck) => deck.kind === "audio").forEach((deck) => engine.registerDeck(deck.id));
    return engine;
  }, []);
  const audioOutputRouter = useMemo(() => new AudioOutputRouter(audioEngine, outputEngine), [audioEngine, outputEngine]);
  const programEngine = useMemo(() => new ProgramEngine(), []);
  const deckProgramController = useMemo(() => new DeckProgramController(deckRuntime, programEngine, outputEngine), [deckRuntime, programEngine, outputEngine]);
  const triggerEngine = useMemo(() => new TriggerEngine(), []);
  const defaultScenes: readonly Scene[] = [
    { id: "scene-display-1", name: "Display 1", compositionId: "default", target: { kind: "display", displayId: "display-1" }, enabled: true },
    { id: "scene-display-2", name: "Display 2", compositionId: "default", target: { kind: "display", displayId: "display-2" }, enabled: true },
    { id: "scene-production", name: "Production", compositionId: "default", target: { kind: "production", record: true, stream: true, virtual: true }, enabled: true }
  ];
  const sceneRuntime = useMemo(() => {
    const runtime = new SceneRuntime();
    runtime.replaceAll(defaultScenes);
    runtime.activate("scene-display-1");
    return runtime;
  }, []);
  const [activeSceneId, setActiveSceneId] = useState("scene-display-1");
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [projectMessage, setProjectMessage] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [outputSettings, setOutputSettings] = useState<"stream" | "record" | "display" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [operatorMode, setOperatorMode] = useState(false);
  const [deckSettingsId, setDeckSettingsId] = useState<string | null>(null);
  const libraryEngine = useMemo(() => new LibraryEngine(), []);
  const groupEngine = useMemo(() => new GroupEngine(), []);
  const nativeHost = useMemo(() => new NativeHostHttpBridge(), []);
  const deviceDiscovery = useMemo(() => {
    const engine = new DeviceDiscoveryEngine();
    engine.register(new NativeDeviceDiscoveryProvider(nativeHost));
    return engine;
  }, [nativeHost]);
  const [nativeHostState, setNativeHostState] = useState<"checking" | "online" | "offline">("checking");
  const [nativeCaptureDevice, setNativeCaptureDevice] = useState("");
  const [runtimeAdapters, setRuntimeAdapters] = useState<readonly { name: "NDI" | "OMT" | "ASIO"; available: boolean; library: string; message: string }[]>([]);
  const nativePreviewUrl = "http://127.0.0.1:47822/preview.mjpg";
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryKindFilter, setLibraryKindFilter] = useState<SourceKind | "all">("all");
  const [librarySort, setLibrarySort] = useState<"name" | "kind">("name");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [sceneManagerOpen, setSceneManagerOpen] = useState(false);
  const [, setSceneManagerRevision] = useState(0);
  const [panicArmed, setPanicArmed] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [audioMeters, setAudioMeters] = useState([18, 32]);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [slices, setSlices] = useState<Slice[]>([{
    id: "slice-default",
    name: "Full Composition",
    transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
    mapping: { mode: "rectangle", snapToGrid: true, gridSize: 16 },
    layerRefs: initialDecks.flatMap((deck) => deck.layers.map((layer) => ({ deckId: deck.id, layerId: layer.id }))),
    locked: false
  }]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingInputKind, setPendingInputKind] = useState<SourceKind | null>(null);
  const [selectedInputKind, setSelectedInputKind] = useState<SourceKind>("video");
  const [discoveredDevices, setDiscoveredDevices] = useState<readonly DiscoveredDevice[]>([]);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState("");
  const [discoveryServer, setDiscoveryServer] = useState("");
  const [audioDevices, setAudioDevices] = useState<readonly DiscoveredDevice[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [ipCameraUri, setIpCameraUri] = useState("");
  const [openProperty, setOpenProperty] = useState("General");
  const [sliceGuides, setSliceGuides] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [, setHistoryRevision] = useState(0);
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const [sliceEditorState, setSliceEditorTool] = useSliceEditorTool();

  const compositionIdForDeck = (deckId: string): string =>
    compositions.find((composition) => composition.deckIds.includes(deckId))?.id ?? "default";

  const selectPreview = (deckId: string, layerId: string) => {
    const deck = decks.find((item) => item.id === deckId);
    if (!deck) return;
    deckProgramController.preview(deck, layerId);
    setRuntimeRevision((value) => value + 1);
    setSelectedLayer({ deckId, layerId });
  };

  const programLayer = (deckId: string, layerId: string) => {
    const deck = decks.find((item) => item.id === deckId);
    if (!deck || deckRuntime.getState(deckId).masterLevel <= 0) return;
    const compositionId = compositionIdForDeck(deck.id);
    deckProgramController.program(deck, layerId, { syncOutputs: false, compositionId });
    const scene = sceneRuntime.getActive(compositionId);
    const program = programEngine.getState(compositionId);
    if (scene && program.source) {
      try {
        outputEngine.syncFromScene(scene, program.source);
      } catch (error) {
        setProjectMessage(error instanceof Error ? error.message : "Program output routing failed.");
      }
    }
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
  const recordHistory = () => { try { const snapshot = serializeProject(buildProjectSnapshot()); const history = historyRef.current; if (history.past[history.past.length - 1] !== snapshot) { history.past = [...history.past.slice(-49), snapshot]; history.future = []; setHistoryRevision((v) => v + 1); } } catch {} };
  const updateSelectedLayer = (patch: Partial<Layer>) => {
    recordHistory();
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
    setLibraryItems([...libraryEngine.list()]);
    setRuntimeRevision((value) => value + 1);
  };

  const updateSelectedSourceList = (patch: Partial<NonNullable<Source["list"]>>) => {
    if (!selectedLayerModel?.sourceId) return;
    const source = libraryEngine.get(selectedLayerModel.sourceId);
    if (source.kind !== "list") return;
    libraryEngine.update({ ...source, list: { ...(source.list ?? { itemIds: [], shuffle: false, playOut: true, autoNext: true, autoFirst: false, loop: false, interlaced: false }), ...patch } });
    setLibraryItems([...libraryEngine.list()]);
    setRuntimeRevision((value) => value + 1);
  };

  const updateSelectedAudio = (patch: Partial<NonNullable<Layer["audio"]>>) => {
    if (!selectedLayerModel) return;
    updateSelectedLayer({
      audio: {
        volume: selectedLayerModel.audio?.volume ?? 100,
        pan: selectedLayerModel.audio?.pan ?? 0,
        ...patch
      }
    });
  };

  const addSliceToSelectedLayer = () => {
    if (!selectedLayerModel) return;
    const sliceId = `slice-${Date.now()}`;
    const slice: Slice = {
      id: sliceId,
      name: `Slice ${slices.length + 1}`,
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
      mapping: { mode: "rectangle", snapToGrid: true, gridSize: 16 },
      layerRefs: [{ deckId: selectedLayer.deckId, layerId: selectedLayerModel.id }],
      locked: false
    };
    setSlices((current) => [...current, slice]);
  };

  const resetSelectedLayerSlices = () => {
    if (!selectedLayerModel) return;
    setSlices((current) => current.map((slice) => ({
      ...slice,
      layerRefs: slice.layerRefs.filter((ref) => !(ref.deckId === selectedLayer.deckId && ref.layerId === selectedLayerModel.id))
    })));
  };

  const updateSelectedPlayback = (patch: Partial<NonNullable<Layer["playback"]>>) => {
    if (!selectedDeck || !selectedLayerModel) return;
    const current = deckRuntime.getState(selectedDeck.id).playback.get(selectedLayerModel.id);
    if (!current) return;
    deckRuntime.setLayerPlayback(selectedDeck.id, selectedLayerModel.id, patch);
    setRuntimeRevision((value) => value + 1);
  };

  const updateSelectedTriggers = (triggers: readonly TriggerAction[]) => {
    updateSelectedLayer({ triggers });
  };

  const addSelectedTrigger = (type: TriggerAction["type"]) => {
    if (!selectedLayerModel || !selectedDeck) return;
    let action: TriggerAction;
    if (type === "program") {
      action = { type: "program", target: { deckId: selectedDeck.id, layerId: selectedLayerModel.id } };
    } else if (type === "set-master") {
      action = { type: "set-master", deckId: selectedDeck.id, level: 100 };
    } else if (type === "set-output-enabled") {
      action = { type: "set-output-enabled", outputId: "display-1", enabled: true };
    } else if (type === "set-media-feature") {
      action = { type: "set-media-feature", outputId: "production", feature: "stream", enabled: true };
    } else {
      const first = selectedDeck.layers[0];
      action = { type: "sequence", actions: first ? [{ type: "program", target: { deckId: selectedDeck.id, layerId: first.id } }] : [] };
    }
    updateSelectedTriggers([...(selectedLayerModel.triggers ?? []), action]);
  };

  const removeSelectedTrigger = (index: number) => {
    if (!selectedLayerModel) return;
    updateSelectedTriggers((selectedLayerModel.triggers ?? []).filter((_, itemIndex) => itemIndex !== index));
  };

  const runSelectedTrigger = (action: TriggerAction) => {
    try {
      triggerEngine.execute(action, {
        decks: new Map(decks.map((deck) => [deck.id, deck])),
        controller: deckProgramController,
        output: outputEngine,
        compositionIdForDeck
      });
      setRuntimeRevision((value) => value + 1);
      setOutputRevision((value) => value + 1);
      setProjectMessage("Trigger executed.");
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : "Trigger execution failed.");
    }
  };

  const updateSelectedTransform = (patch: Partial<NonNullable<Layer["transform"]>>) => {
    if (!selectedLayerModel) return;
    const transform = patchLayerTransform(selectedLayerModel.transform, patch);
    updateSelectedLayer({ transform });
  };

  const createGroupFromSelectedLayer = () => {
    if (!selectedLayerModel) return;
    const groupId = `group-${Date.now()}`;
    const group = groupEngine.create(groupId, `Group ${groups.length + 1}`, [selectedLayerModel.id]);
    setGroups([...groupEngine.list()]);
    setSelectedGroupId(group.id);
    setCompositions((current) => current.map((composition) => composition.id === "default" ? { ...composition, groupIds: [...new Set([...composition.groupIds, group.id])] } : composition));
    setProjectMessage(`Group ${group.name} created.`);
  };

  const toggleSelectedGroup = (groupId: string) => {
    groupEngine.toggleCollapsed(groupId);
    setGroups([...groupEngine.list()]);
    setSelectedGroupId(groupId);
  };

  const addLayerToGroup = (groupId: string, layerId: string) => {
    try {
      groupEngine.addLayer(groupId, layerId);
      setGroups([...groupEngine.list()]);
      setSelectedGroupId(groupId);
      setProjectMessage("Layer added to group.");
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : "Unable to add layer to group.");
    }
  };

  const removeLayerFromGroup = (groupId: string, layerId: string) => {
    groupEngine.removeLayer(groupId, layerId);
    setGroups([...groupEngine.list()]);
  };

  const renameGroup = (groupId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    groupEngine.update(groupId, { name: trimmed });
    setGroups([...groupEngine.list()]);
    setEditingGroupId(null);
  };

  const cloneGroup = (groupId: string) => {
    try {
      const clone = groupEngine.clone(groupId, "group-" + Date.now());
      setGroups([...groupEngine.list()]);
      setSelectedGroupId(clone.id);
      setProjectMessage(clone.name + " created.");
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : "Group clone failed.");
    }
  };

  const deleteGroup = (groupId: string) => {
    groupEngine.replaceAll(groupEngine.list().filter((group) => group.id !== groupId));
    setGroups([...groupEngine.list()]);
    if (selectedGroupId === groupId) setSelectedGroupId(null);
    if (editingGroupId === groupId) setEditingGroupId(null);
  };

  const reorderGroupLayer = (groupId: string, layerId: string, direction: -1 | 1) => {
    const group = groupEngine.get(groupId);
    const index = group.layerIds.indexOf(layerId);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= group.layerIds.length) return;
    const layerIds = [...group.layerIds];
    [layerIds[index], layerIds[nextIndex]] = [layerIds[nextIndex], layerIds[index]];
    groupEngine.update(groupId, { layerIds });
    setGroups([...groupEngine.list()]);
  };

  const handleGroupDrop = (event: DragEvent<HTMLDivElement>, groupId: string) => {
    event.preventDefault();
    const layerId = event.dataTransfer.getData("text/visco-layer-id");
    if (layerId) addLayerToGroup(groupId, layerId);
  };

  const updateSelectedScale = (axis: "scaleX" | "scaleY", value: number) => {
    if (!selectedLayerModel) return;
    const transform = setLayerScale(selectedLayerModel.transform, axis, value);
    updateSelectedLayer({ transform });
  };

  const updateDeck = (deckId: string, patch: Partial<Deck>) => {
    setDecks((current) => current.map((deck) => deck.id === deckId ? { ...deck, ...patch } : deck));
  };

  const toggleLayerFlag = (flag: "visible" | "locked" | "muted" | "solo") => {
    if (!selectedLayerModel) return;
    updateSelectedLayer({ [flag]: !(selectedLayerModel[flag] ?? (flag === "visible")) });
  };
  const duplicateSelectedLayer = () => {
    if (!selectedDeck || !selectedLayerModel) return;
    const copy = { ...selectedLayerModel, id: selectedLayerModel.id + "-copy-" + Date.now(), name: selectedLayerModel.name + " Copy" };
    recordHistory();
    setDecks((current) => current.map((deck) => deck.id === selectedDeck.id ? { ...deck, layers: [...deck.layers.slice(0, deck.layers.findIndex((l) => l.id === selectedLayerModel.id) + 1), copy, ...deck.layers.slice(deck.layers.findIndex((l) => l.id === selectedLayerModel.id) + 1)] } : deck));
    setSelectedLayer({ deckId: selectedDeck.id, layerId: copy.id });
  };
  const deleteSelectedLayer = () => {
    if (!selectedDeck || !selectedLayerModel || selectedDeck.layers.length <= 1) return;
    recordHistory();
    const remaining = selectedDeck.layers.filter((layer) => layer.id !== selectedLayerModel.id);
    setDecks((current) => current.map((deck) => deck.id === selectedDeck.id ? { ...deck, layers: remaining } : deck));
    const next = remaining[0];
    if (next) setSelectedLayer({ deckId: selectedDeck.id, layerId: next.id });
  };

  const addDeck = (kind: DeckKind) => {
    const number = decks.length + 1;
    const deck: Deck = {
      id: "deck-" + Date.now(),
      name: kind === "audio" ? "Audio Deck " + number : "Deck " + number,
      kind,
      transition: { type: "fade", durationMs: 500 } as Transition,
      loop: false,
      layers: makeLayers("deck-" + Date.now())
    };
    setDecks((items) => [...items, deck]);
    deckRuntime.register(deck);
    if (kind === "audio") audioEngine.registerDeck(deck.id);
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

  const addInternalInput = (kind: SourceKind, device?: DiscoveredDevice) => {
    const source: Source = {
      id: "source-" + Date.now(),
      name: device?.name ?? (kind === "colour" ? "Colour" : kind === "timer" ? "Timer" : kind),
      kind,
      ...(device?.uri || device?.address ? { uri: device.uri ?? device.address } : {}),
      ...(device ? {
        metadata: {
          deviceId: device.id,
          deviceKind: device.kind,
          transport: device.transport,
          address: device.address,
          ...(device.metadata ?? {})
        }
      } : {})
    };
    libraryEngine.add(source);
    setLibraryItems((items) => [...items, source]);
    setShowAddInput(false);
    setDiscoveredDevices([]);
    setDiscoveryMessage("");
  };

  const discoverDevices = async () => {
    const selected = selectedInputKind;
    const discoverable = ["camera", "video-capture", "ndi", "omt", "desktop-capture"].includes(selected);
    if (!discoverable) return;
    setDiscoveryBusy(true);
    setDiscoveryMessage("");
    const host = await nativeHost.status();
    setNativeHostState(host.available ? "online" : "offline");
    if (!host.available) {
      setDiscoveryMessage("Native Windows Host tidak terhubung. Jalankan visco-native-host.exe terlebih dahulu.");
      setDiscoveryBusy(false);
      return;
    }
    const result = await deviceDiscovery.discover({
      kind: selected as "camera" | "video-capture" | "ndi" | "omt" | "desktop-capture",
      ...(discoveryServer.trim() ? { discoveryServer: discoveryServer.trim() } : {})
    });
    setDiscoveredDevices(result.devices);
    setDiscoveryMessage(result.message ?? `${result.devices.length} device(s) found.`);
    setDiscoveryBusy(false);
  };

  const addDiscoveredDevice = async (device: DiscoveredDevice) => {
    addInternalInput(sourceKindForDevice(device.kind), device);
    if (device.kind === "camera" || device.kind === "video-capture") {
      try {
        const capture = await nativeHost.startCapture(device.id);
        if (capture.ok) setNativeCaptureDevice(device.id);
        else setDiscoveryMessage(capture.message ?? "Native capture start failed.");
      } catch (error) {
        setDiscoveryMessage(error instanceof Error ? error.message : "Native capture start failed.");
      }
    }
  };

  useEffect(() => {
    nativeHost.status().then(async (status) => {
      setNativeHostState(status.available ? "online" : "offline");
      if (status.available) {
        setNativeCaptureDevice("auto");
        try { setRuntimeAdapters(await nativeHost.runtimeAdapters()); } catch { setRuntimeAdapters([]); }
      }
    });
  }, [nativeHost]);

  const discoverAudioDevices = async () => {
    const host = await nativeHost.status();
    setNativeHostState(host.available ? "online" : "offline");
    if (!host.available) {
      setDiscoveryMessage("Native Windows Host tidak terhubung.");
      return;
    }
    const devices = await nativeHost.discover({ kind: "audio-input" });
    setAudioDevices(devices);
  };

  const addManualIpCamera = () => {
    const uri = ipCameraUri.trim();
    if (!uri) return;
    addInternalInput("ip-camera", {
      id: `ip-camera-${Date.now()}`,
      name: uri,
      kind: "ip-camera",
      transport: "network",
      uri
    });
    setIpCameraUri("");
  };

  const addInput = (kind: SourceKind, accept?: string) => {
    if (["colour", "timer", "title", "composition", "video-delay", "audio-input", "camera", "ndi", "omt", "desktop-capture", "ip-camera"].includes(kind)) {
      if (kind === "ip-camera") {
        setSelectedInputKind(kind);
        return;
      }
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

  const buildProjectSnapshot = () => createProjectSnapshot({
    compositions: compositions.map((composition) => composition.id === "default"
      ? { ...composition, deckIds: decks.map((deck) => deck.id), sliceIds: slices.map((slice) => slice.id) }
      : composition),
    decks,
    groups,
    layers: decks.flatMap((deck) => deck.layers),
    slices,
    scenes: sceneRuntime.list(),
    sources: libraryEngine.list(),
    outputs: outputEngine.list()
  });

  const restoreSnapshot = (snapshot: ReturnType<typeof createProjectSnapshot>, message: string) => {
    const loadedDecks = snapshot.decks as Deck[];
    setDecks(loadedDecks); setCompositions([...snapshot.compositions]); deckRuntime.replaceAll(loadedDecks); programEngine.clear("default");
    setSlices([...snapshot.slices]); setGroups([...snapshot.groups]); groupEngine.replaceAll(snapshot.groups);
    libraryEngine.replaceAll(snapshot.sources); setLibraryItems([...snapshot.sources]); setLibrarySearch("");
    const persistedOutputs = snapshot.outputs.length ? snapshot.outputs : outputEngine.list(); const byId = new Map(persistedOutputs.map((o) => [o.id, o]));
    outputEngine.replaceAll([...outputEngine.list().map((o) => byId.get(o.id) ?? o), ...persistedOutputs.filter((o) => !outputEngine.list().some((x) => x.id === o.id))]);
    const restoredScenes = snapshot.scenes.length ? snapshot.scenes : defaultScenes; sceneRuntime.replaceAll(restoredScenes);
    const restoredSceneId = restoredScenes.find((s) => s.enabled)?.id ?? restoredScenes[0]?.id ?? "scene-display-1"; setActiveSceneId(restoredSceneId); sceneRuntime.activate(restoredSceneId);
    audioEngine.replaceAll(loadedDecks.filter((d) => d.kind === "audio").map((d) => d.id)); setSelectedLayer({ deckId: loadedDecks[0]?.id ?? "", layerId: loadedDecks[0]?.layers[0]?.id ?? "" });
    setRuntimeRevision((v) => v + 1); setOutputRevision((v) => v + 1); setProjectMessage(message);
  };
  const undo = () => { const h=historyRef.current; const p=h.past.pop(); if(!p)return; h.future.push(serializeProject(buildProjectSnapshot())); restoreSnapshot(parseProject(p),"Undo"); setHistoryRevision((v)=>v+1); };
  const redo = () => { const h=historyRef.current; const n=h.future.pop(); if(!n)return; h.past.push(serializeProject(buildProjectSnapshot())); restoreSnapshot(parseProject(n),"Redo"); setHistoryRevision((v)=>v+1); };
  const saveProject = () => {
    const blob = new Blob([serializeProject(buildProjectSnapshot())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "visco-project.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setProjectMessage("Project saved.");
  };

  const loadProject = (file: File) => { file.text().then((text) => { restoreSnapshot(parseProject(text), "Project loaded."); historyRef.current = { past: [], future: [] }; setHistoryRevision((v) => v + 1); }).catch((error) => setProjectMessage(error instanceof Error ? error.message : "Project load failed.")); };


  const filteredLibraryItems = [...libraryItems]
    .filter((item) => item.name.toLowerCase().includes(librarySearch.trim().toLowerCase()))
    .filter((item) => libraryKindFilter === "all" || item.kind === libraryKindFilter)
    .sort((a, b) => librarySort === "kind" ? a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));

  const sourceUsage = (sourceId: string) => decks.some((deck) => deck.layers.some((layer) => layer.sourceId === sourceId));
  const duplicateSource = (source: Source) => {
    const copy = { ...source, id: "source-" + Date.now(), name: source.name + " Copy" };
    libraryEngine.add(copy); setLibraryItems([...libraryEngine.list()]); setSelectedSourceId(copy.id); setProjectMessage("Source duplicated.");
  };
  const removeSource = (source: Source) => {
    if (sourceUsage(source.id)) { setProjectMessage("Source is still used by a Layer. Remove the Layer reference first."); return; }
    libraryEngine.remove(source.id); setLibraryItems([...libraryEngine.list()]); setSelectedSourceId(null); setProjectMessage("Source removed from Library.");
  };
  const renameSource = (source: Source, name: string) => {
    const trimmed = name.trim(); if (!trimmed) return;
    libraryEngine.update({ ...source, name: trimmed }); setLibraryItems([...libraryEngine.list()]); setEditingSourceId(null);
  };

  const outputState = outputEngine.getState("production");
  const mediaSettings = outputState.target.media!;
  const fullscreenState = outputEngine.getState("display-1");

  const currentScenes = () => sceneRuntime.list();

  const createScene = () => {
    const scenes = currentScenes();
    const scene: Scene = {
      id: "scene-" + Date.now(),
      name: "Scene " + (scenes.length + 1),
      compositionId: "default",
      target: { kind: "display", displayId: "display-1" },
      enabled: true
    };
    try {
      sceneRuntime.register(scene);
      setSceneManagerRevision((v) => v + 1);
      setProjectMessage(scene.name + " created.");
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : "Scene creation failed.");
    }
  };

  const renameScene = (sceneId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const scenes = currentScenes().map((scene) => scene.id === sceneId ? { ...scene, name: trimmed } : scene);
    try {
      sceneRuntime.replaceAll(scenes);
      setSceneManagerRevision((v) => v + 1);
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : "Scene rename failed.");
    }
  };

  const deleteScene = (sceneId: string) => {
    const scenes = currentScenes();
    if (scenes.length <= 1) {
      setProjectMessage("At least one Scene must remain.");
      return;
    }
    const next = scenes.filter((scene) => scene.id !== sceneId);
    try {
      sceneRuntime.replaceAll(next);
      const nextActive = next.find((scene) => scene.enabled) ?? next[0];
      if (nextActive) {
        sceneRuntime.activate(nextActive.id);
        setActiveSceneId(nextActive.id);
      }
      setSceneManagerRevision((v) => v + 1);
      setProjectMessage("Scene removed.");
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : "Scene removal failed.");
    }
  };

  const activateScene = (sceneId: string) => {
    try {
      const state = sceneRuntime.activate(sceneId);
      const scene = sceneRuntime.getActive(state.compositionId);
      const program = programEngine.getState(state.compositionId);
      const composition = buildProjectSnapshot().compositions.find((item) => item.id === state.compositionId);
      if (!scene || !composition) throw new Error(`Scene "${sceneId}" has no matching composition.`);
      resolveAdvancedOutput(scene, composition, outputEngine.list(), slices);
      if (program.source) outputEngine.syncFromScene(scene, program.source);
      setActiveSceneId(sceneId);
      setOutputRevision((value) => value + 1);
      setProjectMessage("Scene " + sceneId + " active.");
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : "Scene activation failed.");
    }
  };

  const toggleOutput = (targetId: string) => {
    const state = outputEngine.getState(targetId);
    const enabled = !state.target.enabled;
    outputEngine.setEnabled(targetId, enabled);
    if (enabled) {
      const program = programEngine.getState("default");
      const scene = sceneRuntime.getActive(program.compositionId);
      if (program.source && scene) {
        try {
          outputEngine.syncFromScene(scene, program.source);
        } catch (error) {
          setProjectMessage(error instanceof Error ? error.message : "Output routing failed.");
        }
      }
    }
    setOutputRevision((value) => value + 1);
  };

  const openOutputSettings = (kind: "stream" | "record" | "display") => setOutputSettings(kind);

  const applyOutputSettings = (patch: { resolution?: [number, number]; fps?: number; codec?: string; bitrate?: number | "auto" }) => {
    try {
      const media = outputEngine.getState("production").target.media;
      if (!media) return;
      if (outputSettings === "display") {
        setProjectMessage("Fullscreen uses the active Scene and Windows display target.");
        return;
      }
      const mediaPatch: { resolution?: [number, number]; fps?: number } = {};
      if (patch.resolution) mediaPatch.resolution = patch.resolution;
      if (patch.fps !== undefined) mediaPatch.fps = patch.fps;
      if (Object.keys(mediaPatch).length) outputEngine.updateMediaSettings("production", mediaPatch);
      if (patch.codec !== undefined || patch.bitrate !== undefined) {
        if (outputSettings === "stream") {
          outputEngine.updateMediaSettings("production", {
            stream: {
              ...(media.stream ?? { resolution: media.resolution, fps: media.fps, codec: "h264", bitrate: "auto", server: "", key: "" }),
              ...(patch.codec !== undefined ? { codec: patch.codec } : {}),
              ...(patch.bitrate !== undefined ? { bitrate: patch.bitrate } : {})
            }
          });
        } else {
          outputEngine.updateMediaSettings("production", {
            record: {
              ...(media.record ?? { resolution: media.resolution, fps: media.fps, codec: "h264", bitrate: "auto", segmentMinutes: 60, targetFolder: "" }),
              ...(patch.codec !== undefined ? { codec: patch.codec } : {}),
              ...(patch.bitrate !== undefined ? { bitrate: patch.bitrate } : {})
            }
          });
        }
      }
      setOutputRevision((value) => value + 1);
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : "Output settings update failed.");
    }
  };

  const toggleMediaFeature = (feature: "stream" | "record" | "virtual") => {
    const key = feature === "stream" ? "streaming" : feature === "record" ? "recording" : "virtual";
    outputEngine.setMediaFeature("production", feature, !mediaSettings[key]);
    const program = programEngine.getState("default");
    const scene = sceneRuntime.getActive(program.compositionId);
    if (program.source && scene?.target.kind === "production") {
      try {
        outputEngine.syncFromScene(scene, program.source);
      } catch (error) {
        setProjectMessage(error instanceof Error ? error.message : "Production routing failed.");
      }
    }
    setOutputRevision((value) => value + 1);
  };

  const updateFader = (deckId: string, key: "master" | "audio" | "opacity", value: number) => {
    const deck = decks.find((item) => item.id === deckId);
    if (key === "master") {
      deckRuntime.setMasterLevel(deckId, value);
      if (deck?.kind === "audio") audioEngine.setEnabled(deckId, value > 0);
    }
    if (key === "audio") {
      deckRuntime.setAudioLevel(deckId, value);
      if (deck?.kind === "audio") audioEngine.setLevel(deckId, value);
    }
    if (key === "opacity") deckRuntime.setVisualLevel(deckId, value);
    if (deck?.kind === "audio") audioOutputRouter.sync();
    setRuntimeRevision((value) => value + 1);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setAudioMeters((meters) => meters.map((value) => Math.max(4, Math.min(96, value + (Math.random() * 24 - 12))))), 180);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { const raw=localStorage.getItem("visco-autosave-v1"); if(raw){try{const saved=JSON.parse(raw) as {project?:string}; if(saved.project)setRecoveryAvailable(true);}catch{localStorage.removeItem("visco-autosave-v1");}}}, []);
  useEffect(() => { if(!autoSaveEnabled)return; const timer=window.setInterval(()=>{try{localStorage.setItem("visco-autosave-v1",JSON.stringify({savedAt:Date.now(),project:serializeProject(buildProjectSnapshot())}));}catch{}},5000); return()=>window.clearInterval(timer); }, [autoSaveEnabled,decks,compositions,groups,slices,libraryItems,activeSceneId]);
  useEffect(() => { const onKeyDown=(event:KeyboardEvent)=>{if(!(event.ctrlKey||event.metaKey)||event.altKey)return; const target=event.target as HTMLElement|null; if(target&&["INPUT","TEXTAREA","SELECT"].includes(target.tagName))return; if(event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redo():undo();}else if(event.key.toLowerCase()==="y"){event.preventDefault();redo();}};window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown);}, []);
  const recoverAutosave=()=>{const raw=localStorage.getItem("visco-autosave-v1");if(!raw)return;try{const saved=JSON.parse(raw) as {project?:string};if(saved.project)restoreSnapshot(parseProject(saved.project),"Autosave recovered.");historyRef.current={past:[],future:[]};setRecoveryAvailable(false);setHistoryRevision((v)=>v+1);}catch(error){setProjectMessage(error instanceof Error?error.message:"Autosave recovery failed.");}};
  const discardAutosave=()=>{localStorage.removeItem("visco-autosave-v1");setRecoveryAvailable(false);setProjectMessage("Autosave discarded.");};
  return (
    <main className={operatorMode ? "app-shell operator-mode" : "app-shell"}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div><strong>VisCo</strong><span>Visual Control & Live Production System</span></div>
        </div>
        <nav className="topnav">
          <button onClick={saveProject}>Save</button><button className="history-button" disabled={historyRef.current.past.length === 0} onClick={undo} title="Ctrl/Cmd+Z">↶ Undo</button><button className="history-button" disabled={historyRef.current.future.length === 0} onClick={redo} title="Ctrl/Cmd+Shift+Z">↷ Redo</button><button className={autoSaveEnabled ? "autosave-button enabled" : "autosave-button"} onClick={() => setAutoSaveEnabled((v) => !v)}>{autoSaveEnabled ? "AUTO" : "AUTO OFF"}</button>
          <label className="topnav-file">Open<input type="file" accept=".json,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) loadProject(file); event.target.value = ""; }} /></label>
          <div className="topnav-menu"><button onClick={() => { setShowEditMenu((v) => !v); setShowViewMenu(false); }}>Edit</button>{showEditMenu && <div className="topnav-dropdown"><button onClick={() => { undo(); setShowEditMenu(false); }}>Undo</button><button onClick={() => { redo(); setShowEditMenu(false); }}>Redo</button><button onClick={() => { saveProject(); setShowEditMenu(false); }}>Save Project</button></div>}</div><div className="topnav-menu"><button onClick={() => { setShowViewMenu((v) => !v); setShowEditMenu(false); }}>View</button>{showViewMenu && <div className="topnav-dropdown"><button onClick={() => { setOperatorMode((v) => !v); setShowViewMenu(false); }}>{operatorMode ? "Exit Operator Mode" : "Operator Mode"}</button><button onClick={() => { setShowViewMenu(false); setProjectMessage("Preview/Program workspace active."); }}>Preview / Program</button></div>}</div><button onClick={() => setShowSettings(true)}>Settings</button>
          {recoveryAvailable && <span className="recovery-controls"><button onClick={recoverAutosave}>Recover</button><button onClick={discardAutosave}>Discard</button></span>}{projectMessage && <span className="project-message">{projectMessage}</span>}
        </nav>
        <div className="status"><span className="status-dot" /> SYSTEM READY <small className="top-status-detail">{nativeHostState.toUpperCase()} · {runtimeAdapters.filter((adapter) => adapter.available).length}/3</small></div>
      </header>

      <section
        className="workspace"
        style={{ gridTemplateColumns: workspace.library + "px minmax(600px, 1fr) " + workspace.properties + "px" }}
      >
        <aside className="library panel">
          <div className="panel-title"><span>LIBRARY</span></div>
          <div className="library-search-row"><input className="search" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search media…" /><select value={libraryKindFilter} onChange={(event) => setLibraryKindFilter(event.target.value as SourceKind | "all")}><option value="all">ALL</option>{Array.from(new Set(libraryItems.map((item) => item.kind))).sort().map((kind) => <option key={kind} value={kind}>{kind.toUpperCase()}</option>)}</select></div>
          <div className="library-toolbar"><span>{filteredLibraryItems.length} / {libraryItems.length}</span><select value={librarySort} onChange={(event) => setLibrarySort(event.target.value as "name" | "kind")}><option value="name">NAME</option><option value="kind">TYPE</option></select></div>
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
                {filteredLibraryItems.map((item) => (
                  <button
                    className={selectedSourceId === item.id ? "library-item selected" : "library-item"}
                    key={item.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/library-id", item.id)}
                    onClick={() => setSelectedSourceId(item.id)}
                  >
                    <span className="library-icon">{item.name.slice(0, 1).toUpperCase()}</span>
                    {editingSourceId === item.id ? <input autoFocus value={item.name} onChange={(event) => libraryEngine.update({ ...item, name: event.target.value })} onBlur={(event) => renameSource(item, event.currentTarget.value)} onClick={(event) => event.stopPropagation()} /> : <span>{item.name}</span>}
                    <small className="library-kind">{item.kind}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedSourceId && libraryEngine.has(selectedSourceId) && (() => {
            const source = libraryEngine.get(selectedSourceId);
            return <div className="library-inspector">
              <div className="library-inspector-head"><strong>{source.name}</strong><small>{source.kind.toUpperCase()}</small></div>
              <div className="library-actions">
                <button onClick={() => setEditingSourceId(source.id)}>RENAME</button>
                <button onClick={() => duplicateSource(source)}>DUPLICATE</button>
                <button onClick={() => removeSource(source)}>REMOVE</button>
              </div>
              <div className="library-meta"><span>Used: {sourceUsage(source.id) ? "YES" : "NO"}</span><span>{source.uri ? "URI READY" : "NO URI"}</span></div>
            </div>;
          })()}
        </aside>

        <section className="center">
          <div className="monitors">
            <div className="monitor">
              <div className="monitor-head"><span>PREVIEW</span><span className="monitor-source">{getPreviewRef().deckId} / {getPreviewRef().layerId}</span></div>
              <div className="preview-canvas">
                {nativeHostState === "online" && nativeCaptureDevice
                  ? <img src={nativePreviewUrl} alt="VisCo native preview" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  : (() => {
                    const ref = getPreviewRef();
                    const deck = decks.find((item) => item.id === ref.deckId);
                    const layer = deck?.layers.find((item) => item.id === ref.layerId);
                    return layer ? <span style={compositeLayer(layer).style}>PREVIEW</span> : <span>PREVIEW</span>;
                  })()}
              </div>
            </div>
            <div className="monitor program-monitor">
              <div className="monitor-head"><span>PROGRAM</span><span className="on-air">ON AIR</span></div>
              <div className="program-canvas">
                {nativeHostState === "online" && nativeCaptureDevice
                  ? <img src={nativePreviewUrl} alt="VisCo native program" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  : (() => {
                    const program = programEngine.getState("default");
                    const composed = compositeProgram(program); return composed.length ? <span style={composed[0].style}>PROGRAM</span> : <span>PROGRAM</span>;
                  })()}
              </div>
            </div>
          </div>

          <div className="decks">
            <div className="deck-toolbar">
              <button className="add-deck-button" onClick={() => setShowAddDeck((value) => !value)}>+ Add Deck</button>
              {groups.length > 0 && (
                <div className="group-toolbar" aria-label="Group controls">
                  <span className="group-toolbar-label">GROUPS</span>
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className={selectedGroupId === group.id ? "group-chip selected" : "group-chip"}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleGroupDrop(event, group.id)}
                    >
                      {editingGroupId === group.id ? (
                        <input
                          className="group-rename-input"
                          autoFocus
                          defaultValue={group.name}
                          onBlur={(event) => renameGroup(group.id, event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") renameGroup(group.id, event.currentTarget.value);
                            if (event.key === "Escape") setEditingGroupId(null);
                          }}
                          onClick={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <button className="group-chip-name" onClick={() => setSelectedGroupId(group.id)}>{group.name}</button>
                      )}
                      <button className="group-chip-action" title={group.collapsed ? "Expand group" : "Collapse group"} onClick={() => toggleSelectedGroup(group.id)}>{group.collapsed ? "▸" : "▾"}</button>
                      <button className="group-chip-action" title="Rename group" onClick={() => { setSelectedGroupId(group.id); setEditingGroupId(group.id); }}>✎</button>
                      <button className="group-chip-action" title="Clone group" onClick={() => cloneGroup(group.id)}>⧉</button>
                    </div>
                  ))}
                </div>
              )}
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
                            if (deck.kind === "audio") {
                              audioEngine.selectLayer(deck.id, enabled ? deck.layers[column - 1].id : null);
                              audioEngine.setEnabled(deck.id, enabled && deckRuntime.getState(deck.id).masterLevel > 0);
                            }
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
              const values = { master: runtimeState.masterLevel, audio: runtimeState.audioLevel, opacity: runtimeState.visualLevel };
              return (
                <section className={"deck-row " + (deck.kind === "audio" ? "audio-deck" : "")} key={deck.id}>
                  <div className="deck-rail">
                    <div className="deck-heading">
                      <span>{deck.name}</span>
                      <small>{deck.kind.toUpperCase()} · {runtimeState.masterLevel}% MASTER</small>
                      <div className="deck-status-pills"><b>{runtimeState.masterLevel > 0 ? "ACTIVE" : "MUTED"}</b><b>{deck.layers.filter((layer) => layer.sourceId).length} SOURCES</b></div>
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
                      <button className="deck-action" title="Deck settings" onClick={() => setDeckSettingsId(deck.id)}>⚙</button>
                    </div>
                  </div>

                  <div className="layer-strip">
                    {deck.layers.filter((layer) => !groups.some((group) => group.collapsed && group.layerIds.includes(layer.id))).map((layer, index) => {
                      const isProgram = deck.kind === "visual" && getProgramRef().deckId === deck.id && getProgramRef().layerId === layer.id;
                      const isPreview = deck.kind === "visual" && getPreviewRef().deckId === deck.id && getPreviewRef().layerId === layer.id;
                      const mediaName = layer.sourceId && libraryEngine.has(layer.sourceId)
                        ? libraryEngine.get(layer.sourceId).name
                        : undefined;
                      return (
                        <article
                          className={"layer-card " + (selectedLayer.deckId === deck.id && selectedLayer.layerId === layer.id ? "selected " : "") + (isProgram ? "program " : "") + (isPreview ? "preview" : "")}
                          key={layer.id}
                          draggable
                          onDragStart={(event) => event.dataTransfer.setData("text/visco-layer-id", layer.id)}
                        >
                          <div className="layer-name-row">
                            <button className={"layer-name " + (isPreview ? "preview-name" : "")} onClick={() => selectPreview(deck.id, layer.id)}>
                              <span>{layer.name}</span>{isPreview && <small>CUE</small>}
                            </button>
                            {deck.kind === "visual" && <button className={isProgram ? "layer-program-button active" : "layer-program-button"} onClick={() => programLayer(deck.id, layer.id)} title="Send this layer to Program">PROGRAM</button>}
                          </div>
                          <button
                            className="layer-box"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleLayerDrop(event, deck.id, layer.id)}
                            onClick={() => {
                              if (deck.kind === "visual") {
                                setSelectedLayer({ deckId: deck.id, layerId: layer.id });
                              } else {
                                deckRuntime.setLayerPlayback(deck.id, layer.id, { playing: true });
                                audioEngine.selectLayer(deck.id, layer.id);
                                audioEngine.setEnabled(deck.id, deckRuntime.getState(deck.id).masterLevel > 0);
                                audioOutputRouter.sync();
                                setRuntimeRevision((value) => value + 1);
                              }
                            }}
                          >
                            <div className="layer-thumb"><span>{mediaName || (deck.kind === "audio" ? "AUDIO" : layer.name)}</span></div>
                            <div className="layer-tools"><span>{isPreview ? "CUE" : "◌"}</span><span className={isProgram ? "eye on" : "eye"}>{isProgram ? "PROGRAM" : "◉"}</span></div>
                            <div className="overlay-number">{index + 1}</div>
                            {isProgram && <div className="program-badge">ON AIR</div>}
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
          <div className="panel-title property-panel-title"><span>PROPERTIES</span><span className="muted">{selectedLayer.layerId}</span></div>
          <div className="property-context"><span>{selectedLayerModel?.name ?? "No layer selected"}</span><small>{selectedDeck?.name ?? "—"} · {selectedLayerModel?.sourceId && libraryEngine.has(selectedLayerModel.sourceId) ? libraryEngine.get(selectedLayerModel.sourceId).kind : "media"}</small></div>
          {["General", "Playback", "Transform", "Layering", "Audio", "Trigger", "Slice", "Document", "List", "Advanced"].map((item) => (
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
                  {item === "Transform" && <>
                    <div className="inspector-subhead">POSITION & ROTATION</div><div className="property-grid">
                      {[["X","x",0],["Y","y",0],["Rotation","rotation",0]].map(([label,key,fallback]) => <label key={String(key)}>{label}<input type="number" value={Number(selectedLayerModel?.transform?.[key as keyof NonNullable<Layer["transform"]>] ?? fallback)} onChange={(event) => updateSelectedTransform({ [key]: Number(event.target.value) })} /></label>)}
                    </div><div className="inspector-subhead">SCALE</div><div className="property-grid">
                      <label>Scale X<input type="number" value={Number(selectedLayerModel?.transform?.scaleX ?? 100)} onChange={(event) => updateSelectedScale("scaleX", Number(event.target.value))} /></label>
                      <label>Scale Y<input type="number" value={Number(selectedLayerModel?.transform?.scaleY ?? 100)} onChange={(event) => updateSelectedScale("scaleY", Number(event.target.value))} /></label>
                    </div><label className="property-toggle"><span>Link Scale X/Y</span><input type="checkbox" checked={selectedLayerModel?.transform?.scaleLinked ?? true} onChange={(event) => updateSelectedTransform({ scaleLinked: event.target.checked })} /></label>
                  </>}
                                    {item === "Layering" && <>
                    <div className="property-grid">
                      <label>Order<input type="number" value={selectedLayerModel?.order ?? 0} onChange={(event) => updateSelectedLayer({ order: Number(event.target.value) })} /></label>
                      <label>Opacity<input type="number" min="0" max="100" value={selectedLayerModel?.transform?.opacity ?? 100} onChange={(event) => updateSelectedTransform({ opacity: Number(event.target.value) })} /></label>
                      <label>Blend<input value={selectedLayerModel?.blendMode ?? "Normal"} onChange={(event) => updateSelectedLayer({ blendMode: event.target.value })} /></label>
                    </div>
                    <div className="layer-operator-grid">
  <button className={selectedLayerModel?.visible !== false ? "active" : ""} onClick={() => toggleLayerFlag("visible")}>VIS</button>
  <button className={selectedLayerModel?.muted ? "active" : ""} onClick={() => toggleLayerFlag("muted")}>MUTE</button>
  <button className={selectedLayerModel?.solo ? "active" : ""} onClick={() => toggleLayerFlag("solo")}>SOLO</button>
  <button className={selectedLayerModel?.locked ? "active" : ""} onClick={() => toggleLayerFlag("locked")}>LOCK</button>
  <button onClick={duplicateSelectedLayer}>DUP</button><button onClick={deleteSelectedLayer}>DELETE</button>
</div>
<div className="property-buttons"><button onClick={createGroupFromSelectedLayer}>+ Group Selected Layer</button></div>
                    {selectedGroupId && (() => {
                      const group = groups.find((item) => item.id === selectedGroupId);
                      if (!group) return null;
                      return <div className="group-manager">
                        <div className="group-manager-head">
                          <strong>{group.name}</strong>
                          <button onClick={() => deleteGroup(group.id)} title="Remove group">Remove</button>
                        </div>
                        <div className="group-manager-note">Drag Layer cards onto the group chip above to add them.</div>
                        {group.layerIds.length === 0 ? <div className="property-empty">No layers in this group.</div> : group.layerIds.map((layerId, index) => {
                          const layer = decks.flatMap((deck) => deck.layers).find((item) => item.id === layerId);
                          return <div className="group-member-row" key={layerId}>
                            <span>{index + 1}. {layer?.name ?? layerId}</span>
                            <div>
                              <button disabled={index === 0} onClick={() => reorderGroupLayer(group.id, layerId, -1)}>↑</button>
                              <button disabled={index === group.layerIds.length - 1} onClick={() => reorderGroupLayer(group.id, layerId, 1)}>↓</button>
                              <button onClick={() => removeLayerFromGroup(group.id, layerId)}>×</button>
                            </div>
                          </div>;
                        })}
                      </div>;
                    })()}
                  </>}
                  {item === "Audio" && (() => {
                    const audio = selectedLayerModel?.audio ?? { volume: 100, pan: 0 };
                    return <><div className="audio-meter"><span>L</span><i style={{height: audioMeters[0] + "%"}} /><span>R</span><i style={{height: audioMeters[1] + "%"}} /></div><label>Volume<input type="range" min="0" max="100" value={audio.volume} onChange={(event) => updateSelectedAudio({ volume: Number(event.target.value) })} /></label><label>Pan<input type="range" min="-100" max="100" value={audio.pan} onChange={(event) => updateSelectedAudio({ pan: Number(event.target.value) })} /></label><div className="property-value">{audio.volume}% · Pan {audio.pan}</div></>;
                  })()}
                  {item === "Trigger" && (() => {
  const triggers = selectedLayerModel?.triggers ?? [];
  const label = (action: TriggerAction): string => {
    switch (action.type) {
      case "program": return "Program " + action.target.deckId + " / " + action.target.layerId;
      case "set-master": return "Set Master " + action.deckId + " → " + action.level + "%";
      case "set-output-enabled": return (action.enabled ? "Enable " : "Disable ") + action.outputId;
      case "set-media-feature": return (action.enabled ? "Enable " : "Disable ") + action.feature + " on " + action.outputId;
      case "sequence": return "Sequence (" + action.actions.length + " actions)";
    }
  };
  return <>
    <div className="property-buttons">
      <button onClick={() => addSelectedTrigger("program")}>+ Program</button>
      <button onClick={() => addSelectedTrigger("set-master")}>+ Master</button>
      <button onClick={() => addSelectedTrigger("set-output-enabled")}>+ Output</button>
      <button onClick={() => addSelectedTrigger("set-media-feature")}>+ Stream</button><button onClick={() => addSelectedTrigger("sequence")}>+ Sequence</button>
    </div>
    {triggers.length === 0
      ? <div className="property-empty">No triggers assigned to this layer.</div>
      : triggers.map((action, index) => <div className="property-value" key={index}>
          <span>{label(action)}</span>
          <button onClick={() => runSelectedTrigger(action)}>RUN</button>
          <button onClick={() => removeSelectedTrigger(index)}>×</button>
        </div>)}
  </>;
})()}
                  {item === "Slice" && (() => {
                    const selectedSlices = slices.filter((slice) => slice.layerRefs.some((ref) => ref.deckId === selectedLayer.deckId && ref.layerId === selectedLayerModel?.id));
                    const updateSlice = (sliceId: string, updater: (slice: Slice) => Slice) => { recordHistory(); setSlices((current) => current.map((slice) => slice.id === sliceId ? updater(slice) : slice)); };
                    return <>
                      <SliceEditorToolbar tool={sliceEditorState.tool} onToolChange={setSliceEditorTool} />
                      <div className="slice-editor-options"><label className="property-toggle"><span>Snap to Grid</span><input type="checkbox" checked={selectedSlices[0]?.mapping?.snapToGrid ?? true} disabled={!selectedSlices[0]} onChange={(event) => selectedSlices[0] && updateSlice(selectedSlices[0].id, (current) => patchSliceMapping(current, { snapToGrid: event.target.checked }))} /></label><label>Grid Size<input type="number" min="1" max="512" value={selectedSlices[0]?.mapping?.gridSize ?? 16} disabled={!selectedSlices[0]} onChange={(event) => selectedSlices[0] && updateSlice(selectedSlices[0].id, (current) => patchSliceMapping(current, { gridSize: Math.max(1, Number(event.target.value) || 1) }))} /></label><label className="property-toggle"><span>Guides</span><input type="checkbox" checked={sliceGuides} onChange={(event) => setSliceGuides(event.target.checked)} /></label></div>
                      <div className="property-value">Tool: {sliceEditorState.tool === "pen" ? "Pen / Edit points" : "Move / Pick"} · Slices: {selectedSlices.length}</div>
                      {selectedSlices[0] && <SliceCanvas slice={selectedSlices[0]} guides={sliceGuides} onMovePoint={(index, point) => updateSlice(selectedSlices[0].id, (current) => moveSlicePoint(current, index, point))} onAddPoint={(point) => updateSlice(selectedSlices[0].id, (current) => addSlicePoint(current, point))} onRemovePoint={(index) => updateSlice(selectedSlices[0].id, (current) => removeSlicePoint(current, index))} />}
                      <div className="property-buttons"><button onClick={addSliceToSelectedLayer}>Add Slice</button><button onClick={resetSelectedLayerSlices} disabled={selectedSlices.length === 0}>Reset Slice</button></div>
                      {selectedSlices.map((slice) => <div key={slice.id}>
                        <div className="property-grid">
                          <label>Mode<select value={slice.mapping?.mode ?? "rectangle"} onChange={(event) => updateSlice(slice.id, (current) => patchSliceMapping(current, { mode: event.target.value as NonNullable<Slice["mapping"]>["mode"] }))}><option value="rectangle">Rectangle</option><option value="corner-pin">Corner Pin</option><option value="bezier">Bezier</option><option value="polygon">Polygon</option></select></label>
                          <label>Width<input type="number" min="1" value={slice.transform.width} onChange={(event) => updateSlice(slice.id, (current) => ({ ...current, transform: { ...current.transform, width: Number(event.target.value) } }))} /></label>
                          <label>Height<input type="number" min="1" value={slice.transform.height} onChange={(event) => updateSlice(slice.id, (current) => ({ ...current, transform: { ...current.transform, height: Number(event.target.value) } }))} /></label>
                          <label>X<input type="number" value={slice.transform.x} onChange={(event) => updateSlice(slice.id, (current) => ({ ...current, transform: { ...current.transform, x: Number(event.target.value) } }))} /></label>
                          <label>Y<input type="number" value={slice.transform.y} onChange={(event) => updateSlice(slice.id, (current) => ({ ...current, transform: { ...current.transform, y: Number(event.target.value) } }))} /></label>
                        </div>
                        {sliceEditorState.tool === "pen" && <div className="property-buttons">
                          <button onClick={() => updateSlice(slice.id, (current) => addSlicePoint(current, { x: current.transform.x + current.transform.width / 2, y: current.transform.y + current.transform.height / 2 }))}>+ Point</button>
                          {(slice.mapping?.points ?? []).map((point, pointIndex) => <div className="property-value" key={pointIndex}>
                            <label>Point {pointIndex + 1} X<input type="number" value={point.x} onChange={(event) => updateSlice(slice.id, (current) => moveSlicePoint(current, pointIndex, { x: Number(event.target.value), y: current.mapping?.points?.[pointIndex]?.y ?? point.y }))} /></label>
                            <label>Y<input type="number" value={point.y} onChange={(event) => updateSlice(slice.id, (current) => moveSlicePoint(current, pointIndex, { x: current.mapping?.points?.[pointIndex]?.x ?? point.x, y: Number(event.target.value) }))} /></label>
                            <button onClick={() => updateSlice(slice.id, (current) => removeSlicePoint(current, pointIndex))}>×</button>
                          </div>)}
                        </div>}
                      </div>)}
                    </>;
                  })()}
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
            <button className={fullscreenState.target.enabled ? "output-button enabled" : "output-button"} onClick={() => toggleOutput("display-1")}>FULLSCREEN</button>
            <button className="output-gear" title="Fullscreen settings" onClick={() => openOutputSettings("display")}>⚙</button>
          </div>
          <div className="output-control">
            <button className={mediaSettings.streaming ? "output-button enabled" : "output-button"} onClick={() => toggleMediaFeature("stream")}>STREAM</button>
            <button className="output-gear" title="Stream settings" onClick={() => openOutputSettings("stream")}>⚙</button>
          </div>
          <div className="output-control">
            <button className={mediaSettings.recording ? "output-button enabled" : "output-button"} onClick={() => toggleMediaFeature("record")}>RECORD</button>
            <button className="output-gear" title="Record settings" onClick={() => openOutputSettings("record")}>⚙</button>
          </div>
          <button className={mediaSettings.virtual ? "output-button enabled" : "output-button"} onClick={() => toggleMediaFeature("virtual")}>VIRTUAL OUT</button>
        </div>
        <div className="scene-controls"><button className="output-button" onClick={() => setSceneManagerOpen(true)}>SCENES ⚙</button>
          {[
            ["scene-display-1", "SCENE 1"],
            ["scene-display-2", "SCENE 2"],
            ["scene-production", "PRODUCTION"]
          ].map(([id, label]) => (
            <button key={id} className={activeSceneId === id ? "output-button enabled" : "output-button"} onClick={() => activateScene(id)}>{label}</button>
          ))}
        </div>
        <div className="safety-controls"><button className="safety-button" onClick={() => setDiagnosticsOpen(true)}>DIAG</button><button className={blackout ? "safety-button danger active" : "safety-button"} onClick={() => { const next = !blackout; setBlackout(next); outputEngine.setEnabled("display-1", !next); setOutputRevision((v) => v + 1); setProjectMessage(next ? "Display blackout active." : "Display blackout cleared."); }}>{blackout ? "CLEAR" : "BLACKOUT"}</button><button className={panicArmed ? "safety-button danger active" : "safety-button"} onClick={() => { setPanicArmed((v) => !v); setProjectMessage(panicArmed ? "Panic disarmed." : "Panic armed."); }}>PANIC</button></div><div className="resolution"><span>1920 × 1080</span><span>{mediaSettings.fps} FPS</span><span className="output-status-pill">{mediaSettings.streaming ? "STREAM ON" : "STREAM OFF"}</span><span className="output-status-pill">{mediaSettings.recording ? "REC ON" : "REC OFF"}</span></div>
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
      {diagnosticsOpen && <div className="modal-backdrop" onClick={() => setDiagnosticsOpen(false)}>
        <div className="add-input-modal diagnostics-modal" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><strong>RUNTIME DIAGNOSTICS</strong><span>Operator-facing health summary.</span></div><button onClick={() => setDiagnosticsOpen(false)}>×</button></div>
          <div className="diagnostic-grid">
            <div><span>Native Host</span><b className={nativeHostState === "online" ? "diag-ok" : "diag-warn"}>{nativeHostState.toUpperCase()}</b></div>
            <div><span>NDI</span><b>{runtimeAdapters.find((a) => a.name === "NDI")?.available ? "READY" : "OFFLINE"}</b></div>
            <div><span>OMT</span><b>{runtimeAdapters.find((a) => a.name === "OMT")?.available ? "READY" : "OFFLINE"}</b></div>
            <div><span>ASIO</span><b>{runtimeAdapters.find((a) => a.name === "ASIO")?.available ? "READY" : "OFFLINE"}</b></div>
            <div><span>Preview</span><b>{getPreviewRef().layerId ? "CUE READY" : "EMPTY"}</b></div>
            <div><span>Program</span><b>{getProgramRef().layerId ? "ON AIR" : "EMPTY"}</b></div>
            <div><span>Display</span><b>{fullscreenState.target.enabled ? "ENABLED" : "DISABLED"}</b></div>
            <div><span>Production</span><b>{mediaSettings.streaming || mediaSettings.recording || mediaSettings.virtual ? "ACTIVE" : "IDLE"}</b></div>
          </div>
          <div className="input-select-footer"><div className="modal-drop">Diagnostics are read-only. Backend/runtime implementation remains separate from this operator view.</div><div className="input-select-actions"><button className="modal-cancel" onClick={() => setDiagnosticsOpen(false)}>CLOSE</button></div></div>
        </div>
      </div>}
      {sceneManagerOpen && <div className="modal-backdrop" onClick={() => setSceneManagerOpen(false)}>
        <div className="add-input-modal scene-manager-modal" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><strong>SCENE MANAGER</strong><span>Output routing presets.</span></div><button onClick={() => setSceneManagerOpen(false)}>×</button></div>
          <div className="scene-manager-list"><div className="scene-manager-actions"><button className="modal-add" onClick={createScene}>+ NEW SCENE</button></div>{currentScenes().map((scene) => <div className={activeSceneId === scene.id ? "scene-manager-row active" : "scene-manager-row"} key={scene.id}><div><input className="scene-name-input" value={scene.name} onChange={(event) => renameScene(scene.id, event.target.value)} /><small>{scene.target.kind.toUpperCase()} · {scene.compositionId}</small></div><div className="scene-row-actions"><button onClick={() => { activateScene(scene.id); setSceneManagerOpen(false); }}>RECALL</button><button onClick={() => deleteScene(scene.id)} disabled={currentScenes().length <= 1}>DELETE</button></div></div>)}</div>
          <div className="input-select-footer"><div className="modal-drop">Scene stores output routing; composition remains the render hierarchy.</div><div className="input-select-actions"><button className="modal-cancel" onClick={() => setSceneManagerOpen(false)}>CLOSE</button></div></div>
        </div>
      </div>}
      {deckSettingsId && (() => {
        const deck = decks.find((item) => item.id === deckSettingsId);
        if (!deck) return null;
        return <div className="modal-backdrop" onClick={() => setDeckSettingsId(null)}>
          <div className="add-input-modal deck-settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><strong>DECK SETTINGS</strong><span>{deck.name} · {deck.kind.toUpperCase()}</span></div><button onClick={() => setDeckSettingsId(null)}>×</button></div>
            <div className="settings-grid deck-settings-grid">
              <section><h4>IDENTITY</h4><label className="deck-setting-field">Deck Name<input value={deck.name} onChange={(event) => updateDeck(deck.id, { name: event.target.value })} /></label><label className="deck-setting-field">Loop<input type="checkbox" checked={Boolean(deck.loop)} onChange={(event) => updateDeck(deck.id, { loop: event.target.checked })} /></label></section>
              <section><h4>TRANSITION</h4><label className="deck-setting-field">Type<select value={deck.transition.type} onChange={(event) => updateDeck(deck.id, { transition: { ...deck.transition, type: event.target.value as Transition["type"] } })}><option value="cut">Cut</option><option value="fade">Fade</option><option value="wipe">Wipe</option></select></label><label className="deck-setting-field">Duration (ms)<input type="number" min="0" max="10000" value={deck.transition.durationMs} onChange={(event) => updateDeck(deck.id, { transition: { ...deck.transition, durationMs: Math.max(0, Number(event.target.value) || 0) } })} /></label></section>
              <section><h4>STATUS</h4><div className="settings-row"><span>Master</span><b>{deckRuntime.getState(deck.id).masterLevel}%</b></div><div className="settings-row"><span>Sources</span><b>{deck.layers.filter((layer) => layer.sourceId).length}</b></div><div className="settings-row"><span>Transition</span><b>{deck.transition.type.toUpperCase()}</b></div></section>
            </div>
            <div className="input-select-footer"><div className="modal-drop">Transition belongs to this Deck and is used when the Deck enters Program.</div><div className="input-select-actions"><button className="modal-cancel" onClick={() => setDeckSettingsId(null)}>CLOSE</button></div></div>
          </div>
        </div>;
      })()}
      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="add-input-modal settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><strong>VISCO SETTINGS</strong><span>Runtime, devices and operator preferences.</span></div><button onClick={() => setShowSettings(false)}>×</button></div>
            <div className="settings-grid">
              <section><h4>RUNTIME</h4><div className="settings-row"><span>Native Host</span><b>{nativeHostState.toUpperCase()}</b></div><div className="settings-row"><span>Capture Device</span><b>{nativeCaptureDevice || "NONE"}</b></div>{runtimeAdapters.map((adapter)=><div className="settings-row" key={adapter.name}><span>{adapter.name}</span><b className={adapter.available?"ok":"off"}>{adapter.available?"AVAILABLE":"UNAVAILABLE"}</b></div>)}</section>
              <section><h4>PERFORMANCE</h4><div className="settings-row"><span>Target FPS</span><b>{mediaSettings.fps}</b></div><div className="settings-row"><span>Preview</span><b>{nativeHostState === "online" ? "NATIVE" : "SIMULATED"}</b></div><div className="settings-row"><span>Autosave</span><b>{autoSaveEnabled ? "5 SEC" : "OFF"}</b></div></section>
              <section><h4>OUTPUTS</h4><div className="settings-row"><span>Display</span><b>{fullscreenState.target.enabled?"ON":"OFF"}</b></div><div className="settings-row"><span>Stream</span><b>{mediaSettings.streaming?"ON":"OFF"}</b></div><div className="settings-row"><span>Record</span><b>{mediaSettings.recording?"ON":"OFF"}</b></div><div className="settings-row"><span>Virtual Out</span><b>{mediaSettings.virtual?"ON":"OFF"}</b></div></section>
            </div>
            <div className="input-select-footer"><div className="modal-drop">Backend runtime settings remain read-only here.</div><div className="input-select-actions"><button className="modal-cancel" onClick={() => setShowSettings(false)}>CLOSE</button></div></div>
          </div>
        </div>
      )}

      {outputSettings && (
        <div className="modal-backdrop" onClick={() => setOutputSettings(null)}>
          <div className="add-input-modal output-settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><strong>{outputSettings.toUpperCase()} SETTINGS</strong><span>Encoder and output configuration. The active Scene remains the routing authority.</span></div><button onClick={() => setOutputSettings(null)}>×</button></div>
            <div className="property-grid">
              <label>Resolution<select defaultValue="1920x1080" onChange={(event) => { const [w,h]=event.target.value.split("x").map(Number); applyOutputSettings({ resolution: [w,h] as [number,number] }); }}><option value="1920x1080">1920 × 1080</option><option value="1280x720">1280 × 720</option><option value="3840x2160">3840 × 2160</option></select></label>
              <label>FPS<select defaultValue={String(mediaSettings.fps)} onChange={(event) => applyOutputSettings({ fps: Number(event.target.value) })}><option value="30">30</option><option value="25">25</option><option value="24">24</option><option value="60">60</option></select></label>
              {outputSettings !== "display" && <label>Codec<select defaultValue={outputSettings === "stream" ? mediaSettings.stream?.codec ?? "h264" : mediaSettings.record?.codec ?? "h264"} onChange={(event) => applyOutputSettings({ codec: event.target.value })}><option value="h264">H.264</option><option value="hevc">HEVC / H.265</option></select></label>}
              {outputSettings !== "display" && <label>Bitrate<select defaultValue="auto" onChange={(event) => applyOutputSettings({ bitrate: event.target.value === "auto" ? "auto" : Number(event.target.value) })}><option value="auto">Auto</option><option value="4000">4 Mbps</option><option value="8000">8 Mbps</option><option value="12000">12 Mbps</option></select></label>}
            </div>
            <div className="input-select-footer"><div className="modal-drop">Record and Stream consume the same Production Scene frame; only encoder settings are independent.</div><div className="input-select-actions"><button className="modal-cancel" onClick={() => setOutputSettings(null)}>CLOSE</button></div></div>
          </div>
        </div>
      )}
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
                {inputTypes.filter((item) => ["camera","video-capture","ndi","omt","desktop-capture","ip-camera"].includes(item.kind)).map((item) => (
                  <button key={item.kind} className={selectedInputKind === item.kind ? "input-side-item active" : "input-side-item"} onClick={() => setSelectedInputKind(item.kind)}>{item.label}</button>
                ))}
                <div className="input-group-title">GENERATED / INTERNAL</div>
                {inputTypes.filter((item) => ["colour","timer","title","composition","video-delay"].includes(item.kind)).map((item) => (
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
                          {["camera","video-capture","ndi","omt","desktop-capture"].includes(selected.kind) && <div className="device-discovery-config">
                            <div className="discovery-toolbar">
                              {(selected.kind === "ndi" || selected.kind === "omt") && <input value={discoveryServer} onChange={(event) => setDiscoveryServer(event.target.value)} placeholder={selected.kind === "omt" ? "Discovery Server host:6399 (optional)" : "NDI Discovery Server host:5959 (optional)"} />}
                              <button className="input-browse" onClick={discoverDevices} disabled={discoveryBusy}>{discoveryBusy ? "DISCOVERING…" : "DISCOVER DEVICES"}</button>
                            </div>
                            <div className="input-config-note">{discoveryMessage || `Native Host: ${nativeHostState.toUpperCase()} · Windows native discovery aktif untuk Camera/Webcam dan Video Capture.`}</div>
                            {discoveredDevices.length > 0 && <div className="device-list">{discoveredDevices.map((device) => <button className="device-list-item" key={device.id} onClick={() => addDiscoveredDevice(device)}><span><strong>{device.name}</strong><small>{device.kind} · {device.address ?? device.uri ?? device.transport}</small></span><b>ADD</b></button>)}</div>}
                          </div>}
                          {selected.kind === "ip-camera" && <div className="device-discovery-config">
                            <label>Protocol<select defaultValue="rtsp"><option value="rtsp">RTSP</option><option value="onvif">ONVIF</option></select></label>
                            <label>Address<input value={ipCameraUri} onChange={(event) => setIpCameraUri(event.target.value)} placeholder="rtsp://..." /></label>
                            <label>Latency<select defaultValue="low"><option value="low">Low Latency</option></select></label>
                            <button className="input-browse" onClick={addManualIpCamera} disabled={!ipCameraUri.trim()}>ADD IP CAMERA</button>
                          </div>}
                          {selected.kind === "audio-input" && <div className="device-discovery-config">
  <div className="discovery-toolbar">
    <select value={selectedAudioDevice} onChange={(event) => setSelectedAudioDevice(event.target.value)}>
      <option value="">Select audio input</option>
      {audioDevices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
    </select>
    <button className="input-browse" onClick={discoverAudioDevices}>DETECT AUDIO</button>
  </div>
  <label>Channels<select defaultValue="stereo"><option value="mono">Mono</option><option value="stereo">Stereo</option></select></label>
  <div className="input-config-note">Windows capture uses WASAPI here; ASIO remains the preferred low-latency backend when the native ASIO adapter is installed.</div>
</div>}
                          {["colour","timer","title","composition","video-delay"].includes(selected.kind) && <div className="input-config-note">This is an internal VisCo source. Create it first, then configure its detailed properties from the Properties panel.</div>}
                          {selected.kind === "audio-input" && <div className="input-config-note">Audio device routing remains owned by the Audio Engine; this selector only defines the input source.</div>}
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
                {!inputTypes.find((item) => item.kind === selectedInputKind)?.accept && !["camera","ndi","omt","desktop-capture","ip-camera"].includes(selectedInputKind) && <button className="modal-add" onClick={() => addInternalInput(selectedInputKind)}>ADD TO LIBRARY</button>}
              </div>
            </div>
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleInputFiles} />
          </div>
        </div>
      )}
    </main>
  );
}
