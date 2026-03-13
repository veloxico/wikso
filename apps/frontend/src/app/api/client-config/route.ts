import { NextRequest, NextResponse } from 'next/server';

/**
 * Runtime configuration endpoint for the frontend client.
 *
 * NEXT_PUBLIC_* env vars are baked at build time and unavailable in
 * pre-built Docker images. This route runs server-side at request time,
 * so it can read real environment variables and derive configuration
 * from the incoming request headers.
 *
 * The response is cached on the client for the lifetime of the page,
 * so this adds negligible overhead.
 */
export function GET(request: NextRequest) {
  // Explicit env var takes priority (operators can set WS_PUBLIC_URL
  // in docker-compose to override auto-detection).
  const explicit = process.env.WS_PUBLIC_URL;

  if (explicit) {
    return NextResponse.json({ wsUrl: explicit });
  }

  // Auto-detect from the request Host header.
  // Validate host to prevent header-injection attacks (e.g. spoofed x-forwarded-host).
  const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3001';
  const host = /^[a-zA-Z0-9._:-]+$/.test(rawHost) ? rawHost : 'localhost:3001';
  const proto = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const wsProto = proto === 'https' ? 'wss' : 'ws';

  return NextResponse.json({
    wsUrl: `${wsProto}://${host}/collaboration`,
  });
}
