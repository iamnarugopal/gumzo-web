import type { APIRoute } from "astro";
import { proxyToEdgeFunction } from "../../lib/supabaseProxy";

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  proxyToEdgeFunction(request, "submit-support");
