export const stripAdminPrefix = (host: string): string => {
  const noPort = host.split(":")[0] || host
  return noPort.startsWith("admin.") ? noPort.slice(6) : noPort
}

export const isSuperAdminDomain = (
  domain: string,
  configured: string | undefined,
  isDev = process.env.NODE_ENV === "development"
): boolean => {
  if (!configured) return domain === "localhost"
  if (domain === configured) return true
  // Dev convenience: in dev, localhost is also treated as super-admin so
  // navigating to http://localhost:3001 doesn't 404. Production sets
  // NODE_ENV=production and only the configured domain matches.
  if (isDev && domain === "localhost") return true
  return false
}
