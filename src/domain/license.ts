export type LicenseState = "unlicensed" | "licensed";

export interface LicenseInfo {
  readonly state: LicenseState;
  readonly watermarkEnabled: boolean;
}

/**
 * Product policy: there are no feature packages/tiers.
 * Unlicensed mode remains usable but renders the VisCo watermark.
 */
export function defaultLicense(state: LicenseState): LicenseInfo {
  return {
    state,
    watermarkEnabled: state === "unlicensed"
  };
}
