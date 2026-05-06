// Stub for the `server-only` Next.js marker package, which isn't
// installable in vitest's node environment. The real package only
// throws at build time if you import a server module from a client
// module — irrelevant for unit tests that import directly.
export {}
