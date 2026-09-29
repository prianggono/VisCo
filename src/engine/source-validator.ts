import type { Source } from "../domain/source.js";

export function validateSourceForLibrary(source: Source): void {
  if (!source.id.trim()) throw new Error("Source id is required.");
  if (!source.name.trim()) throw new Error("Source name is required.");
  if (source.kind === "powerpoint" || source.kind === "pdf") {
    if (!source.document) throw new Error(`Document source "${source.id}" requires document configuration.`);
    if (source.document.currentPage < 1) throw new Error("Document current page must be at least 1.");
    if (source.document.durationMs < 0) throw new Error("Document duration cannot be negative.");
  }
  if (source.kind === "list" && !source.list) throw new Error(`List source "${source.id}" requires list configuration.`);
}

export function cloneSource(source: Source, id: string, name = source.name): Source {
  if (!id.trim()) throw new Error("Cloned source id is required.");
  return { ...source, id, name };
}
