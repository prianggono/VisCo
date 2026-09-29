import type { DeviceKind, DiscoveredDevice } from "../domain/device.js";

export interface CachedDevice extends DiscoveredDevice { readonly lastSeenAt: number; readonly missing: boolean; }
export class DeviceRegistry {
  private devices = new Map<string, CachedDevice>();
  update(found: readonly DiscoveredDevice[]): void {
    const now=Date.now(); const foundIds=new Set(found.map(d=>d.id));
    for(const [id,device] of this.devices) this.devices.set(id,{...device,missing:!foundIds.has(id)});
    for(const device of found) this.devices.set(device.id,{...device,lastSeenAt:now,missing:false});
  }
  markMissing(deviceId:string): void { const device=this.devices.get(deviceId); if(device) this.devices.set(deviceId,{...device,missing:true}); }
  get(deviceId:string): CachedDevice | null { return this.devices.get(deviceId) ?? null; }
  list(kind?: DeviceKind): readonly CachedDevice[] { return [...this.devices.values()].filter(d=>kind===undefined||d.kind===kind); }
}
