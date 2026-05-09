// Audit finding #16 (P3, T10) — defense-in-depth env-gate for the GraphQL
// playground route. Today Payload v3.84.1's `disablePlaygroundInProduction`
// default is `true` (verified at `node_modules/@payloadcms/next/dist/routes/
// graphql/playground.js:9`), so production exposure depends entirely on that
// upstream default. A future config change adding
// `graphQL: { disablePlaygroundInProduction: false }` would silently re-arm
// anonymous schema enumeration. This in-repo gate is belt-and-braces:
// `NODE_ENV === "production"` AND `ENABLE_GRAPHQL_PLAYGROUND !== "1"`
// → playground disabled, regardless of Payload's defaults.
//
// Strict equality (`=== "1"`) is binding per the audit dispatch. Any other
// value — including truthy-looking strings like `"true"`, `"yes"`, `" 1"` —
// returns `false`. This forecloses env-var injection / type-confusion
// hypotheses where a misconfigured env or a CI templating accident could
// flip the playground on by accident.

export const isPlaygroundEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  if (env.NODE_ENV !== "production") return true
  return env.ENABLE_GRAPHQL_PLAYGROUND === "1"
}
