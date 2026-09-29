import { describe, expect, it } from "vitest";
import { mixAudioFrame } from "../src/engine/audio-mixer.js";
describe("audio mixer",()=>{it("keeps mixed samples bounded",()=>{const out=mixAudioFrame({samples:new Float32Array([2,-2]),channels:2,sampleRate:48000},{sources:[{deckId:"d",layerId:"l",gain:1}]});expect([...out.samples]).toEqual([1,-1]);});});
