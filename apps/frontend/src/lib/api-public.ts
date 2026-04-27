import axios from 'axios';

/**
 * Auth-free API client. Used by public/unauthenticated surfaces such as the
 * guest-share page (`/s/[token]`), where a stale `accessToken` in localStorage
 * should NOT be attached to requests — the backend would otherwise reject the
 * request with a 401 before the SharePublicController ever sees it, because
 * some middleware layers interpret the header as a must-be-valid JWT.
 */
export const apiPublic = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});
