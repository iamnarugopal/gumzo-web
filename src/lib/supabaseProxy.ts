/**
 * Server-only helper: forwards a request to a Supabase Edge Function using
 * credentials that never reach the browser. Import only from src/pages/api/*.
 */

// Vercel serverless functions reject bodies over ~4.5 MB anyway; fail early.
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ["application/json", "multipart/form-data"];

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function proxyToEdgeFunction(
  request: Request,
  clientAddress: string | undefined,
  functionName: string,
): Promise<Response> {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_ANON_KEY are not configured.");
    return json({ success: false, error: "Service unavailable." }, 503);
  }

  // Browsers always send Origin on cross-origin and same-origin POSTs.
  // Require it to match this site, which blocks cross-site form posts and
  // naive scripts. (Not a security boundary on its own: Origin can be forged
  // by non-browser clients, so the Edge Functions still enforce reCAPTCHA and
  // rate limits.)
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return json({ success: false, error: "Forbidden." }, 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!ALLOWED_CONTENT_TYPES.some((type) => contentType.startsWith(type))) {
    return json({ success: false, error: "Unsupported request." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ success: false, error: "Request too large." }, 413);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) {
    return json({ success: false, error: "Request too large." }, 413);
  }

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": contentType, // keeps the multipart boundary
  };

  // The Edge Functions rate-limit by client IP. Without this they would only
  // ever see Vercel's egress IP, so every visitor would share one bucket.
  // `clientAddress` comes from Vercel's own header, not from the visitor.
  if (clientAddress) headers["x-forwarded-for"] = clientAddress;

  // Proves to the Edge Functions that the call came through this proxy, so
  // they can reject direct calls that only use the public anon key.
  const proxySecret = import.meta.env.PROXY_SHARED_SECRET;
  if (proxySecret) headers["x-proxy-secret"] = proxySecret;

  try {
    const upstream = await fetch(`${url}/functions/v1/${functionName}`, {
      method: "POST",
      headers,
      body,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(`Edge function ${functionName} failed:`, error);
    return json({ success: false, error: "Service unavailable." }, 502);
  }
}
