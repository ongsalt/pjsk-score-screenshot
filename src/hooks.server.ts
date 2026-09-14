import type { Handle } from "@sveltejs/kit";

/**
 * Cross-origin isolation for `vite dev` / `vite preview`, mirroring
 * static/_headers. It is the DOCUMENT response that decides
 * `crossOriginIsolated`, and Vite's `server.headers` only reach module and
 * asset responses - SvelteKit serves the page itself. adapter-static never
 * runs this in production; Cloudflare applies static/_headers there.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  return response;
};
