import type { LicenseInfo, LicenseState } from "../domain/license.js";
import { defaultLicense } from "../domain/license.js";

export class LicenseEngine {
  private readonly info: LicenseInfo;

  constructor(state: LicenseState = "unlicensed") {
    this.info = defaultLicense(state);
  }

  getInfo(): LicenseInfo {
    return this.info;
  }

  shouldRenderWatermark(): boolean {
    return this.info.watermarkEnabled;
  }
}
