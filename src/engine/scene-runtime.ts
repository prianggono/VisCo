import type { Scene } from "../domain/scene.js";

export interface SceneRuntimeState {
  readonly sceneId: string;
  readonly compositionId: string;
  readonly enabled: boolean;
}

export class SceneRuntime {
  private readonly scenes = new Map<string, Scene>();
  private readonly activeByComposition = new Map<string, string>();

  register(scene: Scene): void {
    if (this.scenes.has(scene.id)) throw new Error(`Scene "${scene.id}" is already registered.`);
    if (!scene.id.trim()) throw new Error("Scene id is required.");
    if (!scene.name.trim()) throw new Error("Scene name is required.");
    if (!scene.compositionId.trim()) throw new Error(`Scene "${scene.id}" requires a composition.`);
    if (scene.target.kind === "display" && !scene.target.displayId.trim()) throw new Error(`Scene "${scene.id}" requires a display target.`);
    if (scene.target.kind === "production" && !(scene.target.record || scene.target.stream || scene.target.virtual)) throw new Error(`Production Scene "${scene.id}" must enable at least one production output.`);
    this.scenes.set(scene.id, scene);
  }

  update(scene: Scene): void {
    if (!this.scenes.has(scene.id)) throw new Error(`Scene "${scene.id}" does not exist.`);
    if (!scene.id.trim() || !scene.name.trim() || !scene.compositionId.trim()) throw new Error(`Scene "${scene.id}" is invalid.`);
    if (scene.target.kind === "display" && !scene.target.displayId.trim()) throw new Error(`Scene "${scene.id}" requires a display target.`);
    if (scene.target.kind === "production" && !(scene.target.record || scene.target.stream || scene.target.virtual)) throw new Error(`Production Scene "${scene.id}" must enable at least one production output.`);
    const previous = this.scenes.get(scene.id)!;
    this.scenes.set(scene.id, scene);
    const wasActive = this.activeByComposition.get(previous.compositionId) === scene.id;
    if (wasActive && (previous.compositionId !== scene.compositionId || !scene.enabled)) {
      this.activeByComposition.delete(previous.compositionId);
    }
    if (wasActive && scene.enabled) {
      this.activeByComposition.set(scene.compositionId, scene.id);
    }
  }

  remove(sceneId: string): Scene | null {
    const scene = this.scenes.get(sceneId);
    if (!scene) return null;
    this.scenes.delete(sceneId);
    if (this.activeByComposition.get(scene.compositionId) === sceneId) {
      this.activeByComposition.delete(scene.compositionId);
    }
    return scene;
  }

  replaceAll(scenes: readonly Scene[]): void {
    const next = new Map<string, Scene>();
    for (const scene of scenes) {
      if (next.has(scene.id)) throw new Error(`Scene "${scene.id}" is duplicated.`);
      if (!scene.id.trim() || !scene.name.trim() || !scene.compositionId.trim()) throw new Error(`Scene "${scene.id}" is invalid.`);
      if (scene.target.kind === "display" && !scene.target.displayId.trim()) throw new Error(`Scene "${scene.id}" requires a display target.`);
      if (scene.target.kind === "production" && !(scene.target.record || scene.target.stream || scene.target.virtual)) throw new Error(`Production Scene "${scene.id}" must enable at least one production output.`);
      next.set(scene.id, scene);
    }
    const previousActive = new Map(this.activeByComposition);
    this.scenes.clear();
    this.activeByComposition.clear();
    for (const [id, value] of next) this.scenes.set(id, value);
    for (const [compositionId, sceneId] of previousActive) {
      const scene = next.get(sceneId);
      if (scene && scene.compositionId === compositionId && scene.enabled) {
        this.activeByComposition.set(compositionId, sceneId);
      }
    }
  }

  setEnabled(sceneId: string, enabled: boolean): SceneRuntimeState {
    const scene = this.require(sceneId);
    const updated = { ...scene, enabled };
    this.scenes.set(sceneId, updated);
    if (!enabled && this.activeByComposition.get(scene.compositionId) === sceneId) this.activeByComposition.delete(scene.compositionId);
    return this.state(updated);
  }

  activate(sceneId: string): SceneRuntimeState {
    const scene = this.require(sceneId);
    if (!scene.enabled) throw new Error(`Scene "${scene.id}" is disabled.`);
    this.activeByComposition.set(scene.compositionId, scene.id);
    return this.state(scene);
  }

  deactivate(compositionId: string): void { this.activeByComposition.delete(compositionId); }

  getActive(compositionId: string): Scene | null {
    const id = this.activeByComposition.get(compositionId);
    return id ? this.scenes.get(id) ?? null : null;
  }

  list(compositionId?: string): readonly Scene[] {
    const scenes = [...this.scenes.values()];
    return compositionId === undefined ? scenes : scenes.filter((scene) => scene.compositionId === compositionId);
  }

  private state(scene: Scene): SceneRuntimeState {
    return { sceneId: scene.id, compositionId: scene.compositionId, enabled: scene.enabled };
  }

  private require(sceneId: string): Scene {
    const scene = this.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene "${sceneId}" does not exist.`);
    return scene;
  }
}
