import "server-only"
import crypto from "node:crypto"

export type PreviewClaims = {
  tenantId: number | string
  pageId: number | string
}

export type SignedToken = {
  token: string
  exp: number  // unix seconds
}

const TTL_SECONDS = 30 * 60  // 30 minutes per spec

/**
 * Sign a preview HMAC token. Caller-supplied claims plus an `exp` baked
 * at sign time. Trim secret on read to defend against .env trailing
 * whitespace.
 */
export function signPreviewToken(
  claims: PreviewClaims,
  secret: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SignedToken {
  if (!secret) {
    throw new Error("signPreviewToken: PREVIEW_HMAC_SECRET is required")
  }
  const trimmedSecret = secret.trim()
  if (!trimmedSecret) {
    throw new Error("signPreviewToken: PREVIEW_HMAC_SECRET is empty after trim")
  }
  const exp = nowSeconds + TTL_SECONDS

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ ...claims, exp })).toString("base64url")
  const sig = crypto
    .createHmac("sha256", trimmedSecret)
    .update(`${header}.${payload}`)
    .digest("base64url")

  return { token: `${header}.${payload}.${sig}`, exp }
}
