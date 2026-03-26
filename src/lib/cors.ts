// Adds CORS headers to responses for public endpoints.
// Admin endpoints (/admin/*) are same-origin only — don't call this there.

export function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleOptions(request: Request, origin: string): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  return null;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export function jsonResponseWithCors(
  data: unknown,
  origin: string,
  status = 200
): Response {
  return jsonResponse(data, status, corsHeaders(origin));
}
