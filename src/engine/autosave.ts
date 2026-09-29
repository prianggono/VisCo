export interface AutosaveStore<T> { save(snapshot: T): Promise<void> | void; }
export class AutosaveController<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private latest: T | null = null;
  constructor(private readonly store: AutosaveStore<T>, private readonly delayMs = 30000) {
    if (!Number.isFinite(delayMs) || delayMs < 1000) throw new Error("Autosave delay must be at least 1000ms.");
  }
  markDirty(snapshot: T): void {
    this.latest = snapshot; this.dirty = true; this.schedule();
  }
  cancel(): void { if (this.timer) clearTimeout(this.timer); this.timer=null; }
  async flush(snapshot?: T): Promise<void> {
    this.cancel();
    const value = snapshot ?? this.latest;
    if (!this.dirty || value === null) return;
    await this.store.save(value); this.latest = value; this.dirty=false;
  }
  isDirty(): boolean { return this.dirty; }
  private schedule(): void {
    this.cancel();
    this.timer=setTimeout(() => { void this.flush(); }, this.delayMs);
  }
}
