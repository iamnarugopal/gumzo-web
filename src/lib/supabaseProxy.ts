/**
 * Server-only helper: forwards a request to a Supabase Edge Function using
 * credentials that never reach the browser. Import only from src/pages/api/*.
 */

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function proxyToEdgeFunction(
  request: Request,
  functionName: string,
): Promise<Response> {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_ANON_KEY are not configured.");
    return json({ success: false, error: "Service unavailable." }, 503);
  }

  // Same-origin only: reject cross-site browser requests.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ success: false, error: "Forbidden." }, 403);
  }

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  // Keep the original Content-Type (JSON or multipart boundary).
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  try {
    const upstream = await fetch(`${url}/functions/v1/${functionName}`, {
      method: "POST",
      headers,
      body: await request.arrayBuffer(),
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
