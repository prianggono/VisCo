export interface ProjectHistoryOptions { readonly maxEntries?: number; }
export class ProjectHistory<T> {
  private readonly maxEntries: number;
  private past: T[] = [];
  private future: T[] = [];
  constructor(initial: T, options: ProjectHistoryOptions = {}) {
    this.past = [initial]; this.maxEntries = options.maxEntries ?? 50;
    if (this.maxEntries < 2) throw new Error("Project history requires at least 2 entries.");
  }
  push(snapshot: T): void {
    this.past.push(snapshot);
    if (this.past.length > this.maxEntries) this.past.shift();
    this.future = [];
  }
  undo(): T | null {
    if (this.past.length <= 1) return null;
    const current = this.past.pop()!;
    this.future.push(current);
    return this.past[this.past.length - 1] ?? null;
  }
  redo(): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(next);
    return next;
  }
  canUndo(): boolean { return this.past.length > 1; }
  canRedo(): boolean { return this.future.length > 0; }
  clear(initial: T): void { this.past=[initial]; this.future=[]; }
}
