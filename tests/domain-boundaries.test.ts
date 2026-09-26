import { describe, expect, it } from "vitest";
import { canRoute } from "../src/domain/audio.js";
import { defaultLicense } from "../src/domain/license.js";

describe("VisCo domain boundaries", () => {
  it("allows only the canonical Audio In -> VB -> destinations path", () => {
    expect(canRoute("audio-in", "visco-vb")).toBe(true);
    expect(canRoute("visco-vb", "record")).toBe(true);
    expect(canRoute("visco-vb", "stream")).toBe(true);
    expect(canRoute("visco-vb", "zoom")).toBe(true);
    expect(canRoute("master", "visco-vb")).toBe(false);
    expect(canRoute("visco-vb", "master")).toBe(false);
  });

  it("uses watermark instead of package gating when unlicensed", () => {
    expect(defaultLicense("unlicensed")).toEqual({ state: "unlicensed", watermarkEnabled: true });
    expect(defaultLicense("licensed")).toEqual({ state: "licensed", watermarkEnabled: false });
  });
});
