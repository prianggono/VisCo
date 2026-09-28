import type { Source } from "../domain/source.js";

export function isOwnedObjectUrl(uri: Source["uri"]): uri is string {
  return typeof uri === "string" && uri.startsWith("blob:");
}

export function revokeOwnedObjectUrl(source?: Pick<Source, "uri">): void {
  if (!source || !isOwnedObjectUrl(source.uri)) return;
  URL.revokeObjectURL(source.uri);
}

export function revokeOwnedObjectUrls(sources: readonly Pick<Source, "uri">[]): void {
  for (const source of sources) revokeOwnedObjectUrl(source);
}
