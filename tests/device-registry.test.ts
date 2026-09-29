import { describe, expect, it } from "vitest";
import { DeviceRegistry } from "../src/engine/device-registry.js";
describe("DeviceRegistry",()=>{it("keeps missing devices without reconnect loops",()=>{const r=new DeviceRegistry();r.update([{id:"c1",name:"Cam",kind:"camera",transport:"native"}]);r.update([]);expect(r.get("c1")?.missing).toBe(true);});});
