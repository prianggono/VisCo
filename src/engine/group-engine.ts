import type { Group } from "../domain/group.js";
import type { Layer } from "../domain/layer.js";

export class GroupEngine {
  private groups = new Map<string, Group>();

  replaceAll(groups: readonly Group[]): void {
    const next = new Map<string, Group>();
    for (const group of groups) {
      if (!group.id.trim() || !group.name.trim()) throw new Error("Group id and name are required.");
      if (next.has(group.id)) throw new Error(`Group "${group.id}" is duplicated.`);
      const layerIds = [...new Set(group.layerIds)];
      next.set(group.id, { ...group, layerIds });
    }
    this.groups = next;
  }

  create(id: string, name: string, layerIds: readonly string[] = []): Group {
    if (!id.trim() || !name.trim()) throw new Error("Group id and name are required.");
    if (this.groups.has(id)) throw new Error(`Group "${id}" already exists.`);
    const group = { id, name, layerIds: [...new Set(layerIds)], collapsed: false };
    this.groups.set(id, group);
    return group;
  }

  update(id: string, patch: Partial<Omit<Group, "id">>): Group {
    const current = this.require(id);
    const next: Group = { ...current, ...patch, layerIds: patch.layerIds ? [...new Set(patch.layerIds)] : current.layerIds };
    this.groups.set(id, next);
    return next;
  }

  addLayer(id: string, layerId: string): Group {
    const current = this.require(id);
    if (current.layerIds.includes(layerId)) return current;
    return this.update(id, { layerIds: [...current.layerIds, layerId] });
  }

  removeLayer(id: string, layerId: string): Group {
    return this.update(id, { layerIds: this.require(id).layerIds.filter((value) => value !== layerId) });
  }

  toggleCollapsed(id: string): Group {
    return this.update(id, { collapsed: !this.require(id).collapsed });
  }

  clone(id: string, cloneId: string, name?: string): Group {
    const source = this.require(id);
    return this.create(cloneId, name ?? `${source.name} Copy`, source.layerIds);
  }

  get(id: string): Group { return this.require(id); }
  list(): readonly Group[] { return [...this.groups.values()]; }

  getLayers(group: Group, layers: readonly Layer[]): readonly Layer[] {
    const ids = new Set(group.layerIds);
    return layers.filter((layer) => ids.has(layer.id));
  }

  private require(id: string): Group {
    const group = this.groups.get(id);
    if (!group) throw new Error(`Group "${id}" does not exist.`);
    return group;
  }
}
