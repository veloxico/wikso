import { NextRequest, NextResponse } from 'next/server';

/**
 * Streaming proxy for Confluence import file uploads.
 *
 * The default middleware rewrite buffers the entire request body in memory,
 * which is unsuitable for large ZIP files (potentially several GB).
 * This route handler streams the body directly to the backend without buffering.
 */

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000';

export async function POST(request: NextRequest) {
  const backendUrl = `${API_URL}/api/v1/admin/import/upload`;

  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'content-type': request.headers.get('content-type') || '',
      authorization: request.headers.get('authorization') || '',
    },
    body: request.body,
    // @ts-expect-error -- Node.js fetch requires duplex for streaming request bodies
    duplex: 'half',
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  });
}
