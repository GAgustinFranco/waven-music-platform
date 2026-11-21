/** Where a catalog row came from. Seeds use it with `sourceId` to stay idempotent. */
export enum CatalogSource {
  Upload = 'upload',
  Jamendo = 'jamendo',
  Local = 'local',
}
