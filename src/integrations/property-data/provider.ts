export interface LicensedPropertyFeed {
  readonly mode: "BLOCKED";
  readonly reason: string;
}
export const propertyFeed: LicensedPropertyFeed = {
  mode: "BLOCKED",
  reason:
    "No licensed feed contract, credentials or import mapping has been supplied. CSV import is available for authorized data only.",
};
