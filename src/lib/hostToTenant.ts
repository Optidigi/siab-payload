export const stripAdminPrefix = (host: string): string => {
  const noPort = host.split(":")[0] || host
  return noPort.startsWith("admin.") ? noPort.slice(6) : noPort
}

export const isSuperAdminDomain = (domain: string, configured: string | undefined): boolean => {
  if (!configured) return domain === "localhost"
  return domain === configured
}
