/**
 * lib/connectivity/probe.ts
 *
 * Lightweight reachability probe. Confirms that Supabase is actually
 * reachable — not just that the OS thinks we have a network link.
 *
 * Why: @capacitor/network reports "connected" whenever the device has a
 * cell signal, even if no packets are flowing (train tunnels, saturated
 * cells, hanging routers). A single HEAD request with a short timeout
 * distinguishes real reachability from a dead link.
 *
 * Called by: connectivityService (periodic + on reconnect)
 */

const PROBE_TIMEOUT_MS = 5_000;

/**
 * Fires a HEAD request to the Supabase REST root with a 5 s timeout.
 * Returns true on any 2xx/3xx/4xx (server responded), false on timeout
 * or network error (server unreachable).
 *
 * 4xx is treated as reachable because it still proves the server
 * received the request — we're probing the network, not the auth layer.
 */
export async function probeSupabaseReachability(): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { apikey: anonKey },
      cache: 'no-store',
    });
    // Any HTTP response means the server received the request.
    return response.status < 500;
  } catch {
    // AbortError or network error → unreachable
    return false;
  } finally {
    clearTimeout(timer);
  }
}
