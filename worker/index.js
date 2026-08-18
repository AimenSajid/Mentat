/**
 * Worker entry point.
 *
 * Serves the built React app from the [assets] binding and handles the one
 * API route itself. This replaced a Pages Functions layout (functions/api/
 * chat.js with onRequestPost); Cloudflare now directs new projects at Workers
 * with static assets rather than Pages.
 */

import { handleChat } from "./chat.js"

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed." }), {
          status: 405,
          headers: { "Content-Type": "application/json", Allow: "POST" },
        })
      }
      return handleChat(request, env)
    }

    // Anything else is a static asset. not_found_handling in wrangler.toml
    // falls back to index.html so client-side routes and refreshes work.
    return env.ASSETS.fetch(request)
  },
}
