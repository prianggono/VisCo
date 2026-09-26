import { describe, expect, it } from "vitest";
import { canRoute, defaultLicense } from "../src/domain/audio.js";
import { defaultLicense as license } from "../src/domain/license.js";

describe("VisCo domain boundaries", () => {
  it("blocks VisCo VB -> Master", () => {
    expect(canRoute("visco-vb", "master")).toBe(false);
    expect(canRoute("master", "visco-vb")).toBe(true);
  });

  it("uses watermark instead of package gating when unlicensed", () => {
    expect(license("unlicensed")).toEqual({ state: "unlicensed", watermarkEnabled: true });
    expect(defaultLicense("licensed")).toEqual({ state: "licensed", watermarkEnabled: false });
  });
});
