import type { APIRoute } from "astro";
import { proxyToEdgeFunction } from "../../lib/supabaseProxy";

export const prerender = false;

export const POST: APIRoute = ({ request, clientAddress }) =>
  proxyToEdgeFunction(request, clientAddress, "submit-report");
