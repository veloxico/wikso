/**
 * Returns the URL for internal attachment endpoints.
 *
 * The /attachments/:id/file endpoint is public (UUID acts as a capability
 * token), so no JWT needs to be appended. External URLs and data URIs
 * are returned unchanged.
 */
export function authenticatedSrc(src: string | null | undefined): string {
  if (!src) return '';
  return src;
}
