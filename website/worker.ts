/**
 * Website Redirect Worker
 * Serves static assets, and if not found, falls back to index.html
 */
export default {
  async fetch(request: Request, env: { ASSETS: { fetch: (req: Request) => Promise<Response> } }) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    // If the asset doesn't exist (404), serve index.html (SPA fallback)
    if (response.status === 404 && !url.pathname.includes('.')) {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    }

    return response;
  },
};
