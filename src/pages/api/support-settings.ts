import type { APIRoute } from "astro";

export const prerender = false;

// Attachment rules for the support form (size and image types), set by the admin in the app.
// Cached for a minute at the edge, so visitors never hit the database one by one.
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export const GET: APIRoute = async () => {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return new Response(JSON.stringify({ success: false }), {
      status: 503,
      headers: { ...headers, "Cache-Control": "no-store" },
    });
  }

  const secret = import.meta.env.PROXY_SHARED_SECRET;

  try {
    const upstream = await fetch(`${url}/functions/v1/support-settings`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(secret ? { "x-proxy-secret": secret } : {}),
      },
      body: "{}",
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok || !data?.success) {
      return new Response(JSON.stringify({ success: false }), {
        status: 502,
        headers: { ...headers, "Cache-Control": "no-store" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        max_kb: data.max_kb,
        exts: data.exts,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("support-settings failed:", error);
    return new Response(JSON.stringify({ success: false }), {
      status: 502,
      headers: { ...headers, "Cache-Control": "no-store" },
    });
  }
};
