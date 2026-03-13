/**
 * Append JWT access token to internal API URLs so that browser-initiated
 * requests (<img src>, <video src>) can authenticate.
 *
 * External URLs and data URIs are returned unchanged.
 *
 * NOTE: this is a function, not a hook — call it every render (not inside
 * useMemo with only src as dep) so it always picks up the latest token
 * after a refresh.
 */
export function authenticatedSrc(src: string | null | undefined): string {
  if (!src) return '';

  // Only append token to our own attachment endpoints
  if (!src.startsWith('/api/') || !src.includes('/attachments/')) {
    return src;
  }

  if (typeof window === 'undefined') return src;

  const token = localStorage.getItem('accessToken');
  if (!token) return src;

  // Strip any previous token before appending the current one
  const cleanSrc = src.replace(/([?&])token=[^&]*/g, '').replace(/\?$/, '');
  const separator = cleanSrc.includes('?') ? '&' : '?';
  return `${cleanSrc}${separator}token=${token}`;
}
