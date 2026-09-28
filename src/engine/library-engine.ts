import type { Library, Source, SourceKind } from "../domain/source.js";

export class LibraryEngine {
  private readonly sources = new Map<string, Source>();

  constructor(initial: readonly Source[] = []) {
    initial.forEach((source) => this.add(source));
  }

  add(source: Source): Source {
    if (this.sources.has(source.id)) {
      throw new Error(`Source "${source.id}" is already registered.`);
    }
    this.sources.set(source.id, source);
    return source;
  }

  update(source: Source): Source {
    const previous = this.sources.get(source.id);
    if (!previous) {
      throw new Error(`Source "${source.id}" does not exist.`);
    }
    this.sources.set(source.id, source);
    return previous;
  }

  remove(sourceId: string): Source {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source "${sourceId}" does not exist.`);
    }
    this.sources.delete(sourceId);
    return source;
  }

  get(sourceId: string): Source {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error(`Source "${sourceId}" does not exist.`);
    return source;
  }

  list(kind?: SourceKind): readonly Source[] {
    const all = [...this.sources.values()];
    return kind ? all.filter((source) => source.kind === kind) : all;
  }

  has(sourceId: string): boolean {
    return this.sources.has(sourceId);
  }

  snapshot(): Library {
    return { sourceIds: [...this.sources.keys()] };
  }
}
