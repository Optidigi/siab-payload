import config from "@/payload.config"
import { GRAPHQL_PLAYGROUND_GET } from "@payloadcms/next/routes"
import { isPlaygroundEnabled } from "@/lib/graphql/playgroundGate"

// Audit finding #16 (P3, T10) — defense-in-depth env-gate for the GraphQL
// playground. The underlying Payload handler already 404s in production by
// default (Payload v3.84.1: `disablePlaygroundInProduction` defaults to
// true; verified at `node_modules/@payloadcms/next/dist/routes/graphql/
// playground.js:9`). This wrapper adds an in-repo gate so that even a
// future config change setting `graphQL: { disablePlaygroundInProduction:
// false }` cannot accidentally expose the playground in production. See
// `audits/01-FINAL.md` finding #16 + `audits/OUT-OF-BATCH-OBSERVATIONS.md`
// OBS-3 (the iframable-playground concern that closes as a side effect).

const playgroundHandler = GRAPHQL_PLAYGROUND_GET(config)

export const GET = async (request: Request): Promise<Response> => {
  if (!isPlaygroundEnabled()) {
    return new Response("Not Found", { status: 404 })
  }
  return playgroundHandler(request)
}
