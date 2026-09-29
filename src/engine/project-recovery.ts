export interface ProjectRecoveryStore { save(serialized: string): void; load(): string | null; clear(): void; }
export class BrowserProjectRecoveryStore implements ProjectRecoveryStore {
  constructor(private readonly key = "visco-recovery-project") {}
  save(serialized: string): void { if (typeof localStorage !== "undefined") localStorage.setItem(this.key, serialized); }
  load(): string | null { return typeof localStorage === "undefined" ? null : localStorage.getItem(this.key); }
  clear(): void { if (typeof localStorage !== "undefined") localStorage.removeItem(this.key); }
}
