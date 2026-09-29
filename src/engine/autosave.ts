export interface AutosaveStore<T> { save(snapshot: T): Promise<void> | void; }
export class AutosaveController<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  constructor(private readonly store: AutosaveStore<T>, private readonly delayMs = 30000) {
    if (!Number.isFinite(delayMs) || delayMs < 1000) throw new Error("Autosave delay must be at least 1000ms.");
  }
  markDirty(): void { this.dirty = true; this.schedule(); }
  cancel(): void { if (this.timer) clearTimeout(this.timer); this.timer=null; }
  async flush(snapshot: T): Promise<void> { this.cancel(); if (!this.dirty) return; await this.store.save(snapshot); this.dirty=false; }
  private schedule(): void {
    this.cancel();
    this.timer=setTimeout(()=>{ this.dirty=false; }, this.delayMs);
  }
}
